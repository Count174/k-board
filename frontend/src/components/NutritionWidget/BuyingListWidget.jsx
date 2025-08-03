import { useState, useEffect } from "react";
import { get, post, remove } from "../../api/api";
import styles from "./BuyingListWidget.module.css";
import { Trash2, CheckCircle, Circle } from "lucide-react";

export default function BuyingListWidget() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("offline");
  const [reminderDate, setReminderDate] = useState("");

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await get("buying-list");
      setItems(data);
    } catch (err) {
      console.error("Ошибка загрузки списка покупок:", err);
    }
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    try {
      const newItem = await post("buying-list", {
        title,
        category,
        reminder_date: reminderDate || null,
      });
      setItems([newItem, ...items]);
      setTitle("");
      setReminderDate("");
    } catch (err) {
      console.error("Ошибка добавления:", err);
    }
  };

  const toggleComplete = async (id) => {
    try {
      await post(`buying-list/${id}/toggle`);
      loadItems();
    } catch (err) {
      console.error("Ошибка обновления:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await remove(`buying-list/${id}`);
      setItems(items.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Ошибка удаления:", err);
    }
  };

  const categoryLabels = {
    offline: "🏬 Магазин",
    delivery: "📦 Доставка",
    marketplace: "🛒 Маркетплейс",
  };

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>🛍 Список покупок</h2>

      <div className={styles.form}>
        <input
          type="text"
          placeholder="Что купить?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="offline">🏬 Магазин</option>
          <option value="delivery">📦 Доставка</option>
          <option value="marketplace">🛒 Маркетплейс</option>
        </select>
        <input
          type="date"
          value={reminderDate}
          onChange={(e) => setReminderDate(e.target.value)}
        />
        <button onClick={handleAdd}>Добавить</button>
      </div>

      <div className={styles.list}>
        {items.length === 0 ? (
          <p className={styles.empty}>Пока пусто. Добавь первую покупку 👆</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`${styles.item} ${
                item.completed ? styles.completed : ""
              }`}
            >
              <div className={styles.itemInfo}>
                <button
                  className={styles.checkBtn}
                  onClick={() => toggleComplete(item.id)}
                >
                  {item.completed ? (
                    <CheckCircle size={20} />
                  ) : (
                    <Circle size={20} />
                  )}
                </button>
                <div>
                  <p className={styles.itemTitle}>{item.title}</p>
                  <span className={styles.category}>
                    {categoryLabels[item.category] || item.category}
                  </span>
                  {item.reminder_date && (
                    <span className={styles.reminder}>
                      Напомнить: {new Date(item.reminder_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <button
                className={styles.deleteBtn}
                onClick={() => handleDelete(item.id)}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}