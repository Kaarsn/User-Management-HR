import os
from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-default-key-change-this')

# Vercel sets VERCEL=1 and VERCEL_URL in production.
IS_VERCEL = bool(os.environ.get('VERCEL') or os.environ.get('VERCEL_URL'))

DEBUG = config('DEBUG', default=True, cast=bool)

# Hosts
if IS_VERCEL:
    ALLOWED_HOSTS = ['*']
elif DEBUG:
    ALLOWED_HOSTS = ['localhost', '127.0.0.1', '*.localhost']
else:
    ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'manage',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'manage' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {}

# Sessions
# - Local dev: cookie sessions (no DB, no filesystem)
# - Vercel: cookie sessions (serverless-friendly)
# - Other prod: locmem cache sessions (simple, but per-process)
if DEBUG or IS_VERCEL:
    SESSION_ENGINE = 'django.contrib.sessions.backends.signed_cookies'
else:
    SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'manage' / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Vercel quick-deploy: allow serving static via finders (no collectstatic required).
if IS_VERCEL:
    WHITENOISE_USE_FINDERS = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

SESSION_COOKIE_AGE = 86400
SESSION_SAVE_EVERY_REQUEST = False

# Email (development)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL = 'no-reply@user-management.local'

# Security settings for production
if not DEBUG:
    # Don't enforce SSL redirect on Vercel (they handle it)
    SECURE_SSL_REDIRECT = False
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True

if not DEBUG:
    # Static files - WhiteNoise configuration (production)
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# On Vercel, prefer non-manifest storage to avoid collectstatic issues for quick trials.
if IS_VERCEL:
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
