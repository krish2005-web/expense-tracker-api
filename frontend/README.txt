MONETA FRONTEND — API CONNECTED
================================

This is a standalone frontend folder for the FastAPI project in the uploaded ZIP.
It uses the same-origin FastAPI routes; no separate frontend server or API URL is needed.

INSTALL
1. Extract this folder.
2. Copy the entire `frontend` folder into the root of your existing `expense_tracker_api` project, replacing the old frontend files when prompted.
3. Keep your existing `main.py` setup that mounts `/frontend` with StaticFiles and serves `frontend/index.html` at `/`.
4. Commit and push the changed frontend files to the GitHub repository connected to Render.
5. Wait for Render to deploy, then open the service root URL.

API ROUTES USED
- POST /auth/register
- POST /auth/login
- POST /expenses/
- GET /expenses/?category=&start_date=&end_date=&page=&limit=
- GET /expenses/{expense_id}
- PATCH /expenses/{expense_id}
- DELETE /expenses/{expense_id}
- GET /expenses/summary
- GET /expenses/analytics/monthly?year=
- POST /budgets/
- GET /budgets/
- GET /budgets/{budget_id}
- GET /budgets/{budget_id}/summary
- PATCH /budgets/{budget_id}
- DELETE /budgets/{budget_id}

FEATURES
- Sign up / sign in and bearer-token authentication
- Dashboard summary and category breakdown
- Expense create, list, filters, pagination, view-for-edit, update, delete
- Monthly analytics by year, 12-month chart, category mix
- Budget create, list, month/year filtering, progress summaries, update and delete
- Responsive desktop/mobile layout

NOTES
- Uses your existing FastAPI backend and exact API paths from the uploaded project.
- Does not contain environment variables or database credentials.
- The app stores the JWT token in browser localStorage and clears it when a 401 response indicates the session expired.
- Budget summaries are returned by the backend per budget. If the backend returns an error for a particular summary, the card falls back to showing the budget with zero spend.
