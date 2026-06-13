from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import os, json, re
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'neuralquery_secret_key_2024')

# ── Database 
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL',
    'postgresql://neondb_owner:npg_e9GpmOzvNjb3@ep-shiny-credit-ao6nq900-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = True
db = SQLAlchemy(app)

# ── Models 
class User(db.Model):
    __tablename__ = 'users'
    id                  = db.Column(db.Integer, primary_key=True)
    fullname            = db.Column(db.String(100), nullable=False)
    email               = db.Column(db.String(100), unique=True, nullable=False)
    password            = db.Column(db.String(255), nullable=False)
    history_cleared_at  = db.Column(db.DateTime, nullable=True)  # soft-clear timestamp

class QueryHistory(db.Model):
    __tablename__ = 'query_history'
    id                = db.Column(db.Integer, primary_key=True)
    user_id           = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    natural_query     = db.Column(db.Text, nullable=False)
    generated_sql     = db.Column(db.Text)
    logic_explanation = db.Column(db.Text)
    dialect           = db.Column(db.String(32), default='postgresql')
    created_at        = db.Column(db.DateTime, server_default=db.func.now())
    is_deleted        = db.Column(db.Boolean, default=False, nullable=False)  # soft-delete flag

with app.app_context():
    db.create_all()

    # ── Auto-migration: add new columns to existing tables if they are missing.
    # IF NOT EXISTS makes these statements safe to run on every startup.
    _migrations = [
        "ALTER TABLE users         ADD COLUMN IF NOT EXISTS history_cleared_at TIMESTAMP",
        "ALTER TABLE query_history ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE",
    ]
    with db.engine.connect() as _conn:
        for _sql in _migrations:
            try:
                _conn.execute(db.text(_sql))
            except Exception as _e:
                print(f"[migration] skipped: {_e}")
        _conn.commit()


# ── Helper: returns only history rows visible to this user
# Records created before history_cleared_at or individually soft-deleted are excluded.
# The raw rows remain in the DB — nothing is ever physically removed.
def visible_history_query(user_id):
    user = db.session.get(User, user_id)
    q = QueryHistory.query.filter(
        QueryHistory.user_id == user_id,
        QueryHistory.is_deleted == False          # noqa: E712
    )
    if user and user.history_cleared_at:
        q = q.filter(QueryHistory.created_at > user.history_cleared_at)
    return q


# ── SQL Fallback Generator
DIALECT_NOTES = {
    'postgresql': 'PostgreSQL',
    'standard':   'Standard SQL (ANSI)',
    'mysql':      'MySQL',
    'sqlite':     'SQLite',
}

def extract_table_name(query):
    table_keywords = {
        'employee': 'employees', 'staff': 'employees', 'worker': 'employees',
        'product':  'products',  'item':  'products',  'inventory': 'products',
        'order':    'orders',    'purchase': 'orders', 'sale': 'sales',
        'customer': 'customers', 'client': 'customers',
        'user':     'users',
        'department': 'departments', 'team': 'departments',
        'payment':  'payments',  'invoice': 'invoices',
    }
    for kw, tbl in table_keywords.items():
        if kw in query:
            return tbl
    return 'records'

def generate_sql_fallback(query, dialect='postgresql'):
    q = query.lower()
    table = extract_table_name(q)

    # Dialect-specific date function
    now_fn = {
        'postgresql': 'CURRENT_TIMESTAMP',
        'standard':   'CURRENT_TIMESTAMP',
        'mysql':      'NOW()',
        'sqlite':     "datetime('now')",
    }.get(dialect, 'CURRENT_TIMESTAMP')

    limit_fn = {
        'postgresql': f'LIMIT 100',
        'standard':   f'FETCH FIRST 100 ROWS ONLY',
        'mysql':      f'LIMIT 100',
        'sqlite':     f'LIMIT 100',
    }.get(dialect, 'LIMIT 100')

    if 'count' in q or 'how many' in q:
        sql   = f"SELECT COUNT(*) AS total_count\nFROM {table};"
        logic = f"Uses COUNT(*) aggregate to return the total number of rows in '{table}'."
    elif 'average' in q or 'avg' in q:
        sql   = f"SELECT AVG(amount) AS average_value\nFROM {table};"
        logic = f"Calculates the average of the 'amount' column in '{table}' using AVG()."
    elif 'top' in q or 'highest' in q or 'best' in q:
        sql   = f"SELECT *\nFROM {table}\nORDER BY created_at DESC\nLIMIT 10;"
        logic = f"Retrieves the 10 most recent records from '{table}', ordered by creation date descending."
    elif 'join' in q or 'related' in q:
        sql   = (
            "SELECT e.name, e.salary, d.department_name\n"
            "FROM employees e\n"
            "INNER JOIN departments d ON e.department_id = d.id\n"
            "WHERE e.salary > 50000\n"
            "ORDER BY e.salary DESC;"
        )
        logic = "Joins 'employees' to 'departments' on department_id, filters records above a salary threshold, and returns results sorted by salary."
    elif 'group' in q or 'each' in q or 'per' in q:
        sql   = (
            "SELECT department, COUNT(*) AS employee_count, AVG(salary) AS avg_salary\n"
            "FROM employees\n"
            "GROUP BY department\n"
            "ORDER BY employee_count DESC;"
        )
        logic = "Groups rows by department and aggregates employee count and average salary for each group."
    else:
        sql   = f"SELECT *\nFROM {table}\nWHERE is_active = TRUE\nORDER BY created_at DESC\n{limit_fn};"
        logic = f"Selects all active records from '{table}', sorted by newest first, limited to 100 rows for performance."

    return sql, logic


# ── Routes 
@app.route('/')
def home():
    return render_template('home.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No data received"})
        user = User.query.filter_by(email=data.get('email')).first()
        if user and check_password_hash(user.password, data.get('password', '')):
            session['user_id']   = user.id
            session['user_name'] = user.fullname
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "Incorrect email or password. Please try again."})
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No data received"})
        if User.query.filter_by(email=data.get('email')).first():
            return jsonify({"status": "error", "message": "This email address is already registered."})
        hashed_pw = generate_password_hash(data['password'])
        new_user  = User(fullname=data['fullname'], email=data['email'], password=hashed_pw)
        try:
            db.session.add(new_user)
            db.session.commit()
            return jsonify({"status": "success", "message": "Registration successful!"})
        except Exception:
            db.session.rollback()
            return jsonify({"status": "error", "message": "Registration failed. Please try again later."})
    return render_template('register.html')

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    user_name = session.get('user_name', 'User')
    initials  = ''.join([w[0].upper() for w in user_name.split()[:2]])
    history   = visible_history_query(session['user_id'])\
                    .order_by(QueryHistory.created_at.desc())\
                    .limit(10).all()
    return render_template('dashboard.html', user_name=user_name, initials=initials, history=history)

@app.route('/translate', methods=['POST'])
def translate():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    data = request.get_json()
    if not data or not data.get('query'):
        return jsonify({"status": "error", "message": "No query provided"})

    user_query     = data['query'].strip()
    schema_context = data.get('schema', '').strip()
    dialect        = data.get('dialect', 'postgresql').strip().lower()
    if dialect not in DIALECT_NOTES:
        dialect = 'postgresql'

    dialect_label = DIALECT_NOTES[dialect]
    api_key = os.environ.get('ANTHROPIC_API_KEY')

    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)

            dialect_rules = {
                'postgresql': "Use PostgreSQL-specific syntax: ILIKE, DATE_TRUNC, CURRENT_TIMESTAMP, RETURNING, ::type casts, LIMIT/OFFSET.",
                'standard':   "Use ANSI Standard SQL only. No vendor-specific functions. Use FETCH FIRST N ROWS ONLY instead of LIMIT.",
                'mysql':      "Use MySQL syntax: LIMIT, NOW(), DATE_FORMAT(), IFNULL(), backtick identifiers if needed.",
                'sqlite':     "Use SQLite syntax: LIMIT, datetime('now'), strftime(), no stored procedures.",
            }.get(dialect, '')

            system_prompt = f"""You are an expert SQL query generator. Convert natural language to precise, optimized SQL.

Target dialect: {dialect_label}
{dialect_rules}

Rules:
- Generate syntactically correct SQL for the specified dialect
- Use proper JOINs, WHERE, GROUP BY, ORDER BY as needed
- Add inline SQL comments for complex logic
- Use meaningful aliases
- Return ONLY a raw JSON object (no markdown, no code blocks):
  {{"sql": "...", "logic": "..."}}
The "logic" field: 2-3 sentences explaining the query approach."""

            schema_part = (
                f"\n\nDatabase Schema:\n{schema_context}"
                if schema_context
                else "\n\nAssume standard business tables: employees, products, orders, customers, sales, departments, payments, invoices."
            )

            message = client.messages.create(
                model="claude-opus-4-5",
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content":
                    f'Convert to {dialect_label}: "{user_query}"{schema_part}\n\nRespond with raw JSON only.'}]
            )

            response_text = message.content[0].text.strip()
            response_text = re.sub(r'^```(?:json)?\s*', '', response_text)
            response_text = re.sub(r'\s*```$', '', response_text).strip()

            result = json.loads(response_text)
            sql    = result.get('sql', '')
            logic  = result.get('logic', '')

        except Exception as e:
            print(f"AI error: {e}")
            sql, logic = generate_sql_fallback(user_query, dialect)
    else:
        sql, logic = generate_sql_fallback(user_query, dialect)
        logic += " (Tip: Set the ANTHROPIC_API_KEY environment variable for full AI-powered generation.)"

    # Save to history
    try:
        entry = QueryHistory(
            user_id=session['user_id'],
            natural_query=user_query,
            generated_sql=sql,
            logic_explanation=logic,
            dialect=dialect
        )
        db.session.add(entry)
        db.session.commit()
    except Exception as e:
        print(f"History save error: {e}")
        db.session.rollback()

    return jsonify({"status": "success", "sql": sql, "logic": logic, "dialect": dialect_label})

@app.route('/history', methods=['GET'])
def get_history():
    if 'user_id' not in session:
        return jsonify({"status": "error"}), 401
    history = visible_history_query(session['user_id'])\
                .order_by(QueryHistory.created_at.desc())\
                .limit(50).all()
    return jsonify({
        "status": "success",
        "history": [{
            "id":           h.id,
            "natural_query": h.natural_query,
            "sql":          h.generated_sql,
            "logic":        h.logic_explanation,
            "dialect":      h.dialect or 'postgresql',
            "created_at":   h.created_at.strftime('%b %d, %H:%M') if h.created_at else ''
        } for h in history]
    })

@app.route('/history/clear', methods=['POST'])
def clear_history():
    """Soft-clear: stamp a timestamp on the user; rows stay in the DB."""
    if 'user_id' not in session:
        return jsonify({"status": "error"}), 401
    user = db.session.get(User, session['user_id'])
    if not user:
        return jsonify({"status": "error", "message": "User not found"}), 404
    user.history_cleared_at = datetime.utcnow()
    try:
        db.session.commit()
        return jsonify({"status": "success"})
    except Exception:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Could not clear history"}), 500


@app.route('/history/<int:history_id>', methods=['DELETE'])
def delete_history(history_id):
    """Soft-delete a single entry — marks it hidden, never removes the row."""
    if 'user_id' not in session:
        return jsonify({"status": "error"}), 401
    entry = QueryHistory.query.filter_by(id=history_id, user_id=session['user_id']).first()
    if entry:
        entry.is_deleted = True
        db.session.commit()
    return jsonify({"status": "success"})



# ── Profile ───────────────────────────────────────────────
@app.route('/profile')
def profile():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    user = db.session.get(User, session['user_id'])
    if not user:
        return redirect(url_for('login'))
    initials = ''.join([w[0].upper() for w in user.fullname.split()[:2]])
    return render_template('profile.html', user=user, initials=initials)

@app.route('/profile/update', methods=['POST'])
def profile_update():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No data received"})
    user = db.session.get(User, session['user_id'])
    if not user:
        return jsonify({"status": "error", "message": "User not found"}), 404

    # Update name
    if data.get('fullname'):
        user.fullname = data['fullname'].strip()
        session['user_name'] = user.fullname

    # Update password
    if data.get('new_password'):
        if not check_password_hash(user.password, data.get('current_password', '')):
            return jsonify({"status": "error", "message": "Current password is incorrect."})
        if len(data['new_password']) < 8:
            return jsonify({"status": "error", "message": "New password must be at least 8 characters."})
        user.password = generate_password_hash(data['new_password'])

    try:
        db.session.commit()
        return jsonify({"status": "success", "message": "Profile updated successfully!"})
    except Exception:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Update failed. Please try again."})


# ── Settings ──────────────────────────────────────────────
@app.route('/settings')
def settings():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    user_name = session.get('user_name', 'User')
    initials  = ''.join([w[0].upper() for w in user_name.split()[:2]])
    return render_template('settings.html', user_name=user_name, initials=initials)

if __name__ == '__main__':
    app.run(debug=True)
