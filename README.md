# Moneta — Personal Expense Tracker

Moneta is a personal expense-tracking application with a responsive web dashboard and a FastAPI backend. It helps signed-in users record expenses, organize monthly category budgets, and review spending patterns.

The frontend is built with plain HTML, CSS, and JavaScript. FastAPI serves the frontend and JSON API from the same application, so no Node.js, npm, or frontend build step is required.

## Features

- User registration and JWT-based sign-in.
- User-specific expense creation, listing, editing, and deletion.
- Expense filtering by category and date range, with pagination.
- Overall and category-wise spending summaries.
- Monthly spending analytics and month-over-month comparison.
- CSV export of filtered expenses.
- Monthly category budgets with budget summaries and status indicators.
- Forgot-password flow using a six-digit email OTP.
- OTP hashes stored temporarily in Redis with a five-minute expiry.
- Forgot-password request rate limiting and limited OTP verification attempts.
- Gmail SMTP delivery for password-reset OTP messages.
- Alembic database migrations.
- Responsive dashboard with mobile navigation and password visibility controls.

## Tech stack

| Area | Technology |
|---|---|
| Backend | Python, FastAPI, Uvicorn |
| Database | Neon PostgreSQL, SQLAlchemy, Alembic, psycopg |
| Authentication | JWT (PyJWT), pwdlib password hashing |
| Temporary data and rate limiting | Redis (`redis-py`) |
| Email | Gmail SMTP using Python `smtplib` |
| Frontend | HTML, CSS, vanilla JavaScript |
| Containers | Docker, Docker Compose |
| API documentation | FastAPI Swagger UI |

## Architecture

```text
Browser
  |
  | HTTP requests
  v
FastAPI (Docker, port 8000)
  |                 |
  |                 +---- Redis (Docker)
  |                       - OTP hash + 5-minute TTL
  |                       - Password-reset rate limits
  |
  +---- Neon PostgreSQL
  |       - users
  |       - expenses
  |       - budgets
  |
  +---- Gmail SMTP
          - Password-reset OTP email
```

The default Compose configuration uses Neon for the application database and Redis as a Docker service. A local PostgreSQL service is available only through the optional `local-db` Compose profile.

## Prerequisites

- Windows with PowerShell, macOS, or Linux.
- Docker Desktop / Docker Engine with Docker Compose.
- A Neon PostgreSQL project and connection string.
- A Gmail account with 2-Step Verification enabled and a Google App Password created for SMTP.
- Git, if you plan to push the project to GitHub.

## Configuration

1. Clone or extract the project folder.
2. Create your local environment file:

   **PowerShell**
   ```powershell
   Copy-Item .env.example .env
   ```

   **macOS / Linux**
   ```bash
   cp .env.example .env
   ```

3. Open `.env` and set the values below. Do not commit or share this file.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection URL. Use the `psycopg` SQLAlchemy driver and `sslmode=require`. |
| `SECRET_KEY` | Random secret used to sign JWTs. |
| `OTP_HASH_SECRET` | A separate random secret used to HMAC-hash password-reset OTPs. |
| `ALGORITHM` | JWT signing algorithm; the project defaults to `HS256`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access-token lifetime setting in Compose. |
| `SMTP_EMAIL` | Gmail address that sends OTP emails. |
| `SMTP_PASSWORD` | Google App Password, not the normal Gmail account password. |
| `POSTGRES_PASSWORD` | Only needed when starting the optional local PostgreSQL profile. |
| `TEST_DATABASE_URL` | Optional dedicated test database URL. Tests must never use production data. |

A Neon URL has this general form:

```text
postgresql+psycopg://USER:PASSWORD@YOUR_NEON_HOST/neondb?sslmode=require
```

Copy the host, database, user, and password from **Neon Console → Connect**. If the password contains URL-reserved characters, URL-encode the password portion before placing it in `DATABASE_URL`.

Generate independent random values for `SECRET_KEY` and `OTP_HASH_SECRET`:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Run the command separately for each secret. Do not use the same value for both.

For Gmail SMTP, enable Google 2-Step Verification and create an App Password. Put the App Password in `SMTP_PASSWORD`; do not use your normal Gmail password.

## Run with Docker Compose (recommended)

Run these commands from the project root, where `compose.yaml` is located:

```powershell
docker compose config -q
docker compose up -d --build
```

Compose starts the FastAPI service and Redis. On startup, the API container applies Alembic migrations to the database configured by `DATABASE_URL`, then starts Uvicorn.

Open:

- **Moneta web app:** <http://localhost:8000/>
- **Swagger API docs:** <http://localhost:8000/docs>
- **ReDoc:** <http://localhost:8000/redoc>

Useful commands:

```powershell
# View running containers
docker compose ps

# Follow API logs
docker compose logs -f api

# Check Redis responds
docker compose exec redis redis-cli ping

# Stop the app and Redis (keeps named volumes)
docker compose down
```

Expected Redis response:

```text
PONG
```

## Run the frontend on a separate development port (optional)

The normal/recommended setup serves both frontend and backend from `http://localhost:8000/`. If you specifically want a separate static frontend server, run the following from the **project root**, not from inside the `frontend` directory:

```powershell
python -m http.server 5500
```

Then open <http://localhost:5500/frontend/>.

The JavaScript automatically sends API calls to `http://localhost:8000` when the page is served on port `5500`. FastAPI CORS middleware allows these local development origins:

- `http://localhost:5500`
- `http://127.0.0.1:5500`

For deployment on a different frontend domain, add that exact trusted origin to the `allow_origins` list in `main.py`. Do not use an unrestricted wildcard for an application with authenticated APIs.

## Optional: start local PostgreSQL for practice

Local PostgreSQL is disabled by default so the application uses Neon. To start the optional local database container:

```powershell
docker compose --profile local-db up -d db
```

It is exposed on `localhost:5433`. Starting it does not switch the app away from Neon. To run the application against local PostgreSQL instead, change `DATABASE_URL` in `.env` to a Docker-network URL such as:

```text
postgresql+psycopg://postgres:YOUR_POSTGRES_PASSWORD@db:5432/expense_tracker_db
```

Then recreate the API container. Keep the Neon URL backed up somewhere private before switching.

## Authentication and password reset

- `POST /auth/register` creates an account and stores a password hash.
- `POST /auth/login` verifies the password and returns a bearer JWT.
- `POST /auth/forgot-password` sends a six-digit OTP when the email belongs to an account. The response message is intentionally the same for known and unknown email addresses.
- OTP hashes are stored in Redis for 300 seconds. Raw OTP values are sent only by email.
- Forgot-password requests are rate-limited by client IP. The current route allows up to five requests in a 15-minute window.
- `POST /auth/reset-password` accepts `email`, `otp`, and `new_password`. Incorrect OTP attempts are limited; repeated failures invalidate the OTP.

The current registration endpoint validates email syntax, but it does not require email OTP verification before account creation.

## API endpoints

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/auth/register` | Create an account |
| `POST` | `/auth/login` | Sign in and receive a JWT |
| `POST` | `/auth/forgot-password` | Request a password-reset OTP |
| `POST` | `/auth/reset-password` | Verify OTP and update password |

### Expenses

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/expenses/` | Create an expense |
| `GET` | `/expenses/` | List expenses; supports category, date range, page, and limit filters |
| `GET` | `/expenses/summary` | Overall and category-wise spending summary |
| `GET` | `/expenses/analytics/monthly?year=YYYY` | Monthly analytics for a year |
| `GET` | `/expenses/export/csv` | Export filtered expenses as CSV |
| `GET` | `/expenses/{expense_id}` | Retrieve one expense |
| `PATCH` | `/expenses/{expense_id}` | Update an expense |
| `DELETE` | `/expenses/{expense_id}` | Delete an expense |

### Budgets

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/budgets/` | Create a monthly category budget |
| `GET` | `/budgets/` | List the signed-in user's budgets |
| `GET` | `/budgets/{budget_id}` | Retrieve one budget |
| `GET` | `/budgets/{budget_id}/summary` | Compare the budget with spending |
| `PATCH` | `/budgets/{budget_id}` | Update a budget |
| `DELETE` | `/budgets/{budget_id}` | Delete a budget |

All expense and budget routes require the bearer token returned by `/auth/login`. Data access is scoped to the authenticated user.

## Tests

The test fixture uses `TEST_DATABASE_URL` and drops/recreates mapped tables around tests. Only use a dedicated disposable test database named `expense_tracker_test_db`. Never point `TEST_DATABASE_URL` at the Neon database or any database containing data you want to keep.

When the test database is configured, run:

```powershell
python -m pytest .\tests -v
```

## GitHub: prepare and push

Before pushing, check that `.env`, virtual environments, caches, and credentials are not staged:

```powershell
git status --short
```

The repository includes a `.gitignore` for `.env`, Python environments, and generated files. Only commit `.env.example` with placeholders.

If this is a new local Git repository:

```powershell
git init
git add .
git status --short
git commit -m "Prepare Moneta expense tracker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

If a Git remote already exists, inspect it first with `git remote -v` and use `git remote set-url origin <YOUR_REPOSITORY_URL>` only if you need to change it. Never push `.env`, Gmail App Passwords, Neon credentials, or signing secrets.

## Security notes

- Never commit `.env` or paste connection strings, Gmail App Passwords, JWT secrets, or OTP secrets into public issues or chats.
- Use HTTPS when deploying outside local development.
- Restrict CORS to the exact frontend origins you control.
- Use a dedicated test database; the test fixture resets its tables.
- This is a learning/portfolio application. Review deployment secrets, trusted proxy/IP handling, monitoring, backups, and operational hardening before production use.
