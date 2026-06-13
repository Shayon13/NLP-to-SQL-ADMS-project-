# NeuralQuery — Intelligent NLP Database Analytics
NeuralQuery is a full-stack web application that lets users describe what they want from a database in natural language and instantly receive an optimized, dialect-aware SQL query along with a plain-English explanation of the query logic. No SQL expertise required.
# Table of Contents
Features
Tech Stack
Project Structure
Getting Started
Prerequisites
Installation
Environment Variables
Running the App
Usage
API Reference
Database Schema
Security Notice
Deployment
License

# Features
# FeatureDescription
🧠 AI-Powered NL→SQLConverts natural language questions to optimized SQL via Claude AI (claude-opus-4-5)
🔄 Multi-Dialect SupportGenerates queries for PostgreSQL, MySQL, SQLite, and Standard ANSI SQL
📋 Schema ContextPaste your own DB schema to get table-specific, accurate queries
💡 Logic ExplanationEvery query includes a 2–3 sentence explanation of its execution logic
📜 Query HistoryAll queries are persisted per user; soft-delete and bulk-clear supported
📊 History AnalyticsChart.js-powered activity chart on the History panel
🔐 Session AuthRegister/Login with bcrypt-hashed passwords and Flask server-side sessions
🌙 Dark / Light ThemeCSS-variable theming with localStorage persistence, applied before first paint
⚙️ User SettingsDialect default, auto-show schema panel, auto-format toggle, history export (JSON)
👤 Profile ManagementEdit display name and change password in-app🛡️ Soft DeleteHistory rows are never physically removed — hidden via timestamp or flag

# Tech Stack
# Backend
Flask 3.1 — web framework
Flask-SQLAlchemy 3.1 — ORM
Werkzeug — password hashing (generate_password_hash / check_password_hash)
Anthropic Python SDK 0.104 — Claude AI integration
Gunicorn 22 — WSGI server for production
# Database
PostgreSQL — primary database (hosted on Neon serverless Postgres)
psycopg2-binary — PostgreSQL adapter
# Frontend
Vanilla JavaScript (ES2020+), HTML5, CSS3 — no frontend framework
Chart.js 4.4 — history activity chart
Remix Icon 3.5 — icon library
Google Fonts — Syne · DM Mono · DM Sans

Project Structure
<img width="710" height="576" alt="image" src="https://github.com/user-attachments/assets/5f1086a5-d0ea-41d8-8352-887605f680d4" />

# Installation

# 1. Clone the repository
git clone https://github.com/<your-username>/neuralquery.git
cd neuralquery

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy the environment template and fill in your values
cp .env.example .env

Environment Variables

Create a .env file in the project root (see .env.example):

env# Flask
SECRET_KEY=your_strong_random_secret_key_here

# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Anthropic Claude API (optional — fallback SQL is used if omitted)
ANTHROPIC_API_KEY=sk-ant-...


Never commit .env to version control. It is listed in .gitignore.

If ANTHROPIC_API_KEY is not set, NeuralQuery automatically uses a built-in rule-based SQL generator as a fallback. Queries will still work but will be less intelligent than AI-generated ones.

Running the App

bash# Development server (debug mode)
python app.py

The app starts at http://127.0.0.1:5000.

For production:

bashgunicorn -w 4 -b 0.0.0.0:8000 app:app

The database tables are created automatically on first startup via db.create_all(). Any missing columns on existing tables are safely added through the auto-migration block in app.py.


# Usage 
Register — create an account at /register.
Log in at /login.
On the Dashboard, type a question in plain English, optionally paste your schema, choose a SQL dialect, and click Generate SQL.
Copy the generated query, view its logic explanation, or load a past query from the sidebar.
Manage your account and preferences under Profile and Settings.
# Example queries you can try:
Show me the top 5 customers by total order value this quarter
Count employees in each department, ordered by headcount
Find all orders placed in the last 30 days where the status is pending
Get the average salary by department, only for departments with more than 10 employees
# Deployment
NeuralQuery is compatible with any platform that supports Python + PostgreSQL:
Render — set environment variables in the dashboard, use gunicorn app:app as the start command.
Railway — provision a Postgres plugin, set DATABASE_URL automatically.
Fly.io — add a fly.toml and deploy with flyctl launch.
Neon — already used as the database backend; pair with any Python host.
