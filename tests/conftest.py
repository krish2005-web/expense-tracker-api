
import os

import pytest
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

load_dotenv()

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

if not TEST_DATABASE_URL:
    raise ValueError("TEST_DATABASE_URL is not set in .env")

# Safety check: tests must use only the test database.
parsed_url = make_url(TEST_DATABASE_URL)

if parsed_url.database != "expense_tracker_test_db":
    raise ValueError(
        "Tests must use the expense_tracker_test_db database"
    )

from database import Base, get_db
from models import User, Expense
from main import app

# Create a separate engine for testing.
test_engine = create_engine(TEST_DATABASE_URL)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine
)


# Give API requests a session from the test database.
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


# Start each test with clean tables.
@pytest.fixture(autouse=True)
def reset_test_database():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    yield

    Base.metadata.drop_all(bind=test_engine)
