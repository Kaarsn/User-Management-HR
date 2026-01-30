// Admin dashboard functionality
const errorAlert = document.getElementById('errorAlert');
const successAlert = document.getElementById('successAlert');
const addUserForm = document.getElementById('addUserForm');
const editUserForm = document.getElementById('editUserForm');
const usersTableBody = document.getElementById('usersTableBody');
const userCount = document.getElementById('userCount');
const payrollForm = document.getElementById('payrollForm');
const payrollHistoryBody = document.getElementById('payrollHistoryBody');
const payrollUsersTableBody = document.getElementById('payrollUsersTableBody');
const payrollUserCount = document.getElementById('payrollUserCount');
const payrollUserSelectRow = document.getElementById('payrollUserSelectRow');
const payrollUserSelect = document.getElementById('payrollUserSelect');

async function populatePayrollUserSelect() {
    if (!payrollUserSelect) return;
    payrollUserSelect.innerHTML = '<option value="">Select employee...</option>';

    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        const users = (data.users || []).filter(u => u.role === 'user');

        for (const user of users) {
            const opt = document.createElement('option');
            opt.value = String(user.id);
            opt.textContent = `${user.full_name} (@${user.username})`;
            payrollUserSelect.appendChild(opt);
        }
    } catch (error) {
        // keep default option only
        console.error('Failed to load users for payroll select:', error);
    }
}

if (payrollUserSelect) {
    payrollUserSelect.addEventListener('change', async () => {
        const selectedId = payrollUserSelect.value;
        const hiddenId = document.getElementById('payrollUserId');
        if (hiddenId) hiddenId.value = selectedId;
        if (selectedId) {
            await loadPayrollHistory(selectedId);
        }
    });
}

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

// Load users on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
    console.log('payrollUsersTableBody:', document.getElementById('payrollUsersTableBody'));
    loadUsers();

    // Prevent “stuck backdrop” if the payroll modal was shown more than once.
    const payrollModalEl = document.getElementById('payrollModal');
    if (payrollModalEl) {
        payrollModalEl.addEventListener('hidden.bs.modal', () => {
            // Only cleanup when no other modals are open
            if (document.querySelectorAll('.modal.show').length === 0) {
                document.body.classList.remove('modal-open');
                document.body.style.removeProperty('padding-right');
                document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            }
        });
    }
});

// Load payroll users for input section
window.loadPayrollUsers = async function() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (data.users) {
            renderPayrollUsersTable(data.users);
        }
    } catch (error) {
        console.error('Failed to load payroll users:', error);
    }
};

// Load all payroll history
window.loadAllPayrollHistory = async function() {
    const historyBody = document.getElementById('payrollHistoryTableBody');
    if (!historyBody) return;
    
    historyBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading...</td></tr>';
    
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (!data.users) return;
        
        historyBody.innerHTML = '';
        const users = data.users.filter(u => u.role === 'user');
        
        for (const user of users) {
            const history = Array.isArray(user.payroll_history) ? user.payroll_history : [];
            
            const row = document.createElement('tr');
            // Newest payroll is stored at index 0
            const latest = history.length > 0 ? history[0] : null;

            const currentStatus = (latest && latest.status) ? latest.status : 'pending';
            const statusLabel = currentStatus === 'in_progress' ? 'In Progress' : (currentStatus === 'transferred' ? 'Transferred' : 'Pending');
            const statusClass = currentStatus === 'transferred' ? 'success' : (currentStatus === 'in_progress' ? 'warning' : 'secondary');
            const statusDisabled = latest ? '' : 'disabled';
            
            row.innerHTML = `
                <td>
                    <strong>${user.full_name}</strong><br>
                    <small class="text-muted">${user.username}</small>
                </td>
                <td>${user.department || '-'}</td>
                <td>${latest ? latest.month : '<span class="text-muted">-</span>'}</td>
                <td><strong>${latest ? `Rp ${Number(latest.net_salary || 0).toLocaleString('id-ID')}` : '<span class="text-muted">No data</span>'}</strong></td>
                <td>
                    <div class="d-flex gap-2 align-items-center">
                        <select class="form-select form-select-sm" style="max-width: 160px;" ${statusDisabled}
                            onchange='window.updatePayrollStatus(${user.id}, "${latest ? latest.month : ''}", this.value)'>
                            <option value="pending" ${currentStatus === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="in_progress" ${currentStatus === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="transferred" ${currentStatus === 'transferred' ? 'selected' : ''}>Transferred</option>
                        </select>
                        <span class="badge bg-${statusClass}">${statusLabel}</span>
                    </div>
                </td>
                <td><span class="badge bg-info">${history.length} ${history.length === 1 ? 'record' : 'records'}</span></td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="openPayrollModal(${user.id})" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${latest ? `<a class="btn btn-sm btn-success" href="/api/payroll/${user.id}/pdf?month=${latest.month}" target="_blank" title="Download Latest PDF">
                        <i class="fas fa-file-pdf"></i>
                    </a>` : ''}
                </td>
            `;
            historyBody.appendChild(row);
        }
        
        if (users.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No users found</td></tr>';
        }
    } catch (error) {
        historyBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Failed to load payroll history</td></tr>';
    }
};

async function fetchPayrollRecordByMonth(userId, month) {
    try {
        const res = await fetch(`/api/payroll/${userId}/history`);
        const data = await res.json();
        const history = data.payroll_history || [];
        return history.find(r => r.month === month) || null;
    } catch {
        return null;
    }
}

window.updatePayrollStatus = async function(userId, month, status) {
    if (!userId || !month) return;
    try {
        const record = await fetchPayrollRecordByMonth(userId, month);
        if (!record) {
            showError('No payroll record found for status update');
            return;
        }

        const payload = {
            month,
            base_salary: record.base_salary ?? 0,
            allowances: record.allowances ?? 0,
            deductions: record.deductions ?? 0,
            notes: record.notes ?? '',
            status
        };

        const response = await fetch(`/api/payroll/${userId}/upsert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!data.success) {
            showError(data.error || 'Failed to update payroll status');
            return;
        }

        showSuccess('Payroll status updated');
        if (typeof window.loadPayrollUsers === 'function') window.loadPayrollUsers();
        if (typeof window.loadAllPayrollHistory === 'function') window.loadAllPayrollHistory();
        if (typeof window.loadPDFGenerationList === 'function') window.loadPDFGenerationList();
    } catch (error) {
        showError('Failed to update payroll status: ' + error.message);
    }
};

// Load PDF generation list
window.loadPDFGenerationList = async function() {
    const pdfBody = document.getElementById('generatePDFTableBody');
    if (!pdfBody) return;
    
    pdfBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading...</td></tr>';
    
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (!data.users) return;
        
        pdfBody.innerHTML = '';
        const users = data.users.filter(u => u.role === 'user');
        
        for (const user of users) {
            const history = Array.isArray(user.payroll_history) ? user.payroll_history : [];
            
            const row = document.createElement('tr');
            const latest = history.length > 0 ? history[0] : null;

            const currentStatus = (latest && latest.status) ? latest.status : 'pending';
            const statusLabel = currentStatus === 'in_progress' ? 'In Progress' : (currentStatus === 'transferred' ? 'Transferred' : 'Pending');
            const statusClass = currentStatus === 'transferred' ? 'success' : (currentStatus === 'in_progress' ? 'warning' : 'secondary');
            const statusDisabled = latest ? '' : 'disabled';
            
            row.innerHTML = `
                <td><strong>${user.full_name}</strong><br><small class="text-muted">${user.username}</small></td>
                <td>${latest ? latest.month : 'No data'}</td>
                <td>${latest ? `Rp ${Number(latest.net_salary || 0).toLocaleString()}` : '-'}</td>
                <td>
                    <div class="d-flex gap-2 align-items-center">
                        <select class="form-select form-select-sm" style="max-width: 160px;" ${statusDisabled}
                            onchange='window.updatePayrollStatus(${user.id}, "${latest ? latest.month : ''}", this.value)'>
                            <option value="pending" ${currentStatus === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="in_progress" ${currentStatus === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="transferred" ${currentStatus === 'transferred' ? 'selected' : ''}>Transferred</option>
                        </select>
                        <span class="badge bg-${statusClass}">${statusLabel}</span>
                    </div>
                </td>
                <td>
                    ${latest ? `
                        <a class="btn btn-sm btn-primary" href="/api/payroll/${user.id}/pdf?month=${latest.month}" target="_blank">
                            <i class="fas fa-file-pdf"></i> Generate PDF
                        </a>
                    ` : '<span class="text-muted">No payroll data</span>'}
                </td>
            `;
            pdfBody.appendChild(row);
        }
    } catch (error) {
        pdfBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load PDF generation list</td></tr>';
    }
};

if (payrollForm) {
    payrollForm.addEventListener('submit', async (e) => {
        window.__payrollFormBound = true;
        e.preventDefault();

        const userId = (document.getElementById('payrollUserId').value || (payrollUserSelect ? payrollUserSelect.value : '')).trim();
        if (!userId) {
            showError('Please select an employee for payroll.');
            return;
        }
        const payload = {
            month: document.getElementById('payrollMonth').value,
            base_salary: document.getElementById('payrollBase').value,
            allowances: document.getElementById('payrollAllowances').value,
            deductions: document.getElementById('payrollDeductions').value,
            notes: document.getElementById('payrollNotes').value
        };

        try {
            const response = await fetch(`/api/payroll/${userId}/upsert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (data.success) {
                showSuccess('Payroll updated successfully!');
                await loadPayrollHistory(userId);
                // Refresh input table to show updated dates
                if (typeof window.loadPayrollUsers === 'function') {
                    window.loadPayrollUsers();
                }
                // Refresh history view if it's currently visible
                const historySection = document.getElementById('payrollHistorySection');
                if (historySection && historySection.style.display !== 'none') {
                    if (typeof window.loadAllPayrollHistory === 'function') {
                        window.loadAllPayrollHistory();
                    }
                }
                payrollForm.reset();
            } else {
                showError(data.error || 'Failed to save payroll');
            }
        } catch (error) {
            showError('Failed to save payroll: ' + error.message);
        }
    });
}

// Add user form submission
addUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userData = {
        full_name: document.getElementById('addFullName').value,
        username: document.getElementById('addUsername').value,
        email: document.getElementById('addEmail').value,
        password: document.getElementById('addPassword').value,
        role: document.getElementById('addRole').value,
        department: document.getElementById('addDepartment').value,
        position: document.getElementById('addPosition').value,
        phone: document.getElementById('addPhone').value,
        emergency_contact_name: document.getElementById('addEmergencyName').value,
        emergency_contact_phone: document.getElementById('addEmergencyPhone').value
    };
    
    try {
        const response = await fetch('/api/users/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('User created successfully!');
            addUserForm.reset();
            const modalEl = document.getElementById('addUserModal');
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                modal.hide();
            }
            loadUsers();
            // Always refresh payroll tables so they're updated when viewed
            if (typeof window.loadPayrollUsers === 'function') {
                window.loadPayrollUsers();
            }
            if (typeof window.loadAllPayrollHistory === 'function') {
                window.loadAllPayrollHistory();
            }
            if (typeof window.loadPDFGenerationList === 'function') {
                window.loadPDFGenerationList();
            }
        } else {
            showError(data.error || 'Failed to create user');
        }
    } catch (error) {
        showError(error.message);
    }
});

// Edit user form submission
editUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const userData = {
        full_name: document.getElementById('editFullName').value,
        email: document.getElementById('editEmail').value,
        role: document.getElementById('editRole').value,
        is_active: document.getElementById('editStatus').value === 'true',
        department: document.getElementById('editDepartment').value,
        position: document.getElementById('editPosition').value,
        phone: document.getElementById('editPhone').value,
        emergency_contact_name: document.getElementById('editEmergencyName').value,
        emergency_contact_phone: document.getElementById('editEmergencyPhone').value
    };
    
    try {
        const response = await fetch(`/api/users/${userId}/update`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Handle profile picture upload if provided
            const profilePicFile = document.getElementById('editProfilePicture').files[0];
            if (profilePicFile) {
                await uploadProfilePicture(userId, profilePicFile);
            } else {
                showSuccess('User updated successfully!');
                editUserForm.reset();
                const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
                modal.hide();
                loadUsers();
                // Always refresh payroll tables
                if (typeof window.loadPayrollUsers === 'function') {
                    window.loadPayrollUsers();
                }
                if (typeof window.loadAllPayrollHistory === 'function') {
                    window.loadAllPayrollHistory();
                }
                if (typeof window.loadPDFGenerationList === 'function') {
                    window.loadPDFGenerationList();
                }
            }
        } else {
            showError(data.error || 'Failed to update user');
        }
    } catch (error) {
        showError(error.message);
    }
});

// Upload profile picture
async function uploadProfilePicture(userId, file) {
    const formData = new FormData();
    formData.append('profile_picture', file);
    
    try {
        const response = await fetch(`/api/users/${userId}/upload-picture`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('User updated successfully!');
            editUserForm.reset();
            const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
            modal.hide();
            loadUsers();
            // Always refresh payroll tables
            if (typeof window.loadPayrollUsers === 'function') {
                window.loadPayrollUsers();
            }
            if (typeof window.loadAllPayrollHistory === 'function') {
                window.loadAllPayrollHistory();
            }
            if (typeof window.loadPDFGenerationList === 'function') {
                window.loadPDFGenerationList();
            }
        } else {
            showError(data.error || 'Failed to upload profile picture');
        }
    } catch (error) {
        showError('Upload error: ' + error.message);
    }
}

// Load all users
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (data.users) {
            renderUsersTable(data.users);
            userCount.textContent = data.users.length;
            renderPayrollUsersTable(data.users);
        }
    } catch (error) {
        showError('Failed to load users: ' + error.message);
    }
}

// Render users in table
function renderUsersTable(users) {
    usersTableBody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        const statusBadge = user.is_active 
            ? '<span class="badge bg-success">Active</span>' 
            : '<span class="badge bg-danger">Inactive</span>';
        const roleBadge = user.role === 'admin' 
            ? '<span class="badge badge-admin" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">Admin</span>' 
            : '<span class="badge badge-user">User</span>';
        
        const profilePic = user.profile_picture 
            ? `<img src="${user.profile_picture}" alt="Profile" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto;">`
            : '<i class="fas fa-user-circle" style="font-size: 40px; color: #667eea;"></i>';
        
        row.innerHTML = `
            <td style="text-align: center; vertical-align: middle;">${profilePic}</td>
            <td>#${user.id}</td>
            <td>${user.full_name}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-info btn-sm-custom" onclick="editUser(${user.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-secondary btn-sm-custom" onclick="openPayrollModal(${user.id})">
                    <i class="fas fa-money-check"></i> Payroll
                </button>
                <button class="btn btn-sm btn-danger btn-sm-custom" onclick="deleteUser(${user.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        
        usersTableBody.appendChild(row);
    });
}

// Edit user
async function editUser(userId) {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        const user = data.users.find(u => u.id === userId);
        
        if (user) {
            document.getElementById('editUserId').value = user.id;
            document.getElementById('editFullName').value = user.full_name;
            document.getElementById('editEmail').value = user.email;
            document.getElementById('editRole').value = user.role;
            document.getElementById('editStatus').value = user.is_active;
            document.getElementById('editDepartment').value = user.department || '';
            document.getElementById('editPosition').value = user.position || '';
            document.getElementById('editPhone').value = user.phone || '';
            document.getElementById('editEmergencyName').value = user.emergency_contact_name || '';
            document.getElementById('editEmergencyPhone').value = user.emergency_contact_phone || '';
            
            // Handle profile picture
            const profilePic = document.getElementById('editUserProfilePic');
            const defaultIcon = document.getElementById('editUserDefaultIcon');
            if (user.profile_picture) {
                profilePic.src = user.profile_picture;
                profilePic.style.display = 'block';
                defaultIcon.style.display = 'none';
            } else {
                profilePic.style.display = 'none';
                defaultIcon.style.display = 'inline-block';
            }
            
            // Reset file input
            document.getElementById('editProfilePicture').value = '';
            
            const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
            modal.show();
        }
    } catch (error) {
        showError('Failed to load user data: ' + error.message);
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${userId}/delete`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('User deleted successfully!');
            loadUsers();
            // Always refresh payroll tables
            if (typeof window.loadPayrollUsers === 'function') {
                window.loadPayrollUsers();
            }
            if (typeof window.loadAllPayrollHistory === 'function') {
                window.loadAllPayrollHistory();
            }
            if (typeof window.loadPDFGenerationList === 'function') {
                window.loadPDFGenerationList();
            }
        } else {
            showError(data.error || 'Failed to delete user');
        }
    } catch (error) {
        showError('Error: ' + error.message);
    }
}

// Show success message
function showSuccess(message) {
    successAlert.style.display = 'block';
    successAlert.innerHTML = '<i class="fas fa-check-circle"></i> ' + message;
    setTimeout(() => {
        successAlert.style.display = 'none';
    }, 5000);
}

// Show error message
function showError(message) {
    errorAlert.style.display = 'block';
    errorAlert.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + message;
    setTimeout(() => {
        errorAlert.style.display = 'none';
    }, 5000);
}
// Store directory data for searching
let directoryData = [];

// View switching is also defined in admin.html.
// Don't override those functions here (otherwise payroll pages can look like the Users view).
if (typeof window.showUserDirectory !== 'function') {
    window.showUserDirectory = function () {
        const usersCard = document.querySelector('.card');
        const directoryCard = document.getElementById('directoryCard');
        const payrollManagement = document.getElementById('payrollManagement');
        
        // Hide users table and show directory
        if (usersCard) usersCard.style.display = 'none';
        if (directoryCard) directoryCard.style.display = 'block';
        if (payrollManagement) payrollManagement.style.display = 'none';
        
        // Fetch users and populate directory
        fetch('/api/users')
            .then(response => response.json())
            .then(data => {
                if (data.users) {
                    directoryData = data.users;
                    renderDirectoryTable(data.users);
                    
                    // Setup search functionality
                    const searchInput = document.getElementById('directorySearch');
                    if (searchInput) {
                        searchInput.value = '';
                        searchInput.addEventListener('input', searchDirectory);
                    }
                }
            })
            .catch(error => showError('Failed to load directory: ' + error.message));

        return false;
    };
}

// Search directory
function searchDirectory() {
    const searchTerm = document.getElementById('directorySearch').value.toLowerCase();
    
    if (!searchTerm) {
        renderDirectoryTable(directoryData);
        return;
    }
    
    const filteredUsers = directoryData.filter(user => {
        const name = (user.full_name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const phone = (user.phone || '').toLowerCase();
        const department = (user.department || '').toLowerCase();
        const position = (user.position || '').toLowerCase();
        const emergencyContact = (user.emergency_contact_name || '').toLowerCase();
        
        return (
            name.includes(searchTerm) ||
            email.includes(searchTerm) ||
            phone.includes(searchTerm) ||
            department.includes(searchTerm) ||
            position.includes(searchTerm) ||
            emergencyContact.includes(searchTerm)
        );
    });
    
    renderDirectoryTable(filteredUsers);
}

// Render directory table
function renderDirectoryTable(users) {
    const directoryTableBody = document.getElementById('directoryTableBody');
    directoryTableBody.innerHTML = '';
    
    if (users.length === 0) {
        directoryTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No users found</td></tr>';
        return;
    }
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${user.full_name}</strong></td>
            <td>${user.department || '-'}</td>
            <td>${user.position || '-'}</td>
            <td>${user.email}</td>
            <td>${user.phone || '-'}</td>
            <td>
                ${user.emergency_contact_name ? `${user.emergency_contact_name}<br><small class="text-muted">${user.emergency_contact_phone}</small>` : '-'}
            </td>
            <td>
                <button class="btn btn-sm btn-info" onclick="editUser(${user.id})">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        directoryTableBody.appendChild(row);
    });
}

// Show user management table
if (typeof window.showUserManagement !== 'function') {
    window.showUserManagement = function () {
        const usersCard = document.getElementById('usersCard');
        const directoryCard = document.getElementById('directoryCard');
        const payrollManagement = document.getElementById('payrollManagement');
        
        if (usersCard) usersCard.style.display = 'block';
        if (directoryCard) directoryCard.style.display = 'none';
        if (payrollManagement) payrollManagement.style.display = 'none';

        return false;
    };
}

// Show payroll management table
if (typeof window.showPayrollManagement !== 'function') {
    window.showPayrollManagement = function () {
        const usersCard = document.getElementById('usersCard');
        const directoryCard = document.getElementById('directoryCard');
        const payrollManagement = document.getElementById('payrollManagement');

        if (usersCard) usersCard.style.display = 'none';
        if (directoryCard) directoryCard.style.display = 'none';
        if (payrollManagement) payrollManagement.style.display = 'block';

        return false;
    };
}

// Open payroll modal
window.openPayrollModal = async function (userId) {
    // per-user flow (from table): hide employee selector
    if (payrollUserSelectRow) payrollUserSelectRow.style.display = 'none';
    if (payrollUserSelect) payrollUserSelect.value = '';
    document.getElementById('payrollUserId').value = userId;
    document.getElementById('payrollMonth').value = '';
    document.getElementById('payrollBase').value = '';
    document.getElementById('payrollAllowances').value = '0';
    document.getElementById('payrollDeductions').value = '0';
    document.getElementById('payrollNotes').value = '';

    await loadPayrollHistory(userId);

    const modalEl = document.getElementById('payrollModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
};

// payroll-only flow (from header button): show employee selector
window.openPayrollCreateModal = async function () {
    const hiddenId = document.getElementById('payrollUserId');
    if (hiddenId) hiddenId.value = '';

    if (payrollUserSelectRow) payrollUserSelectRow.style.display = 'block';
    await populatePayrollUserSelect();

    document.getElementById('payrollMonth').value = '';
    document.getElementById('payrollBase').value = '';
    document.getElementById('payrollAllowances').value = '0';
    document.getElementById('payrollDeductions').value = '0';
    document.getElementById('payrollNotes').value = '';

    if (payrollHistoryBody) {
        payrollHistoryBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Select an employee to view history</td></tr>';
    }

    const modalEl = document.getElementById('payrollModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
};

async function loadPayrollHistory(userId) {
    if (!payrollHistoryBody) return;

    payrollHistoryBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading...</td></tr>';
    try {
        const response = await fetch(`/api/payroll/${userId}/history`);
        const data = await response.json();
        const history = data.payroll_history || [];

        if (history.length === 0) {
            payrollHistoryBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No payroll records</td></tr>';
            return;
        }

        payrollHistoryBody.innerHTML = '';
        history.forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${record.month}</td>
                <td>Rp ${Number(record.base_salary || 0).toLocaleString()}</td>
                <td>Rp ${Number(record.allowances || 0).toLocaleString()}</td>
                <td>Rp ${Number(record.deductions || 0).toLocaleString()}</td>
                <td><strong>Rp ${Number(record.net_salary || 0).toLocaleString()}</strong></td>
                <td>
                    <a class="btn btn-sm btn-outline-primary" href="/api/payroll/${userId}/pdf?month=${record.month}" target="_blank">
                        <i class="fas fa-file-pdf"></i>
                    </a>
                </td>
            `;
            payrollHistoryBody.appendChild(row);
        });
    } catch (error) {
        payrollHistoryBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load payroll history</td></tr>';
    }
}

// Render payroll users table
function renderPayrollUsersTable(users) {
    if (!payrollUsersTableBody) return;
    payrollUsersTableBody.innerHTML = '';

    const userList = users.filter(u => u.role === 'user');
    if (payrollUserCount) {
        payrollUserCount.textContent = userList.length;
    }

    if (userList.length === 0) {
        payrollUsersTableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No users found</td></tr>';
        return;
    }

    userList.forEach(user => {
        const latest = user.payroll_history && user.payroll_history.length > 0 ? user.payroll_history[0] : null;
        const lastUpdated = latest && latest.updated_at
            ? new Date(latest.updated_at).toLocaleDateString('id-ID')
            : '<span class="text-muted">Never</span>';

        const payrollAmount = latest
            ? `Rp ${Number(latest.net_salary || 0).toLocaleString('id-ID')}`
            : '<span class="text-muted">-</span>';

        const currentStatus = (latest && latest.status) ? latest.status : 'pending';
        const statusLabel = currentStatus === 'in_progress' ? 'In Progress' : (currentStatus === 'transferred' ? 'Transferred' : 'Pending');
        const statusClass = currentStatus === 'transferred' ? 'success' : (currentStatus === 'in_progress' ? 'warning' : 'secondary');
        const statusDisabled = latest ? '' : 'disabled';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>#${user.id}</td>
            <td>${user.full_name}</td>
            <td>${user.username}</td>
            <td>${user.department || '-'}</td>
            <td>${user.position || '-'}</td>
            <td>${payrollAmount}<br><small class="text-muted">${latest ? latest.month : ''}</small></td>
            <td>${lastUpdated}</td>
            <td>
                <div class="d-flex gap-2 align-items-center">
                    <select class="form-select form-select-sm" style="max-width: 160px;" ${statusDisabled}
                        onchange='window.updatePayrollStatus(${user.id}, "${latest ? latest.month : ''}", this.value)'>
                        <option value="pending" ${currentStatus === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="in_progress" ${currentStatus === 'in_progress' ? 'selected' : ''}>In Progress</option>
                        <option value="transferred" ${currentStatus === 'transferred' ? 'selected' : ''}>Transferred</option>
                    </select>
                    <span class="badge bg-${statusClass}">${statusLabel}</span>
                    <button class="btn btn-sm btn-primary" onclick="openPayrollModal(${user.id})">
                        <i class="fas fa-edit"></i> Payroll
                    </button>
                </div>
            </td>
        `;
        payrollUsersTableBody.appendChild(row);
    });
}