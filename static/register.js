const alertBox      = document.getElementById('alertBox');
const submitBtn     = document.getElementById('submitBtn');
const passwordInput = document.getElementById('password');
const strengthFill  = document.getElementById('strengthFill');
const strengthLabel = document.getElementById('strengthLabel');

const strengthLevels = [
    { label: 'Too short',  color: '#ef4444', w: '20%' },
    { label: 'Weak',       color: '#ef4444', w: '35%' },
    { label: 'Fair',       color: '#f59e0b', w: '60%' },
    { label: 'Strong',     color: '#3b82f6', w: '80%' },
    { label: 'Very strong',color: '#10b981', w: '100%' }
];

function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className   = `alert ${type}`;
    alertBox.style.display = 'block';
}

passwordInput.addEventListener('input', () => {
    const val = passwordInput.value;
    if (!val) { strengthFill.style.width = '0%'; strengthLabel.textContent = ''; return; }
    let score = 0;
    if (val.length >= 8)           score++;
    if (val.length >= 12)          score++;
    if (/[A-Z]/.test(val))         score++;
    if (/[0-9]/.test(val))         score++;
    if (/[^A-Za-z0-9]/.test(val))  score++;
    const idx = Math.min(score, 4);
    strengthFill.style.width      = strengthLevels[idx].w;
    strengthFill.style.background = strengthLevels[idx].color;
    strengthLabel.textContent     = strengthLevels[idx].label;
    strengthLabel.style.color     = strengthLevels[idx].color;
});

document.getElementById('regForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.style.display = 'none';

    const password = document.getElementById('password').value;
    const confirm  = document.getElementById('confirm_password').value;

    if (password.length < 8) {
        showAlert('Password must be at least 8 characters long.', 'error');
        return;
    }
    if (password !== confirm) {
        showAlert('Passwords do not match. Please re-enter.', 'error');
        return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Creating Account…';

    const payload = {
        fullname: document.getElementById('fullname').value.trim(),
        email:    document.getElementById('email').value.trim(),
        password
    };

    try {
        const res  = await fetch('/register', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === 'success') {
            showAlert('Account created successfully! Redirecting to login…', 'success');
            setTimeout(() => window.location.href = '/login', 1200);
        } else {
            showAlert(data.message || 'Registration failed. Please try again.', 'error');
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Initialize Registration';
        }
    } catch {
        showAlert('Connection error. Please check your network and retry.', 'error');
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Initialize Registration';
    }
});
