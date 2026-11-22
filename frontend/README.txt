MONETA FRONTEND
===============

This folder contains the responsive Moneta web interface built with plain HTML, CSS, and JavaScript. No Node.js, npm, or frontend build step is required.

NORMAL MODE
- Run the full app with Docker Compose.
- Open http://localhost:8000/. FastAPI serves this frontend and the API from one origin.

SEPARATE FRONTEND DEVELOPMENT MODE
- Start `python -m http.server 5500` from the project root (the parent folder of `frontend/`).
- Open http://localhost:5500/frontend/.
- `app.js` automatically sends API calls to port 8000 in this mode.
- FastAPI CORS allows localhost:5500 and 127.0.0.1:5500.

The frontend includes sign-in, registration, forgot-password OTP flow, password visibility toggles, expenses, spending insights, budgets, and CSV export. API details and setup instructions are in the root README.md.
