// components/NutritionWidget/NutritionWidget.jsx
import { useEffect, useState } from 'react';
import styles from './NutritionWidget.module.css';

export default function NutritionWidget() {
  const [token, setToken] = useState('');
  const [calories, setCalories] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchToken() {
      const res = await fetch('https://oauth.fatsecret.com/connect/token', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${import.meta.env.VITE_FATSECRET_KEY}:${import.meta.env.VITE_FATSECRET_SECRET}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials&scope=basic',
      });
      const data = await res.json();
      setToken(data.access_token);
    }

    fetchToken();
  }, []);

  useEffect(() => {
    if (!token) return;

    async function fetchData() {
      const res = await fetch('https://platform.fatsecret.com/rest/server.api', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          method: 'foods.search',
          search_expression: 'apple',
          format: 'json',
        }),
      });

      const data = await res.json();
      const cal = data?.foods?.food?.[0]?.food_description?.match(/(\d+) calories/);
      setCalories(cal ? cal[1] : 'неизвестно');
      setLoading(false);
    }

    fetchData();
  }, [token]);

  return (
    <div className={styles.card}>
      <h2>Рацион</h2>
      {loading ? <p>Загрузка...</p> : <p>Яблоко: {calories} ккал</p>}
    </div>
  );
}