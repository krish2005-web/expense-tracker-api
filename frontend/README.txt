Moneta Frontend (frontend folder only)

Add this folder to your existing expense_tracker_api project root (the same folder that contains main.py). It should become:
expense_tracker_api/
  main.py
  frontend/
    index.html
    app.js
    styles.css

Then check that main.py serves the frontend:
- mounts StaticFiles(directory=FRONTEND_DIR) at "/frontend"
- GET "/" returns frontend/index.html

If your main.py already does that, do not edit it. Start the API from the project root:
python -m uvicorn main:app --reload

Open http://127.0.0.1:8000/ in your browser. Do not open index.html directly from File Explorer.
The frontend uses the same origin as the API, so it does not need a separate API URL or CORS setup when served this way.
