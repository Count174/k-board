from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import httpx
from urllib.parse import parse_qs
from pydantic import BaseModel
from typing import Optional
import sqlite3
from datetime import date

app = FastAPI()

# Модель для задач
class Task(BaseModel):
    title: str
    due_date: Optional[date] = None
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None
    is_completed: bool = False

# Инициализация БД
def init_db():
    conn = sqlite3.connect('kboard.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            due_date DATE,
            is_recurring BOOLEAN DEFAULT 0,
            recurrence_pattern TEXT,
            is_completed BOOLEAN DEFAULT 0
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# CRUD операции
@app.post("/tasks/")
def create_task(task: Task):
    conn = sqlite3.connect('kboard.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO tasks (title, due_date, is_recurring, recurrence_pattern, is_completed)
        VALUES (?, ?, ?, ?, ?)
    ''', (task.title, task.due_date, task.is_recurring, task.recurrence_pattern, task.is_completed))
    conn.commit()
    task_id = cursor.lastrowid
    conn.close()
    return {"id": task_id}

@app.get("/tasks/")
def get_tasks(completed: bool = None):
    conn = sqlite3.connect('kboard.db')
    cursor = conn.cursor()
    query = "SELECT * FROM tasks"
    params = []
    
    if completed is not None:
        query += " WHERE is_completed = ?"
        params.append(completed)
    
    cursor.execute(query, params)
    tasks = cursor.fetchall()
    conn.close()
    return {"tasks": tasks}

@app.put("/tasks/{task_id}")
def update_task(task_id: int, task: Task):
    conn = sqlite3.connect('kboard.db')
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE tasks 
        SET title = ?, due_date = ?, is_recurring = ?, recurrence_pattern = ?, is_completed = ?
        WHERE id = ?
    ''', (task.title, task.due_date, task.is_recurring, task.recurrence_pattern, task.is_completed, task_id))
    conn.commit()
    conn.close()
    return {"message": "Task updated"}

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int):
    conn = sqlite3.connect('kboard.db')
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return {"message": "Task deleted"}

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Или "*" для всех
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/fatsecret")
async def fatsecret_proxy(request: Request):
    form_data = await request.form()
    params = {
        "method": form_data.get("method"),
        "search_expression": form_data.get("search_expression"),
        "format": "json"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://platform.fatsecret.com/rest/server.api",
            data=params,
            headers={
                "Authorization": request.headers.get("Authorization"),
                "Content-Type": "application/x-www-form-urlencoded"
            }
        )
        return response.json()