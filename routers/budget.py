from fastapi import APIRouter,HTTPException,Depends
from models import Budget,User,Expense
from sqlalchemy import func,extract
from decimal import Decimal
from database import get_db
from sqlalchemy.orm import Session
from schemas import BudgetCreate,BudgetResponse,BudgetSummaryResponse,BudgetUpdate
from dependencies import get_current_user
from sqlalchemy.exc import IntegrityError

router=APIRouter(prefix="/budgets",
                 tags=["BudgetManagement"])

@router.post("/",status_code=201,response_model=BudgetResponse)
def create_budget(budget_data:BudgetCreate,
                  db:Session=Depends(get_db),
                  current_user=Depends(get_current_user)):
    new_budget=Budget(
        amount=budget_data.amount,
        category=budget_data.category,
        month=budget_data.month,
        year=budget_data.year,
        user_id=current_user.id
    )
    
    db.add(new_budget)
    try:
        db.commit()
        db.refresh(new_budget)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A budget for this category and month already exists"
        )

    return new_budget

@router.get("/",response_model=list[BudgetResponse])
def get_all_budget(db:Session=Depends(get_db),
               current_user=Depends(get_current_user)):
    budget=db.query(Budget).filter(Budget.user_id==current_user.id).all()
    if not budget:
        return []
    return budget

@router.get("/{budget_id}",response_model=BudgetResponse)
def get_budget(budget_id:int,
               db:Session=Depends(get_db),
               current_user=Depends(get_current_user)
               ):
    budget=db.query(Budget).filter(Budget.id==budget_id,Budget.user_id==current_user.id).first()
    if not budget:
        raise HTTPException(status_code=404,
                            detail="Budget not found")
    return budget

@router.get("/{budget_id}/summary",response_model=BudgetSummaryResponse)
def budget_summary(budget_id:int,
                   db:Session=Depends(get_db),
                   current_user=Depends(get_current_user)):
    budget=db.query(Budget).filter(Budget.id==budget_id,Budget.user_id==current_user.id).first()
    if not budget:
        raise HTTPException(status_code=404,
                            detail="Budget not found")
    expense=db.query(Expense).filter(Expense.user_id==current_user.id).filter()
    if not expense:
        raise HTTPException(status_code=404,
                            detail="Expense not found")
    total_spent = db.query(
        func.sum(Expense.amount)
    ).filter(
        Expense.user_id == current_user.id,
        Expense.category == budget.category,
        extract("month", Expense.expense_date) == budget.month,
        extract("year", Expense.expense_date) == budget.year
    ).scalar()

    total_spent = Decimal(str(total_spent or 0))
    remaining_amount = budget.amount - total_spent
    used_percentage = float(
        (total_spent / budget.amount) * 100
    )

    return BudgetSummaryResponse(
        budget_id=budget.id,
        category=budget.category,
        month=budget.month,
        year=budget.year,
        budget_amount=budget.amount,
        total_spent=total_spent,
        remaining_amount=remaining_amount,
        used_percentage=round(used_percentage, 2)
    )
    
    

@router.patch("/{budget_id}", response_model=BudgetResponse)
def budget_update(
    budget_id: int,
    budget_data: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    update_budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.user_id == current_user.id
    ).first()

    if not update_budget:
        raise HTTPException(
            status_code=404,
            detail="Budget not found"
        )

    updates = budget_data.model_dump(
        exclude_unset=True
    )

    if not updates:
        raise HTTPException(
            status_code=400,
            detail="At least one field must be provided"
        )

    if any(value is None for value in updates.values()):
        raise HTTPException(
            status_code=422,
            detail="Fields cannot be null"
        )

    for field, value in updates.items():
        setattr(update_budget, field, value)

    try:
        db.commit()
        db.refresh(update_budget)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A budget for this category and month already exists"
        )

    return update_budget



    return update_budget

@router.delete("/{budget_id}")
def delete_budget(budget_id:int,
                  db:Session=Depends(get_db),
                  current_user=Depends(get_current_user)):
    budget=db.query(Budget).filter(Budget.id==budget_id,Budget.user_id==current_user.id).first()
    if not budget:
        raise HTTPException(status_code=404,
                            detail="Budget not found")
    db.delete(budget)
    db.commit()

    return{
        "message":"Budget deleted succesfully"
    }
