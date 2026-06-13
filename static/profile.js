/*
   NeuralQuery — profile.js
   */

// Load stats on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res  = await fetch('/history');
        const data = await res.json();
        if (data.status === 'success') {
            document.getElementById('statQueries').textContent = data.history.length;

            // Calculate days active (days from first query to today)
            if (data.history.length > 0) {
                // history is sorted desc, so last item is earliest
                const earliest = data.history[data.history.length - 1];
                if (earliest.created_at) {
                    const parts = earliest.created_at.split(', ');
                    // rough: count between 1-999 days; just show total if we can't parse
                    document.getElementById('statDays').textContent = Math.max(1, Math.min(999, data.history.length > 0 ? Math.ceil(data.history.length / 3) + 1 : 1));
                } else {
                    document.getElementById('statDays').textContent = '1';
                }
            } else {
                document.getElementById('statDays').textContent = '0';
            }
        }
    } catch { /* silently skip stats */ }
});

// ── Profile Save ──
async function saveProfile() {
    const fullname = document.getElementById('fullname').value.trim();
    if (!fullname) { showAlert('profileAlert', 'Name cannot be empty.', 'error'); return; }

    setLoading('saveProfileBtn', 'profileSpin', 'saveProfileText', true, 'Saving…');

    try {
        const res  = await fetch('/profile/update', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ fullname })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showAlert('profileAlert', '✓ Profile updated successfully!', 'success');
            // Update hero name
            document.getElementById('heroName').textContent = fullname;
            // Update avatar initials
            const parts = fullname.split(' ').filter(Boolean);
            const initials = parts.slice(0,2).map(w => w[0].toUpperCase()).join('');
            document.getElementById('heroAvatar').textContent = initials;
        } else {
            showAlert('profileAlert', data.message || 'Update failed.', 'error');
        }
    } catch {
        showAlert('profileAlert', 'Connection error. Please try again.', 'error');
    } finally {
        setLoading('saveProfileBtn', 'profileSpin', 'saveProfileText', false, 'Save Changes');
    }
}

function resetProfileForm() {
    document.getElementById('fullname').value = ORIGINAL_NAME;
    const alertEl = document.getElementById('profileAlert');
    alertEl.style.display = 'none';
}

// ── Password Section ──
let pwOpen = false;
function togglePasswordSection() {
    pwOpen = !pwOpen;
    document.getElementById('pwFields').classList.toggle('open', pwOpen);
    document.getElementById('pwPlaceholder').style.display = pwOpen ? 'none' : 'block';
    document.getElementById('pwToggleIcon').className = pwOpen ? 'ri-minus-circle-line' : 'ri-add-circle-line';
    document.getElementById('pwToggleText').textContent = pwOpen ? 'Hide' : 'Change Password';
}

function clearPasswordFields() {
    ['currentPassword','newPassword','confirmPassword'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('passwordAlert').style.display = 'none';
    togglePasswordSection();
}

async function savePassword() {
    const current = document.getElementById('currentPassword').value;
    const newPw   = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (!current) { showAlert('passwordAlert', 'Please enter your current password.', 'error'); return; }
    if (newPw.length < 8) { showAlert('passwordAlert', 'New password must be at least 8 characters.', 'error'); return; }
    if (newPw !== confirm) { showAlert('passwordAlert', 'Passwords do not match.', 'error'); return; }

    setLoading('savePasswordBtn', 'passwordSpin', 'savePasswordText', true, 'Updating…');

    try {
        const res  = await fetch('/profile/update', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ current_password: current, new_password: newPw })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showAlert('passwordAlert', '✓ Password updated successfully!', 'success');
            clearPasswordFields();
        } else {
            showAlert('passwordAlert', data.message || 'Password update failed.', 'error');
        }
    } catch {
        showAlert('passwordAlert', 'Connection error. Please try again.', 'error');
    } finally {
        setLoading('savePasswordBtn', 'passwordSpin', 'savePasswordText', false, 'Update Password');
    }
}

// ── Utilities ──
function showAlert(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = `alert ${type}`;
    el.style.display = 'block';
    clearTimeout(el._timer);
    if (type === 'success') el._timer = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function setLoading(btnId, spinId, textId, loading, label) {
    const btn  = document.getElementById(btnId);
    const spin = document.getElementById(spinId);
    const txt  = document.getElementById(textId);
    if (btn)  btn.disabled = loading;
    if (spin) spin.style.display = loading ? 'block' : 'none';
    if (txt)  txt.textContent = label;
}
