import { Navigate } from 'react-router-dom';

export default function PrivateRoute({ children }) {
  const hasCookie = document.cookie.includes('userId=');
  return hasCookie ? children : <Navigate to="/k-board/login" replace />;
}