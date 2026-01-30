# User Management Dashboard

A lightweight Django app for user management with **Admin/User roles**, a **modern UI** (Bootstrap + Tailwind + custom CSS), and a **local JSON file** as the data store.
<img width="1896" height="911" alt="Screenshot 2026-01-31 024830" src="https://github.com/user-attachments/assets/ff69d9e3-8a34-41e5-8b7c-6fd8eae62758" />
<img width="1918" height="909" alt="Screenshot 2026-01-31 025203" src="https://github.com/user-attachments/assets/c151eabc-48ff-4636-a7c8-c9882603cd1d" />
<img width="1901" height="911" alt="Screenshot 2026-01-31 030851" src="https://github.com/user-attachments/assets/dec577ae-5bfc-4f03-b29f-78c8dc0d637e" />
<img width="1903" height="909" alt="Screenshot 2026-01-31 030907" src="https://github.com/user-attachments/assets/a9dc861f-7b47-4683-9e55-936f6b136e6e" />
<img width="1902" height="885" alt="Screenshot 2026-01-31 030936" src="https://github.com/user-attachments/assets/91f09fc2-ba3a-4258-991c-8dac10a4c8df" />
<img width="1900" height="906" alt="Screenshot 2026-01-31 030949" src="https://github.com/user-attachments/assets/6112f7b1-84f9-497c-844d-5bc76ebd781c" />
<img width="1901" height="911" alt="Screenshot 2026-01-31 031029" src="https://github.com/user-attachments/assets/5d7096da-9f07-454d-b289-22a9ddd0c8fc" />
<img width="1903" height="910" alt="Screenshot 2026-01-31 031046" src="https://github.com/user-attachments/assets/8977355d-bb24-41a2-9318-ad775e465a40" />

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
