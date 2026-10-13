
from fastapi import FastAPI
from routers.auth import router as auth_router
from routers.expenses import router as expense_router

app = FastAPI()

app.include_router(auth_router)
app.include_router(expense_router)