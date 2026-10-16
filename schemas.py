from pydantic import BaseModel,EmailStr,ConfigDict,Field
from datetime import date,datetime
from decimal import Decimal

class UserCreate(BaseModel):
    name:str
    email:EmailStr
    password:str

class UserResponse(BaseModel):

    model_config=ConfigDict(from_attributes=True)

    id:int
    name:str
    email:str
    created_at:datetime

class ExpenseCreate(BaseModel):
   
    title:str=Field(min_length=1 , max_length=50)
    category:str=Field(min_length=1, max_length=50)
    amount:Decimal=Field(gt=0,max_digits=10,decimal_places=2)
    description:str | None= Field(default=None,max_length=100)  
    expense_date:date

class ExpenseResponse(BaseModel):

    model_config=ConfigDict(from_attributes=True)

    id:int
    title:str
    category:str
    amount:Decimal
    description:str | None=None
    expense_date:date
    created_at:datetime
    user_id:int

class ExpenseUpdate(BaseModel):
    title:str | None = Field(min_length=1 , max_length=50 , default=None)
    category:str | None = Field(min_length=1, max_length=50, default=None)
    amount:Decimal | None = Field(gt=0,max_digits=10,decimal_places=2,default=None)
    description:str | None = Field(default=None,max_length=100)
    expense_date:date | None = None

class CategorySummary(BaseModel):
    category:str
    total_spent:Decimal
    expense_count:int

class ExpenseSummaryResponse(BaseModel):
    total_spent:Decimal
    expense_count:int
    category_summary:list[CategorySummary]


class LoginUser(BaseModel):
    email:EmailStr
    password:str

class LoginResponse(BaseModel):
    access_token:str
    token_type:str

class MonthlySummaryItem(BaseModel):
    month:int=Field(ge=1,le=12)
    total_spent:Decimal
    expense_count:int=Field(ge=0)

class MonthlyAnalyticsResponse(BaseModel):
    year:int
    total_spent:Decimal
    monthly_summary:list[MonthlySummaryItem]

class BudgetCreate(BaseModel):
    amount:Decimal=Field(gt=0,max_digits=10,decimal_places=2)
    category:str=Field(min_length=1,max_length=50)
    month:int=Field(ge=1,le=12)
    year:int=Field(ge=2000,le=2100)

class BudgetResponse(BaseModel):
    model_config=ConfigDict(from_attributes=True)
    
    id:int
    amount:Decimal
    category:str
    month:int
    year:int
    user_id:int

class BudgetSummaryResponse(BaseModel):

    budget_id:int
    category:str
    month:int
    year:int
    budget_amount:Decimal
    total_spent:Decimal
    remaining_amount:Decimal
    used_percentage:float

class BudgetUpdate(BaseModel):
    amount:Decimal|None=Field(default=None,gt=0,max_digits=10,decimal_places=2) 
    category:str|None=Field(default=None,min_length=1,max_length=50) 
    month:int|None=Field(default=None,ge=1,le=12)  
    year:int|None=Field(default=None,ge=2000,le=2100)  

