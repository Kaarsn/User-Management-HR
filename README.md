# User Management Dashboard

A lightweight Django app for user management with **Admin/User roles**, a **modern UI** (Bootstrap + Tailwind + custom CSS), and a **local JSON file** as the data store.

## Highlights

- Authentication + sessions
- Admin panel: CRUD users, status/roles, user directory
- Payroll management: input payroll, history, and PDF slip generation
- User dashboard: profile + activity panels
- Local JSON storage (no database setup required)

## Quickstart

### 1) Create a virtual environment

Windows (PowerShell):

```bash
python -m venv .venv
.venv\Scripts\activate
```

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2) Install dependencies

```bash
pip install -r requirements.txt
```

### 3) Configure environment variables

Create a `.env` file in the project root:

```dotenv
DEBUG=True
SECRET_KEY=django-insecure-dev-key-for-local-testing-only
```

### 4) Run the server

```bash
python manage.py runserver
```

Open: `http://127.0.0.1:8000`

## Demo credentials

- Admin: `admin` / `admin123`
- User: `user1` / `user123`

Tip: you can auto-fill the login form:

- `http://127.0.0.1:8000/login?demo=admin`
- `http://127.0.0.1:8000/login?demo=user`

## Pages

- `/` – Landing page
- `/login` – Login
- `/dashboard` – User dashboard
- `/admin` – Admin panel

## API (selected)

Authentication:

- `POST /login`
- `GET /logout`

Admin-only user management:

- `GET /api/users`
- `POST /api/users/create`
- `PUT /api/users/<id>/update`
- `DELETE /api/users/<id>/delete`

## Project structure

```
.
├── config/                 # Django project settings/urls/wsgi
├── manage/                 # Main app
│   ├── data/               # Local JSON data
│   │   └── users.json
│   ├── static/
│   │   ├── css/            # Custom styling
│   │   │   ├── admin.css
│   │   │   ├── dashboard.css
│   │   │   ├── index.css
│   │   │   ├── login.css
│   │   │   └── style.css
│   │   ├── img/
│   │   └── js/
│   │       ├── admin.js
│   │       └── login.js
│   ├── templates/
│   │   ├── admin.html
│   │   ├── dashboard.html
│   │   ├── index.html
│   │   ├── login.html
│   │   └── verify_email.html
│   ├── db.py
│   ├── urls.py
│   └── views.py
├── .env                    # Local env vars (do not commit secrets)
├── manage.py
└── requirements.txt
```

## Notes (development vs production)

This project is intended for learning/demo use.

- Passwords are stored in plain text (demo).
- Local JSON storage is not suitable for concurrent writes.

If you deploy this publicly, switch to Django’s auth + a real database, add password hashing, and set `DEBUG=False`.


Important limitation (because this project uses a local JSON file as a database):

- On Vercel/serverless, writes are not permanent. The app will work, but any changes you make (new users, payroll edits) can reset on a new deployment or cold start.
- For permanent storage, move data to a real database (Postgres) or an external KV/storage service as you like.

## Troubleshooting

- Port already in use:

```bash
python manage.py runserver 8001
```

- Static assets missing (production-style collect):

```bash
python manage.py collectstatic
```

---

Last updated: January 31, 2026
