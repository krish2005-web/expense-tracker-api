from fastapi import APIRouter,Depends,HTTPException,Query
from sqlalchemy import extract
from sqlalchemy import func
from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import date
from database import get_db
from dependencies import get_current_user
from models import Expense
from schemas import ExpenseCreate,ExpenseResponse,ExpenseUpdate,ExpenseSummaryResponse,MonthlySummaryItem,MonthlyAnalyticsResponse
import csv
from io import StringIO
from fastapi.responses import StreamingResponse

router=APIRouter(prefix="/expenses",
                 tags=["Expense"])

@router.post("/",status_code=201,response_model=ExpenseResponse)
def create_expense(expense_data:ExpenseCreate,
                   db:Session=Depends(get_db),
                   current_user=Depends(get_current_user)):
    new_expense=Expense(
        title=expense_data.title,
        amount=expense_data.amount,
        category=expense_data.category,
        description=expense_data.description,
        expense_date=expense_data.expense_date,
        user_id=current_user.id
    )

    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)

    return new_expense

@router.get("/",status_code=200,response_model=list[ExpenseResponse])
def get_all_expense(category:str | None = Query(None),
                    start_date:date | None = Query(None),
                    end_date:date | None = Query(None),
                    page:int=Query(1,ge=1),
                    limit:int=Query(10,ge=1,le=100),
                    db:Session=Depends(get_db),
                    current_user=Depends(get_current_user)):
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(
        status_code=400,
        detail="start_date cannot be later than end_date"
    )
    query=db.query(Expense).filter(Expense.user_id==current_user.id)
    if category is not None:
        query=query.filter(Expense.category==category)
    if start_date is not None:
        query=query.filter(Expense.expense_date>=start_date)
       
    if end_date is not None:
        query=query.filter(Expense.expense_date<=end_date)
       
    offset=(page-1)*limit
    query=query.offset(offset).limit(limit)
    return query.all()

@router.get("/summary",status_code=200, response_model=ExpenseSummaryResponse)
def get_expense_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    user_filter = Expense.user_id == current_user.id

    total_spent = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(user_filter)
        .scalar()
    )

    expense_count = (
        db.query(func.count(Expense.id))
        .filter(user_filter)
        .scalar()
    )

    category_rows = (
        db.query(
            Expense.category,
            func.sum(Expense.amount).label("total_spent"),
            func.count(Expense.id).label("expense_count")
        )
        .filter(user_filter)
        .group_by(Expense.category)
        .all()
    )

    category_summary = [
        {
            "category": row.category,
            "total_spent": row.total_spent,
            "expense_count": row.expense_count
        }
        for row in category_rows
    ]

    return {
        "total_spent": total_spent,
        "expense_count": expense_count,
        "category_summary": category_summary
    }

@router.get("/{expense_id}",status_code=200,response_model=ExpenseResponse)
def get_expense(expense_id:int,
                    db:Session=Depends(get_db),
                    current_user=Depends(get_current_user)):
    expense=db.query(Expense).filter(Expense.id==expense_id,Expense.user_id==current_user.id).first()
    if not expense:
        raise HTTPException(status_code=404,detail="Expense not found")

    return expense

@router.patch("/{expense_id}",status_code=200,response_model=ExpenseResponse)
def expense_update(update_expense:ExpenseUpdate,
                   expense_id:int,
                   db:Session=Depends(get_db),
                   current_user=Depends(get_current_user)
                   ):
    expense=db.query(Expense).filter(Expense.user_id==current_user.id, Expense.id==expense_id).first()
    if not expense:
        raise HTTPException(status_code=404,detail="Expense not found")
    updates=update_expense.model_dump(exclude_unset=True)
    for field,values in updates.items():
        setattr(expense,field,values)
    db.commit()
    db.refresh(expense)

    return expense

@router.delete("/{expense_id}",status_code=200)
def expense_delete(
                   expense_id:int,
                   db:Session=Depends(get_db),
                   current_user=Depends(get_current_user)
                   ):
    expense=db.query(Expense).filter(Expense.user_id==current_user.id, Expense.id==expense_id).first()
    if not expense:
        raise HTTPException(status_code=404,detail=" Expense not found")
    db.delete(expense)
    db.commit()
    return{
        "message":"Expense deleted successfully"
    }


@router.get(
    "/analytics/monthly",
    response_model=MonthlyAnalyticsResponse
)
def get_monthly_analytics(
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    
    month_expr = extract("month", Expense.expense_date)

    
    results = (
        db.query(
            month_expr.label("month"),
            func.sum(Expense.amount).label("total_spent"),
            func.count(Expense.id).label("expense_count")
        )
        .filter(
            extract("year", Expense.expense_date) == year,
            Expense.user_id == current_user.id
        )
        .group_by(month_expr)
        .all()
    )

    
    monthly_data = {}

    for row in results:
        month_number = int(row.month)

        monthly_data[month_number] = MonthlySummaryItem(
            month=month_number,
            total_spent=Decimal(str(row.total_spent or 0)),
            expense_count=int(row.expense_count)
        )

    
    monthly_summary = [
        monthly_data.get(
            month,
            MonthlySummaryItem(
                month=month,
                total_spent=Decimal("0.00"),
                expense_count=0
            )
        )
        for month in range(1, 13)
    ]

    
    total_spent = sum(
        (item.total_spent for item in monthly_summary),
        Decimal("0.00")
    )

    return MonthlyAnalyticsResponse(
        year=year,
        total_spent=total_spent,
        monthly_summary=monthly_summary
    )

@router.get("/export/csv", status_code=200)
def export_expenses_csv(
    category: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    
    if (
        start_date is not None
        and end_date is not None
        and start_date > end_date
    ):
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be later than end_date"
        )

    # Fetch only the logged-in user's expenses
    query = db.query(Expense).filter(
        Expense.user_id == current_user.id
    )

    
    if category is not None:
        query = query.filter(Expense.category == category)

    if start_date is not None:
        query = query.filter(
            Expense.expense_date >= start_date
        )

    if end_date is not None:
        query = query.filter(
            Expense.expense_date <= end_date
        )

    
    expenses = query.order_by(
        Expense.expense_date.desc(),
        Expense.id.desc()
    ).all()

    
    def safe_csv_value(value):
        if value is None:
            return ""

        if isinstance(value, str):
            # Check past leading whitespace/control characters
            if value.lstrip(" \t\r\n").startswith(
                ("=", "+", "-", "@")
            ):
                return "'" + value

        return value

    
    output = StringIO(newline="")
    writer = csv.writer(output)

    writer.writerow([
        "ID",
        "Title",
        "Category",
        "Amount",
        "Description",
        "Expense Date",
        "Created At"
    ])

    for expense in expenses:
        writer.writerow([
            expense.id,
            safe_csv_value(expense.title),
            safe_csv_value(expense.category),
            str(expense.amount),
            safe_csv_value(expense.description),
            expense.expense_date.isoformat(),
            (
                expense.created_at.isoformat()
                if expense.created_at
                else ""
            )
        ])

    
    csv_content = "\ufeff" + output.getvalue()
    output.close()

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition":
                'attachment; filename="moneta-expenses.csv"'
        }
    )