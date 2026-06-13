const loginForm = document.getElementById('loginForm');
const alertBox  = document.getElementById('alertBox');
const submitBtn = document.getElementById('submitBtn');

function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className   = `alert ${type}`;
    alertBox.style.display = 'block';
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Authorizing…';
    alertBox.style.display = 'none';

    const payload = {
        email:    document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value
    };

    try {
        const res  = await fetch('/login', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === 'success') {
            showAlert('Login successful! Redirecting…', 'success');
            setTimeout(() => window.location.href = '/dashboard', 800);
        } else {
            showAlert(data.message || 'Invalid credentials. Please try again.', 'error');
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Authorize Access';
        }
    } catch {
        showAlert('Connection error. Please check your network and retry.', 'error');
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Authorize Access';
    }
});
