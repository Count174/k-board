from fastapi import FastAPI
from routers import todo
from models.todo import Todo
from db.database import engine, Base

app = FastAPI()
Base.metadata.create_all(bind=engine)

app.include_router(todo.router)

Base.metadata.create_all(bind=engine)