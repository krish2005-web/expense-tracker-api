MONETA FRONTEND — BUDGET ALERTS + MONTHLY COMPARISON
===================================================

This folder is designed to be copied into the root of the existing FastAPI project as `frontend/`.
It uses same-origin API paths; no separate frontend service or API base URL is needed.

INSTALL
1. Download and extract this ZIP.
2. Copy the `frontend` folder into `D:\expense_tracker_api`, replacing the existing frontend files.
3. Keep the existing `main.py` mount for `/frontend` and the root route serving `frontend/index.html`.
4. Commit/push only the frontend changes to your connected GitHub branch and wait for Render to deploy.
5. Hard-refresh the website (Ctrl+F5) after deployment.

NEW IN THIS VERSION
- Budget alerts display on the Overview dashboard and Budgets page.
- At 80% of a budget, Moneta shows an approaching-limit warning; at 100%, it reports that the limit has been reached; above 100%, it shows the amount over budget.
- Budget alert calculations use the signed-in user's expense records when available, with case-insensitive category matching, so e.g. `food` and `Food` do not silently mismatch.
- Monthly spending comparison lets the user select a month and compares it with the previous calendar month, including December from the previous year when January is selected.
- Comparison cards show both month totals, difference amount, percentage change, and relative bars. When previous-year history cannot be queried for dates before 2000, the comparison displays that limitation instead of inventing a value.

EXISTING FEATURES RETAINED
- Transaction filters fetch the signed-in user's expenses in API pages and apply category matching case-insensitively (partial text) plus inclusive start/end date filtering in the browser. Pagination and result counts are based on the filtered set.
- Spending insights uses `/expenses/analytics/monthly?year=...` when available.
- If that analytics endpoint is unavailable, the UI falls back to the existing authenticated `/expenses/` endpoint and calculates the 12 monthly totals client-side.
- Year selector supports 2000–2100, matching the backend's year validation range.
- Yearly total, highest month, monthly average, 12-month bar chart, and category breakdown.
- Sign up / sign in and bearer-token authentication; dashboard summary; expense create/edit/delete; budget create/edit/delete; responsive desktop/mobile layout.

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

NOTES
- Contains no environment variables or database credentials.
- This is a frontend-only enhancement and does not require a database migration. Budget alerts and monthly comparison use the existing authenticated APIs.
- Expense records are fetched in pages of 100 to enable correct case-insensitive filtering and local alert calculations. For very large datasets, server-side case-insensitive filtering and aggregate analytics would be more efficient.
- The app requires a valid signed-in session. Deploy the frontend with the same backend version you have already been using successfully.
