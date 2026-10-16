from sqlalchemy import Column,Integer,String,DateTime,func,Date,Text,ForeignKey,Numeric,UniqueConstraint
from datetime import date
from database import Base

class User(Base):
    __tablename__="users"

    id=Column(Integer,primary_key=True,index=True)
    name=Column(String(100),nullable=False)
    email=Column(String(100),nullable=False,unique=True)
    password_hash=Column(String(255),nullable=False)
    created_at=Column(DateTime(timezone=True),server_default=func.now())


class Expense(Base):
    __tablename__="expenses"

    id=Column(Integer,primary_key=True,index=True)
    title=Column(String(50),nullable=False)
    amount=Column(Numeric(10,2),nullable=False)
    category=Column(String(50),nullable=False)
    description=Column(Text)
    expense_date=Column(Date,nullable=False)
    created_at=Column(DateTime(timezone=True),server_default=func.now())
    user_id=Column(Integer,ForeignKey("users.id"),nullable=False)

class Budget(Base):
    __tablename__="budget"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "category",
            "month",
            "year",
            name="uq_budget_user_category_month_year"
        ),
    )

    id=Column(Integer,primary_key=True,index=True)
    amount=Column(Numeric(10,2),nullable=False)
    category=Column(String(50),nullable=False)
    month=Column(Integer,nullable=False)
    year=Column(Integer,nullable=False)
    user_id=Column(Integer,ForeignKey("users.id"),nullable=False)