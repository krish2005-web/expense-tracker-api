MONETA FRONTEND — BUDGET STATUS + VISUAL POLISH
================================================

This frontend folder is designed to be copied into the existing FastAPI project as `frontend/`.
It uses same-origin API paths and does not require a separate frontend service.

INSTALL
1. Extract this ZIP.
2. Copy the included `frontend` folder into `D:\expense_tracker_api`, replacing only the existing frontend files.
3. Keep the existing FastAPI `StaticFiles` mount and root route that serves `frontend/index.html`.
4. Commit/push the frontend folder and wait for Render to deploy.
5. Hard-refresh the live website (Ctrl+F5).

FIXES AND IMPROVEMENTS
- Budget status is now explicit and correctly split into On track (<80%), Near limit (80% to below 100%), Budget reached (100%), and Over budget (>100%).
- Budget cards, Budget pulse, budget alerts, and category details use the same status calculation based on amount spent versus the budget limit, rather than treating exactly 100% as Near limit.
- Category breakdown percentages are labeled as their share of all-time spending on Overview and selected-year spending on Spending insights. This is distinct from the separate monthly budget-usage indicator.
- Category breakdown now shows the selected month's budget progress for matching categories, e.g. “100% used · Budget reached”, or “No budget set”. Category names are aggregated case-insensitively from the signed-in user's loaded expense records.
- Spending insights category mix is based on the selected year, instead of silently showing all-time totals.
- Added a Budget Health snapshot for the selected budget month, with counts for On track, Near limit, Limit reached, and Over budget.
- Refined visual styling with clearer status colours, animated progress bars, hover depth, and responsive health cards.
- Responsive layouts for mobile phones (including narrow 320px screens), tablets, laptops, desktops, and wide monitors.
- Mobile slide-out navigation with tappable backdrop, Escape-to-close, and body-scroll locking.
- Touch-friendly buttons and inputs, safe-area spacing for notched devices, and mobile-sized dialogs.
- Transaction table remains readable with touch-friendly horizontal scrolling; filters and forms stack on small screens.
- Reduced-motion preference, keyboard focus indicators, and iOS input zoom prevention.
- Existing expense filtering, dashboard, monthly/annual analytics, month-over-month comparison, authentication, and budget CRUD remain included.

API ROUTES USED
- POST /auth/register
- POST /auth/login
- POST /expenses/
- GET /expenses/?page=&limit= and date-range queries
- GET /expenses/summary
- GET /expenses/analytics/monthly?year= (with existing expense-list fallback)
- GET /expenses/{expense_id}
- PATCH /expenses/{expense_id}
- DELETE /expenses/{expense_id}
- GET /budgets/
- POST /budgets/
- GET /budgets/{budget_id}/summary
- PATCH /budgets/{budget_id}
- DELETE /budgets/{budget_id}

NOTES
- Frontend-only update; no database migration required.
- It contains no credentials or environment variables.
- Budget values are calculated for each budget's category, month, and year from the signed-in user's expenses. Category “share of spending” is a different measure: category total divided by the selected total.
- The frontend has been syntax-checked and its ZIP structure verified, but the authenticated live Render flow has not been end-to-end tested from this environment.


CSV EXPORT BUTTON
- Transactions includes an Export CSV button that calls GET /expenses/export/csv.
- The current category, start date, and end date fields are sent to the API.
- The request uses the saved Moneta bearer token and downloads the CSV response as a file.
- The API endpoint must already exist in the backend. Category matching follows the backend endpoint's current filter behavior.
