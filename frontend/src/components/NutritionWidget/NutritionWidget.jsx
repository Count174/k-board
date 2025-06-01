import { useState } from 'react';
import OAuth from 'oauth-1.0a';
import CryptoJS from 'crypto-js';
import styles from './NutritionWidget.module.css';

export const FatSecretWidget = () => {
  const [foods, setFoods] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Ваши ключи из FatSecret
  const consumerKey = '88e5b629807b456b8f8e28e37ebf581f';
  const consumerSecret = 'e7f8f20a1b8d4df2b91fdf980a1edefa';
  
  // Создаем OAuth клиент
  const oauth = OAuth({
    consumer: {
      key: consumerKey,
      secret: consumerSecret
    },
    signature_method: 'HMAC-SHA1',
    hash_function: (baseString, key) => {
      return CryptoJS.HmacSHA1(baseString, key).toString(CryptoJS.enc.Base64);
    }
  });

  const searchFood = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const requestData = {
        url: 'http://localhost:8000/api/fatsecret', // Ваш бэкенд
        method: 'POST',
        data: {
          method: 'foods.search',
          search_expression: query,
          format: 'json'
        }
      };
      
      const token = {};
      const authHeader = oauth.toHeader(oauth.authorize({
        url: 'https://platform.fatsecret.com/rest/server.api', // Оригинальный URL для подписи
        method: 'POST',
        data: requestData.data
      }, token));
      
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: {
          ...authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(requestData.data)
      });
      
      const data = await response.json();
      setResults(data.foods.search_results?.food || []);
    } catch (error) {
      console.error('Error searching food:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFoodDetails = async (foodId) => {
    try {
      const requestData = {
        url: 'https://platform.fatsecret.com/rest/server.api',
        method: 'POST',
        data: {
          method: 'food.get',
          food_id: foodId,
          format: 'json'
        }
      };
      
      const token = {};
      const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
      
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: {
          ...authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(requestData.data)
      });
      
      const data = await response.json();
      return data.food;
    } catch (error) {
      console.error('Error getting food details:', error);
      return null;
    }
  };

  const addFood = async (food) => {
    const details = await getFoodDetails(food.food_id);
    if (!details) return;
    
    const serving = details.servings.serving[0]; // Берем первую порцию
    const newFood = {
      id: food.food_id,
      name: food.food_name,
      calories: parseFloat(serving.calories),
      protein: parseFloat(serving.protein),
      fats: parseFloat(serving.fat),
      carbs: parseFloat(serving.carbohydrate),
      serving: `${serving.serving_description} (${serving.metric_serving_amount}${serving.metric_serving_unit})`
    };
    
    setFoods([...foods, newFood]);
    setResults([]);
  };

  return (
    <div className={styles.widget}>
      <h2>Питание</h2>
      
      <div className={styles.searchContainer}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти продукт..."
          className={styles.searchInput}
        />
        <button 
          onClick={searchFood} 
          disabled={loading}
          className={styles.searchButton}
        >
          {loading ? 'Поиск...' : 'Найти'}
        </button>
      </div>

      {results.length > 0 && (
        <div className={styles.resultsContainer}>
          <h3>Результаты поиска:</h3>
          <ul className={styles.resultsList}>
            {results.map((food) => (
              <li 
                key={food.food_id} 
                onClick={() => addFood(food)}
                className={styles.resultItem}
              >
                <span className={styles.foodName}>{food.food_name}</span>
                <span className={styles.foodType}>{food.food_type}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.consumedContainer}>
        <h3>Съедено сегодня:</h3>
        {foods.length === 0 ? (
          <p className={styles.emptyMessage}>Добавьте продукты, которые вы употребили</p>
        ) : (
          <ul className={styles.foodList}>
            {foods.map((food) => (
              <li key={food.id} className={styles.foodItem}>
                <div className={styles.foodHeader}>
                  <span className={styles.foodTitle}>{food.name}</span>
                  <span className={styles.foodCalories}>{food.calories} ккал</span>
                </div>
                <div className={styles.foodDetails}>
                  <span>Б: {food.protein}g</span>
                  <span>Ж: {food.fats}g</span>
                  <span>У: {food.carbs}g</span>
                  <span className={styles.serving}>{food.serving}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FatSecretWidget;