import { useState, useEffect, useRef } from 'react';
import { get } from '../api/api';
import styles from '../styles/Dashboard.module.css';
import ToDoWidget from '../components/ToDoWidget/ToDoWidget';
import HealthWidget from '../components/HealthWidget/HealthWidget';
import NutritionWidget from '../components/NutritionWidget/NutritionWidget';
import FinanceWidget from '../components/FinanceWidget/FinanceWidget';
import GoalsWidget from '../components/GoalsWidget/GoalsWidget';
import { LogOut, User } from 'lucide-react';
import TelegramModal from '../components/TelegramModal';
import GreetingHeader from '../components/Dashboard/GreetingsHeader';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    get('auth/me')
      .then((res) => setUser(res))
      .catch(() => setUser(null));
  }, []);

  const logout = async () => {
    await get('auth/logout');
    navigate('/k-board/login');
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.container}>
      <div className="flex justify-between items-start mb-6 relative">
        <GreetingHeader name={user?.name || 'Гость'} />

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="bg-white shadow rounded-full px-4 py-2 text-sm font-medium hover:bg-gray-100"
          >
            {user?.name || 'Профиль'}
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-md z-10">
              <button
                onClick={() => {
                  setTelegramModalOpen(true);
                  setDropdownOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Подключить Telegram
              </button>
              <button
                onClick={logout}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-100"
              >
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        <ToDoWidget />
        <HealthWidget />
        <NutritionWidget />
        <GoalsWidget />
        <FinanceWidget />
      </div>

      <TelegramModal isOpen={telegramModalOpen} onClose={() => setTelegramModalOpen(false)} />
    </div>
  );
}