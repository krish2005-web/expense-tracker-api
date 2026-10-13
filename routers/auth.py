from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy.orm import Session
from pwdlib import PasswordHash
from models import User
from schemas import UserCreate,UserResponse,LoginUser,LoginResponse
from database import get_db
import jwt
from datetime import timezone,timedelta,datetime
import os
from dotenv import load_dotenv

load_dotenv()

router=APIRouter(prefix="/auth",
                 tags=["Authentication"])

password_hash=PasswordHash.recommended()
SECRET_KEY=os.getenv("SECRET_KEY")
ALGORITHM=os.getenv("ALGORITHM")

@router.post("/register",status_code=201,response_model=UserResponse)
def create_user(user_data:UserCreate,
                db:Session=Depends(get_db)):
    existing_user=db.query(User).filter(User.email==user_data.email).first()
    if  existing_user:
        raise HTTPException(status_code=409,
                            detail="user already registered")
    new_user=User(
        name=user_data.name,
        email=user_data.email,
        password_hash=password_hash.hash(user_data.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user



@router.post("/login", status_code=200, response_model=LoginResponse)
def user_login(
    login_data: LoginUser,
    db: Session = Depends(get_db)
):
    username = db.query(User).filter(
        User.email == login_data.email
    ).first()

    if not username:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    is_valid = password_hash.verify(
        login_data.password,
        username.password_hash
    )

    if not is_valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    payload = {
        "sub": str(username.id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=30)
    }

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }