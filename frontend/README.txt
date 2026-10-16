MONETA FRONTEND — ANALYTICS FIX
================================

This folder is designed to be copied into the root of the existing FastAPI project as `frontend/`.
It uses same-origin API paths; no separate frontend service or API base URL is needed.

INSTALL
1. Download and extract this ZIP.
2. Copy the `frontend` folder into `D:\expense_tracker_api`, replacing the existing frontend files.
3. Keep the existing `main.py` mount for `/frontend` and the root route serving `frontend/index.html`.
4. Commit/push only the frontend changes to your connected GitHub branch and wait for Render to deploy.
5. Hard-refresh the website (Ctrl+F5) after deployment.

FIXES IN THIS VERSION
- Spending insights uses `/expenses/analytics/monthly?year=...` when available.
- If that analytics endpoint is missing in the deployed backend, the UI falls back to the existing authenticated `/expenses/` endpoint and calculates the 12 monthly totals client-side. This avoids showing the raw `Not Found` response in the chart while the backend deployment is being reconciled.
- Year selector supports 2000–2100, matching the backend's year validation range.
- Yearly total, highest month, monthly average, and bar chart are built from the selected year's monthly records.

API ROUTES USED
- POST /auth/register
- POST /auth/login
- POST /expenses/
- GET /expenses/?category=&start_date=&end_date=&page=&limit=
- GET /expenses/{expense_id}
- PATCH /expenses/{expense_id}
- DELETE /expenses/{expense_id}
- GET /expenses/summary
- GET /expenses/analytics/monthly?year= (with client-side fallback)
- POST /budgets/
- GET /budgets/
- GET /budgets/{budget_id}
- GET /budgets/{budget_id}/summary
- PATCH /budgets/{budget_id}
- DELETE /budgets/{budget_id}

FEATURES
- Sign up / sign in and bearer-token authentication
- Dashboard summary and category breakdown
- Expense create, list, filters, pagination, edit and delete
- Monthly analytics by selected year and 12-month bar chart
- Budget create, list, month/year filtering, progress summaries, edit and delete
- Responsive desktop/mobile layout

NOTES
- Does not contain environment variables or database credentials.
- This is a frontend-only change. Do not reset or modify the production database to install it.
- The analytics fallback still requires a valid signed-in session and the existing GET /expenses/ endpoint.
