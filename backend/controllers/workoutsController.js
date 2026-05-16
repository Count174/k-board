const {
  ensureSchema,
  getSettings,
  saveSettings,
  listPlans,
  getPlan,
  upsertPlan,
  deletePlan,
  getAllProgress,
  setSessionStatus,
  SPORT_TYPES,
  EXERCISE_KINDS,
} = require('../utils/workoutPlanService');

exports.meta = async (req, res) => {
  try {
    await ensureSchema();
    res.json({ sport_types: SPORT_TYPES, exercise_kinds: EXERCISE_KINDS });
  } catch (e) {
    console.error('workouts.meta', e);
    res.status(500).json({ error: 'workouts_meta_failed' });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const data = await getSettings(req.userId);
    res.json(data);
  } catch (e) {
    console.error('workouts.getSettings', e);
    res.status(500).json({ error: 'workouts_settings_failed' });
  }
};

exports.putSettings = async (req, res) => {
  try {
    const data = await saveSettings(req.userId, req.body || {});
    res.json(data);
  } catch (e) {
    console.error('workouts.putSettings', e);
    res.status(500).json({ error: 'workouts_settings_save_failed' });
  }
};

exports.listPlans = async (req, res) => {
  try {
    const data = await listPlans(req.userId);
    res.json(data);
  } catch (e) {
    console.error('workouts.listPlans', e);
    res.status(500).json({ error: 'workouts_list_failed' });
  }
};

exports.getPlan = async (req, res) => {
  try {
    const plan = await getPlan(req.userId, Number(req.params.id));
    if (!plan) return res.status(404).json({ error: 'plan_not_found' });
    res.json(plan);
  } catch (e) {
    console.error('workouts.getPlan', e);
    res.status(500).json({ error: 'workouts_get_failed' });
  }
};

exports.upsertPlan = async (req, res) => {
  try {
    const plan = await upsertPlan(req.userId, req.body || {});
    res.json(plan);
  } catch (e) {
    if (e.message === 'name_required') return res.status(400).json({ error: e.message });
    if (e.message === 'plan_not_found') return res.status(404).json({ error: e.message });
    console.error('workouts.upsertPlan', e);
    res.status(500).json({ error: 'workouts_save_failed' });
  }
};

exports.removePlan = async (req, res) => {
  try {
    await deletePlan(req.userId, Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    console.error('workouts.removePlan', e);
    res.status(500).json({ error: 'workouts_delete_failed' });
  }
};

exports.progress = async (req, res) => {
  try {
    const data = await getAllProgress(req.userId);
    res.json(data);
  } catch (e) {
    console.error('workouts.progress', e);
    res.status(500).json({ error: 'workouts_progress_failed' });
  }
};

exports.completeSession = async (req, res) => {
  try {
    const row = await setSessionStatus(Number(req.params.id), req.userId, 'completed');
    res.json(row);
  } catch (e) {
    if (e.message === 'session_not_found') return res.status(404).json({ error: e.message });
    console.error('workouts.completeSession', e);
    res.status(500).json({ error: 'workouts_session_failed' });
  }
};

exports.skipSession = async (req, res) => {
  try {
    const row = await setSessionStatus(Number(req.params.id), req.userId, 'skipped');
    res.json(row);
  } catch (e) {
    if (e.message === 'session_not_found') return res.status(404).json({ error: e.message });
    console.error('workouts.skipSession', e);
    res.status(500).json({ error: 'workouts_session_failed' });
  }
};
