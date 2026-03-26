const {
  get,
  run,
  getUserAccounts,
  getAccountById,
  ensureDefaultAccountForUser,
  setDefaultAccount,
} = require('../utils/accountsService');
const { normalizeCurrency } = require('../utils/fxService');

exports.list = async (req, res) => {
  try {
    const rows = await getUserAccounts(req.userId);
    if (!rows.length) {
      await ensureDefaultAccountForUser(req.userId);
      const seeded = await getUserAccounts(req.userId);
      return res.json(seeded);
    }
    return res.json(rows);
  } catch (e) {
    console.error('accounts.list error:', e);
    return res.status(500).json({ error: 'accounts_list_failed' });
  }
};

exports.create = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const bankName = String(req.body?.bank_name || '').trim() || null;
    const currency = normalizeCurrency(req.body?.currency || 'RUB');
    const balance = Number(req.body?.balance ?? 0);
    const isDefault = Boolean(req.body?.is_default);

    if (!name) return res.status(400).json({ error: 'name_required' });
    if (!currency) return res.status(400).json({ error: 'unsupported_currency' });
    if (!Number.isFinite(balance)) return res.status(400).json({ error: 'invalid_balance' });

    const created = await run(
      `INSERT INTO accounts (user_id, name, bank_name, currency, balance, is_default)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [req.userId, name, bankName, currency, balance]
    );
    if (isDefault) {
      await setDefaultAccount(req.userId, created.lastID);
    }
    const row = await getAccountById(req.userId, created.lastID);
    return res.status(201).json(row);
  } catch (e) {
    console.error('accounts.create error:', e);
    return res.status(500).json({ error: 'account_create_failed' });
  }
};

exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid_account_id' });
    const existing = await getAccountById(req.userId, id);
    if (!existing) return res.status(404).json({ error: 'account_not_found' });

    const name = req.body?.name != null ? String(req.body.name).trim() : existing.name;
    const bankName = req.body?.bank_name != null ? (String(req.body.bank_name).trim() || null) : existing.bank_name;
    const currency = req.body?.currency != null ? normalizeCurrency(req.body.currency) : existing.currency;
    const balance = req.body?.balance != null ? Number(req.body.balance) : Number(existing.balance || 0);
    const isDefault = req.body?.is_default === true;

    if (!name) return res.status(400).json({ error: 'name_required' });
    if (!currency) return res.status(400).json({ error: 'unsupported_currency' });
    if (!Number.isFinite(balance)) return res.status(400).json({ error: 'invalid_balance' });

    if (currency !== existing.currency) {
      const tx = await get(`SELECT COUNT(1) AS cnt FROM finances WHERE user_id = ? AND account_id = ?`, [req.userId, id]);
      if (Number(tx?.cnt || 0) > 0) {
        return res.status(400).json({ error: 'cannot_change_currency_with_transactions' });
      }
    }

    await run(
      `UPDATE accounts
          SET name = ?, bank_name = ?, currency = ?, balance = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?`,
      [name, bankName, currency, balance, id, req.userId]
    );

    if (isDefault) {
      await setDefaultAccount(req.userId, id);
    }
    const row = await getAccountById(req.userId, id);
    return res.json(row);
  } catch (e) {
    console.error('accounts.update error:', e);
    return res.status(500).json({ error: 'account_update_failed' });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid_account_id' });
    const existing = await getAccountById(req.userId, id);
    if (!existing) return res.status(404).json({ error: 'account_not_found' });

    const total = await get(`SELECT COUNT(1) AS cnt FROM accounts WHERE user_id = ?`, [req.userId]);
    if (Number(total?.cnt || 0) <= 1) {
      return res.status(400).json({ error: 'cannot_delete_last_account' });
    }

    const tx = await get(`SELECT COUNT(1) AS cnt FROM finances WHERE user_id = ? AND account_id = ?`, [req.userId, id]);
    if (Number(tx?.cnt || 0) > 0) {
      return res.status(400).json({ error: 'account_has_transactions' });
    }

    await run(`DELETE FROM accounts WHERE id = ? AND user_id = ?`, [id, req.userId]);

    if (existing.is_default) {
      const next = await get(
        `SELECT id FROM accounts WHERE user_id = ? ORDER BY id ASC LIMIT 1`,
        [req.userId]
      );
      if (next?.id) await setDefaultAccount(req.userId, next.id);
    }

    return res.status(204).send();
  } catch (e) {
    console.error('accounts.remove error:', e);
    return res.status(500).json({ error: 'account_delete_failed' });
  }
};

