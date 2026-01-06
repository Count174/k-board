import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import UserHistoryPage from './HistoryPage';
import '../styles/index.css';

// Временный лендинг-заглушка (потом заменишь на реальный компонент)
function Landing() {
  return (
    <div style={{ padding: 24, color: '#fff' }}>
      <h1>Oubaitori</h1>
      <p>Лендинг в разработке</p>
      <a href="/login" style={{ color: '#c9cbff' }}>Войти</a>
    </div>
  );
}

function isLoggedIn() {
  return document.cookie.includes('userId=');
}

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

function PublicHome() {
  // Если залогинен — сразу в приложение
  return isLoggedIn() ? <Navigate to="/dashboard" replace /> : <Landing />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Публичная главная */}
        <Route path="/" element={<PublicHome />} />

        {/* Публичные страницы */}
        <Route
          path="/login"
          element={isLoggedIn() ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={isLoggedIn() ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
        />

        {/* Приватные страницы */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/history"
          element={
            <PrivateRoute>
              <UserHistoryPage />
            </PrivateRoute>
          }
        />

        {/* Фолбэк */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}