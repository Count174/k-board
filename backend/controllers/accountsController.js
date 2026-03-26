const {
  get,
  run,
  getUserAccounts,
  getAccountById,
  ensureDefaultAccountForUser,
  setDefaultAccount,
  convertAmountBetweenCurrencies,
} = require('../utils/accountsService');
const { normalizeCurrency, normalizeDate } = require('../utils/fxService');

exports.list = async (req, res) => {
  try {
    let rows = await getUserAccounts(req.userId);
    if (!rows.length) {
      await ensureDefaultAccountForUser(req.userId);
      rows = await getUserAccounts(req.userId);
    }
    const withCounts = await Promise.all(
      rows.map(async (a) => {
        const tx = await get(
          `SELECT COUNT(1) AS cnt FROM finances WHERE user_id = ? AND account_id = ?`,
          [req.userId, a.id]
        );
        return { ...a, transactions_count: Number(tx?.cnt || 0) };
      })
    );
    return res.json(withCounts);
  } catch (e) {
    console.error('accounts.list error:', e);
    return res.status(500).json({ error: 'accounts_list_failed' });
  }
};

exports.summary = async (req, res) => {
  try {
    let rows = await getUserAccounts(req.userId);
    if (!rows.length) {
      await ensureDefaultAccountForUser(req.userId);
      rows = await getUserAccounts(req.userId);
    }
    const today = normalizeDate();
    const enriched = await Promise.all(
      rows.map(async (a) => {
        const bal = Number(a.balance || 0);
        const balanceRub = await convertAmountBetweenCurrencies(bal, a.currency, 'RUB', today);
        return {
          ...a,
          balance_rub: Number(balanceRub.toFixed(2)),
        };
      })
    );
    const totalRub = enriched.reduce((s, a) => s + Number(a.balance_rub || 0), 0);
    return res.json({
      accounts: enriched,
      total_rub: Number(totalRub.toFixed(2)),
    });
  } catch (e) {
    console.error('accounts.summary error:', e);
    return res.status(500).json({ error: 'accounts_summary_failed' });
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

exports.removeWithStrategy = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const mode = String(req.body?.mode || '').trim(); // transfer | delete_with_transactions
    const targetAccountId = Number(req.body?.target_account_id) || null;
    if (!id) return res.status(400).json({ error: 'invalid_account_id' });
    if (!mode) return res.status(400).json({ error: 'delete_mode_required' });

    const existing = await getAccountById(req.userId, id);
    if (!existing) return res.status(404).json({ error: 'account_not_found' });

    const total = await get(`SELECT COUNT(1) AS cnt FROM accounts WHERE user_id = ?`, [req.userId]);
    if (Number(total?.cnt || 0) <= 1) {
      return res.status(400).json({ error: 'cannot_delete_last_account' });
    }

    const tx = await get(`SELECT COUNT(1) AS cnt FROM finances WHERE user_id = ? AND account_id = ?`, [req.userId, id]);
    const txCount = Number(tx?.cnt || 0);

    if (mode === 'transfer') {
      if (!targetAccountId || targetAccountId === id) {
        return res.status(400).json({ error: 'target_account_required' });
      }
      const target = await getAccountById(req.userId, targetAccountId);
      if (!target) return res.status(404).json({ error: 'target_account_not_found' });

      // 1) Переносим операции на другой счёт
      if (txCount > 0) {
        await run(
          `UPDATE finances SET account_id = ? WHERE user_id = ? AND account_id = ?`,
          [targetAccountId, req.userId, id]
        );
      }
      // 2) Переносим текущий остаток удаляемого счёта на целевой счёт
      const amountToTarget = await convertAmountBetweenCurrencies(
        Number(existing.balance || 0),
        existing.currency,
        target.currency,
        normalizeDate()
      );
      await run(
        `UPDATE accounts
            SET balance = COALESCE(balance, 0) + ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?`,
        [Number(amountToTarget || 0), targetAccountId, req.userId]
      );
      await run(`DELETE FROM accounts WHERE id = ? AND user_id = ?`, [id, req.userId]);
    } else if (mode === 'delete_with_transactions') {
      await run(`DELETE FROM finances WHERE user_id = ? AND account_id = ?`, [req.userId, id]);
      await run(`DELETE FROM accounts WHERE id = ? AND user_id = ?`, [id, req.userId]);
    } else {
      return res.status(400).json({ error: 'unsupported_delete_mode' });
    }

    if (existing.is_default) {
      const next = await get(`SELECT id FROM accounts WHERE user_id = ? ORDER BY id ASC LIMIT 1`, [req.userId]);
      if (next?.id) await setDefaultAccount(req.userId, next.id);
    }

    return res.status(204).send();
  } catch (e) {
    console.error('accounts.removeWithStrategy error:', e);
    return res.status(500).json({ error: 'account_delete_strategy_failed' });
  }
};

