import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import '../styles/index.css';

function PrivateRoute({ children }) {
  const isLoggedIn = document.cookie.includes('userId=');
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter basename="/k-board">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route path="/history" element={<History />} />
      </Routes>
    </BrowserRouter>
  );
}