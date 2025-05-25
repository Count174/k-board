from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Путь к SQLite базе данных (файл будет создан автоматически)
SQLALCHEMY_DATABASE_URL = "sqlite:///./kboard.db"

# Создаем движок SQLAlchemy
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Создаем фабрику сессий
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для моделей
Base = declarative_base()

# Dependency — используем в роутерах для получения сессии
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()