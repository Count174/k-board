import { useState, useEffect, useCallback } from 'react';
import { get, post, remove } from '../../api/api';
import Modal from "../Modal";
import ImagePicker from "../ImagePicker";
import styles from './GoalsWidget.module.css';
import Toast from '../Toast';

export default function GoalsWidget() {
  const [goals, setGoals] = useState([]);
  const [sliders, setSliders] = useState({});
  const [toast, setToast] = useState({ open: false, title: '', message: '' });
  const showToast = (title, message) =>
    setToast({ open: true, title, message });
  const hideToast = () => setToast(t => ({ ...t, open: false }));

  // модалка создания
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    target: "",
    unit: "",
    is_binary: 0,   // 0 | 1
    image: ""
  });

  useEffect(() => {
    get('goals')
      .then((data) => {
        setGoals(data);
        const sliderStates = {};
        data.forEach((goal) => {
          sliderStates[goal.id] = goal.current;
        });
        setSliders(sliderStates);
      })
      .catch(console.error);
  }, []);

  function normalizeImageUrl(urlOrKeyword, opts = { w: 1200, h: 400 }) {
    const { w, h } = opts;
    const size = `${w}x${h}`;
    if (!urlOrKeyword) return '';
  
    // Если это не URL — считаем, что это ключевое слово
    try {
      const u = new URL(urlOrKeyword);
      // Страница фото Unsplash: /photos/<slug-or-id>
      if (u.hostname.includes('unsplash.com') && u.pathname.startsWith('/photos/')) {
        const last = u.pathname.split('/').pop() || '';
        const id = last.split('-').pop(); // например "8lnbXtxFGZw"
        if (id && id.length >= 8) {
          // Стабильная прямая ссылка на файл
          return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
        }
      }
      // Уже прямая картинка
      if (u.hostname.includes('images.unsplash.com')) {
        const params = u.search ? `${u.search}&` : '?';
        return `${u.origin}${u.pathname}${params}auto=format&fit=crop&w=${w}&h=${h}&q=80`;
      }
      // Иначе — вернём как есть (вдруг свой CDN)
      return urlOrKeyword;
    } catch {
      // Ключевое слово
      const kw = encodeURIComponent(urlOrKeyword.trim());
      // featured устойчивее, чем «/keyword/»; всё равно оставим фолбэк
      return `https://source.unsplash.com/featured/${size}?${kw}`;
    }
  }

  const fallbackFor = (title) =>
    `https://picsum.photos/seed/${encodeURIComponent(title || 'goal')}/1200/400`;
  
  const handleSliderChange = (id, value) => {
    setSliders((prev) => ({ ...prev, [id]: value }));
  };

  const debounceSave = useCallback(
    (id, value, goal) => {
      clearTimeout(debounceSave.timeout);
      debounceSave.timeout = setTimeout(async () => {
        try {
          const resp = await post(`goals/${id}`, { current: value });

          // если бэк вернул флаг автозавершения
          if (resp?.is_completed === 1) {
            showToast('🎉 Цель достигнута', `«${goal.title}» закрыта на 100%`);
            setGoals(prev => prev.filter(g => g.id !== id));
          }
        } catch (e) {
          console.error(e);
        }
      }, 500);
    },
    [/* goals не нужен; используем id/goal из замыкания */]
  );
  
  const handleSliderCommit = (id, value) => {
    const goal = goals.find(g => g.id === id);
    debounceSave(id, value, goal);
  };

  const handleDeleteGoal = async (id) => {
    await remove(`goals/${id}`);
    setGoals((prev) => prev.filter((goal) => goal.id !== id));
  };

  const handleCompleteBinaryGoal = async (goal) => {
    try {
      const next = goal.current === 1 ? 0 : 1;
      const resp = await post(`goals/${goal.id}`, { current: next });

      if (resp?.is_completed === 1 || next === 1) {
        showToast('🎉 Цель выполнена', `«${goal.title}» закрыта`);
        setGoals(prev => prev.filter(g => g.id !== goal.id));
      } else {
        setGoals(prev =>
          prev.map(g => g.id === goal.id ? { ...g, current: next } : g)
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  // создание через модалку
  const saveNewGoal = async (e) => {
    e?.preventDefault?.();

    if (!form.title) return;
    if (!form.is_binary && !form.target) return;

    const payload = {
      title: form.title.trim(),
      target: form.is_binary ? 1 : Number(form.target || 0),
      unit: form.unit?.trim() || "",
      is_binary: form.is_binary ? 1 : 0,
      image: normalizeImageUrl(form.image)
    };

    try {
      const created = await post('goals', payload);
      setGoals((prev) => [...prev, created]);
      setSliders((prev) => ({ ...prev, [created.id]: created.current || 0 }));

      // сброс формы + закрыть модалку
      setForm({ title: "", target: "", unit: "", is_binary: 0, image: "" });
      setOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <h2>🎯 Мои цели</h2>
        <button className={styles.primaryBtn} onClick={() => setOpen(true)}>
          + Добавить цель
        </button>
      </div>

      {/* список целей */}
      {goals.map((goal) => (
        <div key={goal.id} className={styles.goalCard}>
          {goal.image && (
            <img
              src={goal.image}
              alt=""
              className={styles.goalImage}
              referrerPolicy="no-referrer"
              data-title={goal.title}                 // <- прокидываем заголовок в атрибут
              onError={(e) => {
                if (!e.currentTarget.dataset.fallback) {
                  e.currentTarget.dataset.fallback = '1';
                  const t = e.currentTarget.dataset.title || 'goal';
                  e.currentTarget.src = fallbackFor(t);  // <- без обращения к goal
           }
         }}
       />
      )}
          <h3 className={styles.goalTitle}>{goal.title}</h3>

          {!goal.is_binary ? (
            <>
              <p className={styles.progressText}>
                {sliders[goal.id] || 0} {goal.unit} из {goal.target} {goal.unit}
              </p>
              <input
                type="range"
                min="0"
                max={goal.target}
                value={sliders[goal.id] || 0}
                onChange={(e) => handleSliderChange(goal.id, Number(e.target.value))}
                onMouseUp={(e) => handleSliderCommit(goal.id, Number(e.target.value))}
                className={styles.slider}
              />
            </>
          ) : (
            <div className={styles.binaryLabel}>
              <span>Статус:</span>
              <button
                className={`${styles.binaryButton} ${
                  goal.current === 1 ? styles.completed : styles.notCompleted
                }`}
                onClick={() => handleCompleteBinaryGoal(goal)}
              >
                {goal.current === 1 ? 'Выполнено' : 'Не выполнено'}
              </button>
            </div>
          )}

          <button
            onClick={() => handleDeleteGoal(goal.id)}
            className={styles.deleteButton}
            title="Удалить"
          >
            🗑️
          </button>
        </div>
      ))}

      {/* модалка создания цели */}
      <Modal open={open} onClose={() => setOpen(false)} title="Новая цель">
        <form className={styles.modalForm} onSubmit={saveNewGoal}>
          <input
            className={styles.input}
            type="text"
            placeholder="Название цели"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />

          <div className={styles.modalRow}>
            <input
              className={styles.input}
              type="number"
              placeholder="Целевое значение"
              disabled={!!form.is_binary}
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />

            <select
              className={styles.input}
              value={form.is_binary ? "binary" : "usual"}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_binary: e.target.value === "binary" ? 1 : 0 }))
              }
            >
              <option value="usual">Обычная цель</option>
              <option value="binary">Бинарная (сделал/не сделал)</option>
            </select>

            <input
              className={styles.input}
              type="text"
              placeholder="Единица (кг, ₽, км...)"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </div>

          <ImagePicker
            value={form.image}
            titleHint={form.title}
            onChange={(url) => setForm((f) => ({ ...f, image: url }))}
          />

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className={styles.primaryBtn}>
              Сохранить
            </button>
          </div>
        </form>
      </Modal>
      <Toast open={toast.open} title={toast.title} message={toast.message} onClose={hideToast} />
    </div>
  );
}