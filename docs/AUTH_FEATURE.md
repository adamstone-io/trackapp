# Authentication Feature

## Overview
Authentication uses JWT tokens for API access. All data is scoped to the
authenticated user.

## User Flow
1. Open `login.html`.
2. Enter username and password.
3. On success, the app stores access and refresh tokens and redirects.

## Files Structure

### Backend
- `backend/tracker/urls.py` - JWT token and register endpoints
- `backend/tracker/views.py` - Register view + user-scoped viewsets
- `backend/tracker/models.py` - `user` FK on all core models

### Frontend
- `frontend/html/login.html` - Login page
- `frontend/js/login-main.js` - Login/register logic
- `frontend/js/data/storage.js` - Token handling and auth headers

## Endpoints
- `POST /api/auth/register/` (register logic exists but UI is hidden)
- `POST /api/auth/token/` (login)
- `POST /api/auth/token/refresh/`

## Notes
- Tokens are stored in localStorage and sent as `Authorization: Bearer <token>`.
- All API list and CRUD endpoints are scoped to the authenticated user.
