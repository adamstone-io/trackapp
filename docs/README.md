# Time Tracker

Lightweight time tracking app with a Django REST API backend and a static
JavaScript frontend. Includes timers, manual entries, moments, priming, reviews,
habits, and workspace management.

## Stack
- Backend: Django + Django REST Framework
- Auth: JWT (SimpleJWT)
- Frontend: vanilla JS + HTML + CSS

## Local development

### Backend
```bash
# from repo root
python -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt

# env vars
export DJANGO_SECRET_KEY="change-me"
export ALLOWED_HOSTS="127.0.0.1,localhost"
export DEBUG=1

python backend/manage.py migrate
python backend/manage.py runserver
```

### Frontend
Serve the `frontend/html` files with any static server (for example VS Code Live
Server). Open `timer.html` (or other pages) from that server.

Note: the frontend API base is currently hardcoded to
`http://127.0.0.1:8000/api` in `frontend/js/data/storage.js`.

## Auth
- Login page: `frontend/html/login.html`
- Register is disabled in UI (no button), but the endpoint exists:
  `POST /api/auth/register/`
- Tokens are stored in localStorage and sent as `Authorization: Bearer <token>`.

## Deploy (Render)

Backend (Web Service):
- Build command: `pip install -r backend/requirements.txt`
- Start command: `gunicorn config.wsgi:application`
- Set env vars: `DJANGO_SECRET_KEY`, `ALLOWED_HOSTS`, `DEBUG=false`
- Use Postgres and set `DATABASE_URL` (recommended)

Frontend (Static Site):
- Publish directory: `frontend`
- Entry pages are under `frontend/html/`
- Update API base in `frontend/js/data/storage.js` to your backend URL

## Notes
- `backend/db.sqlite3` is for local use only.
- `backend/venv` and `.env` files should not be committed.
