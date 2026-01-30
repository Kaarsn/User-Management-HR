import json
import os
from datetime import datetime
from pathlib import Path

# Path to the users database
SEED_DB_PATH = Path(__file__).parent / 'data' / 'users.json'

def _is_serverless_env() -> bool:
    return bool(os.environ.get('VERCEL') or os.environ.get('VERCEL_URL') or os.environ.get('AWS_LAMBDA_FUNCTION_NAME'))

def _get_db_path() -> Path:
    # Allow overrides (useful for testing)
    override = os.environ.get('UMD_DB_PATH')
    if override:
        return Path(override)

    # Serverless platforms have a read-only filesystem except /tmp
    if _is_serverless_env():
        return Path('/tmp') / 'users.json'

    return SEED_DB_PATH

DB_PATH = _get_db_path()

def _ensure_db_exists() -> None:
    if DB_PATH.exists():
        return

    # If we're on serverless, copy the seed db into /tmp once per cold start
    if DB_PATH.parent and not DB_PATH.parent.exists():
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    if SEED_DB_PATH.exists():
        DB_PATH.write_text(SEED_DB_PATH.read_text(encoding='utf-8'), encoding='utf-8')
    else:
        DB_PATH.write_text(json.dumps({'users': []}, indent=2), encoding='utf-8')

class Database:
    """Local JSON database handler"""

    @staticmethod
    def _normalize_user(user):
        if 'email_verified' not in user:
            user['email_verified'] = True
        if 'verification_token' not in user:
            user['verification_token'] = None
        if 'verification_sent_at' not in user:
            user['verification_sent_at'] = None
        if 'verification_expires_at' not in user:
            user['verification_expires_at'] = None
        if 'profile_picture' not in user:
            user['profile_picture'] = None
        if 'department' not in user:
            user['department'] = ''
        if 'position' not in user:
            user['position'] = ''
        if 'phone' not in user:
            user['phone'] = ''
        if 'emergency_contact_name' not in user:
            user['emergency_contact_name'] = ''
        if 'emergency_contact_phone' not in user:
            user['emergency_contact_phone'] = ''
        if 'payroll_history' not in user:
            user['payroll_history'] = []
    
    @staticmethod
    def load():
        """Load all users from JSON file"""
        _ensure_db_exists()
        if DB_PATH.exists():
            with open(DB_PATH, 'r') as f:
                return json.load(f)
        return {'users': []}
    
    @staticmethod
    def save(data):
        """Save data to JSON file"""
        _ensure_db_exists()
        with open(DB_PATH, 'w') as f:
            json.dump(data, f, indent=2)
    
    @staticmethod
    def get_all_users():
        """Get all users"""
        data = Database.load()
        users = data.get('users', [])
        
        # Normalize users - ensure all required fields exist
        for user in users:
            Database._normalize_user(user)
        
        return users
    
    @staticmethod
    def get_user_by_id(user_id):
        """Get user by ID"""
        users = Database.get_all_users()
        return next((u for u in users if u['id'] == user_id), None)
    
    @staticmethod
    def get_user_by_username(username):
        """Get user by username"""
        users = Database.get_all_users()
        return next((u for u in users if u['username'] == username), None)
    
    @staticmethod
    def get_user_by_email(email):
        """Get user by email"""
        users = Database.get_all_users()
        return next((u for u in users if u['email'] == email), None)

    @staticmethod
    def get_user_by_verification_token(token):
        """Get user by email verification token"""
        users = Database.get_all_users()
        return next((u for u in users if u.get('verification_token') == token), None)
    
    @staticmethod
    def create_user(
        username,
        email,
        password,
        full_name,
        role='user',
        department=None,
        position=None,
        phone=None,
        emergency_contact_name=None,
        emergency_contact_phone=None,
    ):
        """Create a new user"""
        data = Database.load()
        users = data.get('users', [])
        
        # Check if user exists
        if Database.get_user_by_username(username):
            return None, 'Username already exists'
        
        if Database.get_user_by_email(email):
            return None, 'Email already exists'
        
        new_user = {
            'id': max([u['id'] for u in users], default=0) + 1,
            'username': username,
            'email': email,
            'password': password,
            'role': role,
            'full_name': full_name,
            'created_at': datetime.now().isoformat(),
            'is_active': True,
            'email_verified': False,
            'verification_token': None,
            'verification_sent_at': None,
            'verification_expires_at': None,
            'profile_picture': None,
            'department': department or '',
            'position': position or '',
            'phone': phone or '',
            'emergency_contact_name': emergency_contact_name or '',
            'emergency_contact_phone': emergency_contact_phone or ''
        }
        
        users.append(new_user)
        data['users'] = users
        Database.save(data)
        return new_user, None
    
    @staticmethod
    def update_user(user_id, **kwargs):
        """Update user information"""
        data = Database.load()
        users = data.get('users', [])
        
        for user in users:
            if user['id'] == user_id:
                # Update existing fields or add new fields
                user.update(kwargs)
                Database._normalize_user(user)
                Database.save(data)
                return user, None
        
        return None, 'User not found'
    
    @staticmethod
    def delete_user(user_id):
        """Delete a user"""
        data = Database.load()
        users = data.get('users', [])
        
        original_count = len(users)
        users = [u for u in users if u['id'] != user_id]
        
        if len(users) == original_count:
            return None, 'User not found'
        
        data['users'] = users
        Database.save(data)
        return True, None
    
    @staticmethod
    def authenticate(username, password):
        """Authenticate user"""
        user = Database.get_user_by_username(username)
        if user and user['password'] == password and user['is_active']:
            if user.get('email_verified', True) is False:
                return None, 'Email not verified. Please check your inbox.'
            return user, None
        return None, 'Invalid credentials'

    @staticmethod
    def get_payroll_history(user_id):
        """Get payroll history for a user"""
        user = Database.get_user_by_id(user_id)
        if not user:
            return None, 'User not found'
        history = user.get('payroll_history') or []
        return history, None

    @staticmethod
    def upsert_payroll_record(user_id, record):
        """Add or update payroll record for a user by month"""
        data = Database.load()
        users = data.get('users', [])

        for user in users:
            if user['id'] == user_id:
                Database._normalize_user(user)
                history = user.get('payroll_history') or []
                history = [r for r in history if r.get('month') != record.get('month')]
                history.insert(0, record)
                user['payroll_history'] = history
                Database.save(data)
                return record, None

        return None, 'User not found'

    @staticmethod
    def get_payroll_record(user_id, month):
        """Get payroll record for a user by month"""
        history, error = Database.get_payroll_history(user_id)
        if error:
            return None, error
        return next((r for r in history if r.get('month') == month), None), None
