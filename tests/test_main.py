
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


from decimal import Decimal


# ---------- Budget CRUD tests ----------

def create_budget(
    headers,
    amount=5000,
    category="food",
    month=10,
    year=2026
):
    return client.post(
        "/budgets/",
        headers=headers,
        json={
            "amount": amount,
            "category": category,
            "month": month,
            "year": year
        }
    )


def test_create_budget():
    headers, user = register_and_login(
        email="budget_create@example.com"
    )

    response = create_budget(headers)

    assert response.status_code == 201
    assert response.json()["category"] == "food"
    assert response.json()["user_id"] == user["id"]
    assert Decimal(str(response.json()["amount"])) == Decimal("5000.00")


def test_duplicate_budget_returns_409():
    headers, _ = register_and_login(
        email="budget_duplicate@example.com"
    )

    first = create_budget(headers)
    second = create_budget(headers)

    assert first.status_code == 201
    assert second.status_code == 409


def test_get_budgets():
    headers, _ = register_and_login(
        email="budget_list@example.com"
    )

    create_budget(headers, category="food")
    create_budget(headers, category="travel")

    response = client.get(
        "/budgets/",
        headers=headers
    )

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_budget_by_id():
    headers, _ = register_and_login(
        email="budget_detail@example.com"
    )

    created = create_budget(headers)
    assert created.status_code == 201

    budget_id = created.json()["id"]

    response = client.get(
        f"/budgets/{budget_id}",
        headers=headers
    )

    assert response.status_code == 200
    assert response.json()["id"] == budget_id


def test_missing_budget_returns_404():
    headers, _ = register_and_login(
        email="budget_missing@example.com"
    )

    response = client.get(
        "/budgets/999999",
        headers=headers
    )

    assert response.status_code == 404


def test_budget_summary():
    headers, _ = register_and_login(
        email="budget_summary@example.com"
    )

    budget_response = create_budget(
        headers,
        amount=5000,
        category="food",
        month=10,
        year=2026
    )
    assert budget_response.status_code == 201

    expense_response = create_expense(
        headers,
        title="Groceries",
        amount=1200,
        category="food",
        expense_date="2026-10-12"
    )
    assert expense_response.status_code == 201

    budget_id = budget_response.json()["id"]

    response = client.get(
        f"/budgets/{budget_id}/summary",
        headers=headers
    )

    assert response.status_code == 200

    result = response.json()

    assert Decimal(str(result["budget_amount"])) == Decimal("5000.00")
    assert Decimal(str(result["total_spent"])) == Decimal("1200.00")
    assert Decimal(str(result["remaining_amount"])) == Decimal("3800.00")
    assert result["used_percentage"] == 24


def test_patch_budget():
    headers, _ = register_and_login(
        email="budget_patch@example.com"
    )

    created = create_budget(headers)
    assert created.status_code == 201

    budget_id = created.json()["id"]

    response = client.patch(
        f"/budgets/{budget_id}",
        headers=headers,
        json={"amount": 6000}
    )

    assert response.status_code == 200
    assert Decimal(str(response.json()["amount"])) == Decimal("6000.00")
    assert response.json()["category"] == "food"


def test_patch_budget_empty_body():
    headers, _ = register_and_login(
        email="budget_empty_patch@example.com"
    )

    created = create_budget(headers)
    budget_id = created.json()["id"]

    response = client.patch(
        f"/budgets/{budget_id}",
        headers=headers,
        json={}
    )

    assert response.status_code == 400


def test_patch_budget_duplicate_category_month_year():
    headers, _ = register_and_login(
        email="budget_patch_duplicate@example.com"
    )

    first = create_budget(
        headers,
        category="food",
        month=10,
        year=2026
    )
    second = create_budget(
        headers,
        category="travel",
        month=10,
        year=2026
    )

    assert first.status_code == 201
    assert second.status_code == 201

    second_id = second.json()["id"]

    response = client.patch(
        f"/budgets/{second_id}",
        headers=headers,
        json={"category": "food"}
    )
    print("STATUS:", response.status_code)
    print("BODY:", response.text)
    assert response.status_code == 409


def test_delete_budget():
    headers, _ = register_and_login(
        email="budget_delete@example.com"
    )

    created = create_budget(headers)
    assert created.status_code == 201

    budget_id = created.json()["id"]

    response = client.delete(
        f"/budgets/{budget_id}",
        headers=headers
    )

    assert response.status_code == 200

    get_response = client.get(
        f"/budgets/{budget_id}",
        headers=headers
    )

    assert get_response.status_code == 404


def test_user_cannot_access_another_users_budget():
    headers_a, _ = register_and_login(
        email="budget_owner_a@example.com"
    )
    headers_b, _ = register_and_login(
        email="budget_owner_b@example.com"
    )

    created = create_budget(headers_a)
    assert created.status_code == 201

    budget_id = created.json()["id"]

    detail_response = client.get(
        f"/budgets/{budget_id}",
        headers=headers_b
    )

    summary_response = client.get(
        f"/budgets/{budget_id}/summary",
        headers=headers_b
    )

    patch_response = client.patch(
        f"/budgets/{budget_id}",
        headers=headers_b,
        json={"amount": 9000}
    )

    delete_response = client.delete(
        f"/budgets/{budget_id}",
        headers=headers_b
    )

    assert detail_response.status_code == 404
    assert summary_response.status_code == 404
    assert patch_response.status_code == 404
    assert delete_response.status_code == 404
