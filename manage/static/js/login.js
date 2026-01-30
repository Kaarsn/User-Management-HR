// Get CSRF token from cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Fetch CSRF token on page load
document.addEventListener('DOMContentLoaded', () => {
    fetch('/login', { method: 'GET' });
    
    // Toggle demo credentials
    const demoToggleBtn = document.querySelector('#demoCrednBtn');
    const demoInfo = document.getElementById('demoInfo');
    
    if (demoToggleBtn && demoInfo) {
        demoInfo.style.display = 'none';
        
        demoToggleBtn.addEventListener('click', (event) => {
            event.preventDefault();
            if (demoInfo.style.display === 'none') {
                demoInfo.style.display = 'block';
            } else {
                demoInfo.style.display = 'none';
            }
        });
    }

    // Optional: prefill demo credentials via URL (?demo=admin|user)
    try {
        const params = new URLSearchParams(window.location.search);
        const demo = (params.get('demo') || '').toLowerCase();
        const usernameEl = document.getElementById('username');
        const passwordEl = document.getElementById('password');

        if (usernameEl && passwordEl) {
            if (demo === 'admin') {
                usernameEl.value = 'admin';
                passwordEl.value = 'admin123';
                if (demoInfo) demoInfo.style.display = 'block';
            } else if (demo === 'user') {
                usernameEl.value = 'user1';
                passwordEl.value = 'user123';
                if (demoInfo) demoInfo.style.display = 'block';
            }
        }
    } catch {
        // ignore
    }
});

// Login functionality
const loginForm = document.getElementById('loginForm');
const errorAlert = document.getElementById('errorAlert');
const successAlert = document.getElementById('successAlert');
const demoInfo = document.getElementById('demoInfo');

const alertTimers = new WeakMap();

const showAlert = (element, html, timeout = 3000) => {
    if (!element) return;
    element.innerHTML = html;
    element.style.display = 'block';

    if (alertTimers.has(element)) {
        clearTimeout(alertTimers.get(element));
    }

    if (timeout) {
        const timerId = setTimeout(() => {
            element.style.display = 'none';
        }, timeout);
        alertTimers.set(element, timerId);
    }
};

// Login submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    
    // Disable button during submission
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';
    
    try {
        const csrftoken = getCookie('csrftoken');
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken || ''
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            if (errorAlert) {
                errorAlert.style.display = 'none';
            }
            showAlert(successAlert, '<i class="fas fa-check-circle"></i> Login successful! Redirecting...', 3000);
            
            setTimeout(() => {
                window.location.href = data.redirect;
            }, 3000);
        } else {
            if (successAlert) {
                successAlert.style.display = 'none';
            }
            showAlert(errorAlert, '<i class="fas fa-exclamation-circle"></i> ' + (data.error || 'Login failed'), 3000);
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    } catch (error) {
        console.error('Login error:', error);
        if (successAlert) {
            successAlert.style.display = 'none';
        }
        showAlert(errorAlert, '<i class="fas fa-exclamation-circle"></i> ' + error.message, 3000);
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }
});
