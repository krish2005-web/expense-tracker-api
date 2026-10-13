# Expense Tracker API

A RESTful backend API built with FastAPI and PostgreSQL to manage personal expenses securely. The project includes JWT authentication, expense management, filtering, pagination, spending summaries, and automated tests.

## Features

- User registration with password hashing
- Login using JWT access tokens
- Protected API endpoints
- Create, read, update, and delete expenses
- User-specific expense ownership
- Filter expenses by category and date range
- Pagination with configurable page and limit
- Overall and category-wise spending summaries
- Request validation with Pydantic
- Database migrations with Alembic
- Automated tests with pytest and FastAPI TestClient

## Tech Stack

- Python
- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic
- Pydantic
- PyJWT
- pwdlib
- pytest

## Project Setup

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd expense_tracker_api
```

### 2. Create and activate a virtual environment

On Windows PowerShell:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 3. Install dependencies

```powershell
python -m pip install -r requirements.txt
```

### 4. Configure environment variables

Copy `.env.example` to `.env` and update the values.

Configure:

- `DATABASE_URL` — PostgreSQL development database URL
- `TEST_DATABASE_URL` — separate PostgreSQL test database URL
- `SECRET_KEY` — strong, randomly generated JWT signing secret
- `ALGORITHM` — JWT algorithm, for example `HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES` — token expiration setting, if used by the application

Never commit the real `.env` file or share secret credentials.

### 5. Run database migrations

Ensure the PostgreSQL databases exist and the configured credentials are correct.

```powershell
python -m alembic upgrade head
```

### 6. Start the API

```powershell
python -m uvicorn main:app --reload
```

Open the interactive API documentation at:

`http://127.0.0.1:8000/docs`

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a user |
| POST | `/auth/login` | Log in and obtain a JWT |
| POST | `/expenses/` | Create an expense |
| GET | `/expenses/` | List expenses with optional filtering and pagination |
| GET | `/expenses/summary` | Get overall and category-wise spending summaries |
| GET | `/expenses/{expense_id}` | Retrieve a specific expense |
| PATCH | `/expenses/{expense_id}` | Update an expense |
| DELETE | `/expenses/{expense_id}` | Delete an expense |

Expense endpoints require valid authentication. Users can access only their own expenses.

## Run Automated Tests

Configure `TEST_DATABASE_URL` to point to a dedicated test database before running tests.

```powershell
python -m pytest .\tests\test.py -v
```

**Warning:** The test setup recreates database tables during testing. Never point `TEST_DATABASE_URL` at a production or development database containing data you need to preserve.

## Security Notes

- Passwords are hashed before storage.
- Protected endpoints require valid JWT authentication.
- Secrets and database credentials should be supplied through environment variables.
- The `.env` file should not be committed to version control.

## Future Improvements

- Additional integration tests and test coverage
- Docker-based deployment
- CI/CD workflow
- Production deployment and monitoring
