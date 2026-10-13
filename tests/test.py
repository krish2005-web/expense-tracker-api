
from decimal import Decimal

import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient

from main import app
from schemas import ExpenseCreate


client = TestClient(app)


# ---------- Reusable helpers ----------

def register_and_login(
    email="testuser@example.com",
    name="Test User",
    password="TestPassword123!"
):
    register_response = client.post(
        "/auth/register",
        json={
            "name": name,
            "email": email,
            "password": password
        }
    )
    assert register_response.status_code == 201, register_response.text

    login_response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": password
        }
    )
    assert login_response.status_code == 200, login_response.text

    token = login_response.json()["access_token"]

    return {
        "Authorization": f"Bearer {token}"
    }, register_response.json()


def create_expense(
    headers,
    title="Laptop",
    amount=100.50,
    category="electronics",
    description="For testing",
    expense_date="2026-10-12"
):
    return client.post(
        "/expenses/",
        headers=headers,
        json={
            "title": title,
            "amount": amount,
            "category": category,
            "description": description,
            "expense_date": expense_date
        }
    )


# ---------- Basic tests ----------

def test_docs():
    response = client.get("/docs")
    assert response.status_code == 200


def test_unknown_route():
    response = client.get("/this-route-does-not-exist")
    assert response.status_code == 404


def test_expenses_require_authentication():
    response = client.get("/expenses/")
    assert response.status_code == 401


def test_invalid_token():
    response = client.get(
        "/expenses/",
        headers={
            "Authorization": "Bearer fake-invalid-token"
        }
    )
    assert response.status_code == 401


# ---------- Schema validation tests ----------

def test_invalid_expense_amount():
    with pytest.raises(ValidationError):
        ExpenseCreate(
            title="Laptop",
            category="electronics",
            amount=Decimal("100.555"),
            expense_date="2026-10-12"
        )


def test_valid_expense_amount():
    expense = ExpenseCreate(
        title="Laptop",
        category="electronics",
        amount=Decimal("100.50"),
        expense_date="2026-10-12"
    )

    assert expense.amount == Decimal("100.50")


# ---------- Registration tests ----------

def test_register_user():
    response = client.post(
        "/auth/register",
        json={
            "name": "Test User",
            "email": "register@example.com",
            "password": "TestPassword123!"
        }
    )

    assert response.status_code == 201
    assert response.json()["email"] == "register@example.com"
    assert "password_hash" not in response.json()
    assert "password" not in response.json()


def test_duplicate_registration():
    payload = {
        "name": "Test User",
        "email": "duplicate@example.com",
        "password": "TestPassword123!"
    }

    first_response = client.post("/auth/register", json=payload)
    assert first_response.status_code == 201

    second_response = client.post("/auth/register", json=payload)
    assert second_response.status_code == 409


# ---------- Login tests ----------

def test_login_success():
    client.post(
        "/auth/register",
        json={
            "name": "Login User",
            "email": "login@example.com",
            "password": "TestPassword123!"
        }
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!"
        }
    )

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert response.json()["token_type"] == "bearer"


def test_login_invalid_password():
    client.post(
        "/auth/register",
        json={
            "name": "Login User",
            "email": "wrongpass@example.com",
            "password": "CorrectPassword123!"
        }
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "wrongpass@example.com",
            "password": "WrongPassword123!"
        }
    )

    assert response.status_code == 401


# ---------- Expense CRUD tests ----------

def test_create_expense():
    headers, user = register_and_login(
        email="create@example.com"
    )

    response = create_expense(headers)

    assert response.status_code == 201
    assert response.json()["title"] == "Laptop"
    assert response.json()["user_id"] == user["id"]


def test_invalid_amount_rejected_by_api():
    headers, _ = register_and_login(
        email="invalidamount@example.com"
    )

    response = create_expense(
        headers,
        amount=100.555
    )

    assert response.status_code == 422


def test_get_expenses_only_current_user():
    headers_a, _ = register_and_login(
        email="usera@example.com",
        name="User A"
    )

    headers_b, _ = register_and_login(
        email="userb@example.com",
        name="User B"
    )

    response_a = create_expense(
        headers_a,
        title="User A Laptop"
    )
    response_b = create_expense(
        headers_b,
        title="User B Phone"
    )

    assert response_a.status_code == 201
    assert response_b.status_code == 201

    response = client.get(
        "/expenses/",
        headers=headers_a
    )

    assert response.status_code == 200

    expenses = response.json()
    assert len(expenses) == 1
    assert expenses[0]["title"] == "User A Laptop"


def test_expense_list_filters_and_pagination():
    headers, _ = register_and_login(
        email="filter@example.com"
    )

    create_expense(
        headers,
        title="Food 1",
        amount=100,
        category="food"
    )
    create_expense(
        headers,
        title="Food 2",
        amount=200,
        category="food"
    )
    create_expense(
        headers,
        title="Laptop",
        amount=500,
        category="electronics"
    )

    response = client.get(
        "/expenses/?category=food&page=1&limit=1",
        headers=headers
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["category"] == "food"


def test_invalid_date_range():
    headers, _ = register_and_login(
        email="dates@example.com"
    )

    response = client.get(
        "/expenses/?start_date=2026-10-13&end_date=2026-10-12",
        headers=headers
    )

    assert response.status_code == 400


def test_expense_summary():
    headers, _ = register_and_login(
        email="summary@example.com"
    )

    create_expense(
        headers,
        title="Food 1",
        amount=100.50,
        category="food"
    )
    create_expense(
        headers,
        title="Food 2",
        amount=50,
        category="food"
    )
    create_expense(
        headers,
        title="Laptop",
        amount=200,
        category="electronics"
    )

    response = client.get(
        "/expenses/summary",
        headers=headers
    )

    assert response.status_code == 200

    result = response.json()

    assert result["expense_count"] == 3
    assert Decimal(str(result["total_spent"])) == Decimal("350.50")
    categories = {
        item["category"]: item
        for item in result["category_summary"]
    }

    assert Decimal(str(categories["food"]["total_spent"])) == Decimal("150.50")

    assert Decimal(str(categories["electronics"]["total_spent"])) == Decimal("200.00")



def test_get_expense_by_id():
    headers, _ = register_and_login(
        email="getbyid@example.com"
    )

    created = create_expense(headers)
    assert created.status_code == 201

    expense_id = created.json()["id"]

    response = client.get(
        f"/expenses/{expense_id}",
        headers=headers
    )

    assert response.status_code == 200
    assert response.json()["id"] == expense_id


def test_missing_expense_returns_404():
    headers, _ = register_and_login(
        email="missing@example.com"
    )

    response = client.get(
        "/expenses/999999",
        headers=headers
    )

    assert response.status_code == 404


def test_patch_expense():
    headers, _ = register_and_login(
        email="patch@example.com"
    )

    created = create_expense(headers)
    assert created.status_code == 201

    expense_id = created.json()["id"]

    response = client.patch(
        f"/expenses/{expense_id}",
        headers=headers,
        json={
            "amount": 750.50
        }
    )

    assert response.status_code == 200
    assert Decimal(str(response.json()["amount"])) == Decimal("750.50")
    assert response.json()["title"] == "Laptop"


def test_delete_expense():
    headers, _ = register_and_login(
        email="delete@example.com"
    )

    created = create_expense(headers)
    assert created.status_code == 201

    expense_id = created.json()["id"]

    delete_response = client.delete(
        f"/expenses/{expense_id}",
        headers=headers
    )

    assert delete_response.status_code == 200

    get_response = client.get(
        f"/expenses/{expense_id}",
        headers=headers
    )

    assert get_response.status_code == 404
