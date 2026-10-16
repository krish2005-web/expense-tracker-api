
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from routers.auth import router as auth_router
from routers.expenses import router as expense_router
from routers.budget import router as budget_router

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = FastAPI(
    title="Moneta — Expense Tracker API",
    description="Personal expense tracking with JWT authentication and spending insights.",
    version="1.0.0",
)

app.include_router(auth_router)
app.include_router(expense_router)
app.include_router(budget_router)

app.mount(
    "/frontend",
    StaticFiles(directory=FRONTEND_DIR),
    name="frontend",
)

@app.get("/", include_in_schema=False)
def frontend_home():
    return FileResponse(FRONTEND_DIR / "index.html")
