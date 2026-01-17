const db = require('../db/db');

// Helpers
const all = (sql, p = []) => new Promise((res, rej) =>
  db.all(sql, p, (e, r) => e ? rej(e) : res(r || []))
);
const get = (sql, p = []) => new Promise((res, rej) =>
  db.get(sql, p, (e, r) => e ? rej(e) : res(r || null))
);
const run = (sql, p = []) => new Promise((res, rej) =>
  db.run(sql, p, function (e) {
    if (e) return rej(e);
    res({ lastID: this.lastID, changes: this.changes });
  })
);

/**
 * GET /api/categories
 * Получить все категории пользователя
 */
exports.getAll = async (req, res) => {
  try {
    const { type } = req.query; // 'expense' или 'income'
    let sql = `SELECT id, name, slug, synonyms, parent_id, type, created_at
                FROM categories
                WHERE user_id = ?`;
    const params = [req.userId];
    
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    
    sql += ' ORDER BY name';
    
    const rows = await all(sql, params);
    
    // Парсим JSON синонимы
    const categories = rows.map(cat => ({
      ...cat,
      synonyms: cat.synonyms ? JSON.parse(cat.synonyms) : []
    }));
    
    res.json(categories);
  } catch (e) {
    console.error('categories.getAll error:', e);
    res.status(500).json({ error: 'failed_to_get_categories' });
  }
};

/**
 * POST /api/categories
 * Создать новую категорию
 */
exports.create = async (req, res) => {
  try {
    const { name, type = 'expense', synonyms = [], parent_id = null } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'name_required' });
    }
    
    // Генерируем slug из name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-zа-яё0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    // Проверяем уникальность slug для пользователя
    const existing = await get(
      'SELECT id FROM categories WHERE user_id = ? AND slug = ?',
      [req.userId, slug]
    );
    
    if (existing) {
      return res.status(400).json({ error: 'category_already_exists' });
    }
    
    const result = await run(
      `INSERT INTO categories (user_id, name, slug, synonyms, type, parent_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.userId, name, slug, JSON.stringify(synonyms || []), type, parent_id]
    );
    
    res.status(201).json({ id: result.lastID, slug });
  } catch (e) {
    console.error('categories.create error:', e);
    res.status(500).json({ error: 'failed_to_create_category' });
  }
};

/**
 * PUT /api/categories/:id
 * Обновить категорию
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, synonyms, parent_id } = req.body;
    
    // Проверяем, что категория принадлежит пользователю
    const existing = await get(
      'SELECT id FROM categories WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );
    
    if (!existing) {
      return res.status(404).json({ error: 'category_not_found' });
    }
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    
    if (synonyms !== undefined) {
      updates.push('synonyms = ?');
      params.push(JSON.stringify(synonyms));
    }
    
    if (parent_id !== undefined) {
      updates.push('parent_id = ?');
      params.push(parent_id);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'no_updates' });
    }
    
    params.push(id, req.userId);
    
    await run(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );
    
    res.json({ success: true });
  } catch (e) {
    console.error('categories.update error:', e);
    res.status(500).json({ error: 'failed_to_update_category' });
  }
};

/**
 * DELETE /api/categories/:id
 * Удалить категорию
 */
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверяем, что категория принадлежит пользователю
    const existing = await get(
      'SELECT id FROM categories WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );
    
    if (!existing) {
      return res.status(404).json({ error: 'category_not_found' });
    }
    
    // Проверяем, используется ли категория в финансах
    const used = await get(
      'SELECT COUNT(*) AS cnt FROM finances WHERE category_id = ?',
      [id]
    );
    
    if (used && used.cnt > 0) {
      return res.status(400).json({ 
        error: 'category_in_use',
        message: 'Категория используется в записях. Сначала удалите или измените записи.'
      });
    }
    
    await run(
      'DELETE FROM categories WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );
    
    res.status(204).send();
  } catch (e) {
    console.error('categories.remove error:', e);
    res.status(500).json({ error: 'failed_to_delete_category' });
  }
};

/**
 * POST /api/categories/:id/synonyms
 * Добавить синонимы к категории
 */
exports.addSynonyms = async (req, res) => {
  try {
    const { id } = req.params;
    const { synonyms } = req.body;
    
    if (!Array.isArray(synonyms) || synonyms.length === 0) {
      return res.status(400).json({ error: 'synonyms_array_required' });
    }
    
    const category = await get(
      'SELECT synonyms FROM categories WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );
    
    if (!category) {
      return res.status(404).json({ error: 'category_not_found' });
    }
    
    const existing = category.synonyms ? JSON.parse(category.synonyms) : [];
    const newSynonyms = [...new Set([...existing, ...synonyms])]; // Убираем дубликаты
    
    await run(
      'UPDATE categories SET synonyms = ? WHERE id = ? AND user_id = ?',
      [JSON.stringify(newSynonyms), id, req.userId]
    );
    
    res.json({ synonyms: newSynonyms });
  } catch (e) {
    console.error('categories.addSynonyms error:', e);
    res.status(500).json({ error: 'failed_to_add_synonyms' });
  }
};

/**
 * POST /api/categories/find
 * Найти категорию по тексту (для автоопределения)
 */
exports.findByText = async (req, res) => {
  try {
    const { text, type = 'expense' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'text_required' });
    }
    
    const normalizedText = text.toLowerCase().trim();
    
    // Получаем все категории пользователя нужного типа
    const categories = await all(
      `SELECT id, name, slug, synonyms, type
       FROM categories
       WHERE user_id = ? AND type = ?`,
      [req.userId, type]
    );
    
    // Ищем совпадение по синонимам
    for (const cat of categories) {
      const synonyms = cat.synonyms ? JSON.parse(cat.synonyms) : [];
      const normalizedSynonyms = synonyms.map(s => s.toLowerCase().trim());
      
      // Проверяем точное совпадение или вхождение
      if (normalizedSynonyms.includes(normalizedText) ||
          normalizedSynonyms.some(s => normalizedText.includes(s)) ||
          normalizedText.includes(cat.name.toLowerCase())) {
        return res.json({
          category_id: cat.id,
          category_name: cat.name,
          slug: cat.slug
        });
      }
    }
    
    // Не найдено
    res.json({ category_id: null });
  } catch (e) {
    console.error('categories.findByText error:', e);
    res.status(500).json({ error: 'failed_to_find_category' });
  }
};
