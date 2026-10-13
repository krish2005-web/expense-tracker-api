from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base,sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

database_url=os.getenv("DATABASE_URL")

if not database_url:
    raise ValueError("DATABASE_URL is not set in .env")

engine=create_engine(database_url)
SessionLocal=sessionmaker(autoflush=False,
                          autocommit=False,
                          bind=engine)

Base=declarative_base()

def get_db():
    
        db=SessionLocal()
        try:
              yield db
        finally:
              db.close()


