from fastapi import APIRouter,Depends,HTTPException
from fastapi import Request
from sqlalchemy.orm import Session
from pwdlib import PasswordHash
from models import User,PasswordResetToken
from schemas import UserCreate,UserResponse,LoginUser,LoginResponse,ResetPasswordRequest,ForgetPasswordRequest
from database import get_db
import jwt
from datetime import timezone,timedelta,datetime
import os
from dotenv import load_dotenv
import secrets
import hashlib
import hmac
from redis_client import redis_client
from email_service import send_otp_email

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

@router.post("/forgot-password")
def forgot_password(forget_pass:ForgetPasswordRequest,
                    request:Request,
                    db:Session=Depends(get_db)
                    ):
    client_ip=request.client.host
    redis_key=f"forget_password:{client_ip}"
    count=redis_client.incr(redis_key)
    if count==1:
        redis_client.expire(redis_key,900)
    if count>5:
         raise HTTPException(
             status_code=429,
            detail="Too many password reset request"
            )
    user=db.query(User).filter(User.email==forget_pass.email).first()
    if not user:
     return {
        "message": "If an account exists for this email, an OTP has been sent."
    }
    otp=f"{secrets.randbelow(1_000_000):06d}"

    otp_secret=os.getenv("OTP_HASH_SECRET")

    otp_hash=hmac.new(otp_secret.encode(),
                      otp.encode(),
                      hashlib.sha256).hexdigest()
    otp_key = f"password_reset:otp:{user.id}"

    redis_client.set(
    otp_key,
    otp_hash,
    ex=300
)
    send_otp_email(forget_pass.email, otp)
    return {
    "message": "If an account exists for this email, an OTP has been sent."
}

@router.post("/reset-password")
def reset_password(
    reset_data: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == reset_data.email
    ).first()

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired OTP"
        )

    otp_key = f"password_reset:otp:{user.id}"

    stored_otp = redis_client.get(otp_key)

    if not stored_otp:
        raise HTTPException(
            status_code=400,
            detail="OTP expired or not found"
        )

    otp_secret = os.getenv("OTP_HASH_SECRET")

    entered_otp_hash = hmac.new(
        otp_secret.encode(),
        reset_data.otp.encode(),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(entered_otp_hash, stored_otp):

        attempt_key = f"password_reset:attempts:{user.id}"

        attempts = redis_client.incr(attempt_key)

        if attempts == 1:
            redis_client.expire(attempt_key, 300)

        if attempts >= 5:
            redis_client.delete(otp_key)

            raise HTTPException(
                status_code=429,
                detail="Too many incorrect OTP attempts. Request a new OTP."
            )

        raise HTTPException(
            status_code=400,
            detail="Invalid OTP"
        )

    user.password_hash = password_hash.hash(
        reset_data.new_password
    )

    db.commit()

    redis_client.delete(otp_key)
    redis_client.delete(f"password_reset:attempts:{user.id}")

    return {
        "message": "Password reset successfully. Please login with your new password."
    }


