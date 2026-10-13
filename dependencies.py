from fastapi.security import HTTPAuthorizationCredentials,HTTPBearer
from fastapi import Depends
from fastapi import HTTPException
from database import get_db
from models import User
from routers.auth import SECRET_KEY,ALGORITHM
from sqlalchemy.orm import Session
import jwt

security=HTTPBearer()

def get_current_user(credentials:HTTPAuthorizationCredentials=Depends(security),
                     db:Session=Depends(get_db)):
    token=credentials.credentials
    try:
        payload=jwt.decode(
            token,SECRET_KEY,algorithms=[ALGORITHM]

    )
        user_id=payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401,detail="Invalid token ")
        user_id=int(user_id)
        user=db.query(User).filter(User.id==user_id).first()
        if not user:
            raise HTTPException(status_code=401,detail="User not found")
        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401,detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401,detail="Invalid Token")
