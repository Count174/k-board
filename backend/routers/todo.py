from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from models.todo import TodoCreate, TodoUpdate, TodoInDB
from crud import todo as crud_todo
from typing import List

router = APIRouter(prefix="/todos", tags=["todos"])

@router.post("/", response_model=TodoInDB)
def create(todo: TodoCreate, db: Session = Depends(get_db)):
    return crud_todo.create_todo(db, todo)

@router.get("/", response_model=List[TodoInDB])
def read_all(show_done: bool = False, db: Session = Depends(get_db)):
    return crud_todo.get_todos(db, show_done)

@router.put("/{todo_id}", response_model=TodoInDB)
def update(todo_id: int, todo: TodoUpdate, db: Session = Depends(get_db)):
    updated = crud_todo.update_todo(db, todo_id, todo)
    if not updated:
        raise HTTPException(status_code=404, detail="Todo not found")
    return updated

@router.delete("/{todo_id}")
def delete(todo_id: int, db: Session = Depends(get_db)):
    deleted = crud_todo.delete_todo(db, todo_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Todo not found")
    return {"ok": True}