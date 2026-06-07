import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import UserHistoryPage from './HistoryPage';
import ForgotPasswordPage from './ForgotPasswordPage';
import ResetPasswordPage from './ResetPasswordPage';
import HelicopterPage from './HelicopterPage';
import MovingPage from './MovingPage';
import SettingsPage from './SettingsPage';
import TasksPage from './TasksPage';
import FinancePage from './FinancePage';
import GoalsPage from './GoalsPage';
import BudgetPage from './BudgetPage';
import LoansPage from './LoansPage';
import WorkoutsPage from './WorkoutsPage';
import HealthPage from './HealthPage';
import AppShell from '../components/layout/AppShell';
import '../styles/brand.css';
import '../styles/index.css';

// Временный лендинг-заглушка (потом заменишь на реальный компонент)
function Landing() {
  return (
    <div style={{ padding: 24, color: '#fff' }}>
      <h1>Oubaitori</h1>
      <p>Лендинг в разработке</p>
      <a href="/app/login" style={{ color: '#c9cbff' }}>Войти</a>
    </div>
  );
}

function isLoggedIn() {
  return document.cookie.includes('userId=');
}

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

function PrivateLayout() {
  return (
    <PrivateRoute>
      <AppShell />
    </PrivateRoute>
  );
}

function PublicHome() {
  // Если залогинен — сразу в приложение
  return isLoggedIn() ? <Navigate to="/dashboard" replace /> : <Landing />;
}

export default function App() {
  return (
    <BrowserRouter basename="/app">
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
        <Route
          path="/forgot-password"
          element={isLoggedIn() ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />}
        />
        <Route
          path="/reset-password"
          element={isLoggedIn() ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />}
        />

        {/* CEO Dashboard — доступ по секретному токену */}
        <Route path="/helicopter" element={<HelicopterPage />} />

        {/* Переезд — отдельная пара логин/пароль из .env (не основная БД) */}
        <Route path="/moving" element={<MovingPage />} />

        {/* Приватные страницы в общем shell */}
        <Route path="/" element={<PrivateLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="budget" element={<BudgetPage />} />
          <Route path="loans" element={<LoansPage />} />
          <Route path="workouts" element={<WorkoutsPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="history" element={<UserHistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Фолбэк */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}