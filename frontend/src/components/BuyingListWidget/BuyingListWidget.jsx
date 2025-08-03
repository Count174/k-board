import React, { useState, useEffect } from "react";
import styles from "./BuyingListWidget.module.css";
import { get, post, del } from "../../api/api";

const BuyingListWidget = () => {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("store");
  const [reminderDate, setReminderDate] = useState("");

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const data = await get("/buying-list");
      setItems(data);
    } catch (error) {
      console.error("Ошибка при загрузке списка покупок:", error);
    }
  };

  const addItem = async () => {
    if (!title.trim()) return;
    try {
      await post("/buying-list", {
        title,
        category,
        reminder_date: reminderDate,
      });
      setTitle("");
      setCategory("store");
      setReminderDate("");
      fetchItems();
    } catch (error) {
      console.error("Ошибка при добавлении покупки:", error);
    }
  };

  const deleteItem = async (id) => {
    try {
      await del(`/buying-list/${id}`);
      fetchItems();
    } catch (error) {
      console.error("Ошибка при удалении покупки:", error);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>🛍️ Список покупок</h2>
      <div className={styles.form}>
        <input
          type="text"
          placeholder="Что купить?"
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className={styles.select}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="store">🛒 Магазин</option>
          <option value="delivery">🚚 Доставка</option>
          <option value="marketplace">🌐 Маркетплейс</option>
        </select>
        <input
          type="date"
          className={styles.date}
          value={reminderDate}
          onChange={(e) => setReminderDate(e.target.value)}
        />
        <button className={styles.addButton} onClick={addItem}>
          Добавить
        </button>
      </div>
      <div className={styles.list}>
        {items.length === 0 ? (
          <p className={styles.empty}>Пока пусто. Добавь первую покупку 👆</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span>{item.title}</span>
                <span>
                  {item.category === "store"
                    ? "🛒 Магазин"
                    : item.category === "delivery"
                    ? "🚚 Доставка"
                    : "🌐 Маркетплейс"}
                </span>
                {item.reminder_date && (
                  <span className={styles.dateText}>{item.reminder_date}</span>
                )}
              </div>
              <button
                className={styles.deleteButton}
                onClick={() => deleteItem(item.id)}
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BuyingListWidget;