const db = require('../db/db');
const dayjs = require('dayjs');

const all = (sql,p=[]) => new Promise((res,rej)=>db.all(sql,p,(e,r)=>e?rej(e):res(r||[])));
const run = (sql,p=[]) => new Promise((res,rej)=>db.run(sql,p,function(e){e?rej(e):res(this)}));

exports.getAll = async (req,res)=>{
  try{
    const uid = req.userId;

    const incomes = await all(
      `SELECT id, year, amount, currency, notes FROM incomes WHERE user_id=? ORDER BY year`,
      [uid]
    );

    const employments = await all(
      `SELECT id, company, position, start_date, end_date, location, notes
         FROM employments WHERE user_id=? ORDER BY date(start_date) DESC`,
      [uid]
    );

    const weights = await all(
      `SELECT id, date, kg, notes FROM weights WHERE user_id=? ORDER BY date(date) ASC`,
      [uid]
    );

    const yearlyGoals = await all(
      `SELECT id, year, title, status, notes FROM yearly_goals WHERE user_id=? ORDER BY year DESC, id DESC`,
      [uid]
    );

    const travels = await all(
      `SELECT id, date, country, city, notes FROM travels WHERE user_id=? ORDER BY date(date) DESC`,
      [uid]
    );

    const residences = await all(
      `SELECT id, start_date, end_date, country, city, address, notes
         FROM residences WHERE user_id=? ORDER BY date(start_date) DESC`,
      [uid]
    );

    res.json({
      incomes, employments, weights, yearly_goals: yearlyGoals,
      travels, residences
    });
  }catch(e){
    console.error('history.getAll error:', e);
    res.status(500).json({error:'history_failed'});
  }
};

const INSERTS = {
  incomes:       `INSERT INTO incomes (user_id,year,amount,currency,notes) VALUES (?,?,?,?,?)`,
  employments:   `INSERT INTO employments (user_id,company,position,start_date,end_date,location,notes) VALUES (?,?,?,?,?,?,?)`,
  weights:       `INSERT INTO weights (user_id,date,kg,notes) VALUES (?,?,?,?)`,
  yearly_goals:  `INSERT INTO yearly_goals (user_id,year,title,status,notes) VALUES (?,?,?,?,?)`,
  travels:       `INSERT INTO travels (user_id,date,country,city,notes) VALUES (?,?,?,?,?)`,
  residences:    `INSERT INTO residences (user_id,start_date,end_date,country,city,address,notes) VALUES (?,?,?,?,?,?,?)`,
};

const UPDATES = {
  incomes:       `UPDATE incomes SET year=?,amount=?,currency=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`,
  employments:   `UPDATE employments SET company=?,position=?,start_date=?,end_date=?,location=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`,
  weights:       `UPDATE weights SET date=?,kg=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`,
  yearly_goals:  `UPDATE yearly_goals SET year=?,title=?,status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`,
  travels:       `UPDATE travels SET date=?,country=?,city=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`,
  residences:    `UPDATE residences SET start_date=?,end_date=?,country=?,city=?,address=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`,
};

const DELETES = {
  incomes:      `DELETE FROM incomes WHERE id=? AND user_id=?`,
  employments:  `DELETE FROM employments WHERE id=? AND user_id=?`,
  weights:      `DELETE FROM weights WHERE id=? AND user_id=?`,
  yearly_goals: `DELETE FROM yearly_goals WHERE id=? AND user_id=?`,
  travels:      `DELETE FROM travels WHERE id=? AND user_id=?`,
  residences:   `DELETE FROM residences WHERE id=? AND user_id=?`,
};

exports.create = async (req,res)=>{
  try{
    const uid = req.userId;
    const section = (req.params.section||'').toLowerCase();

    if (!(section in INSERTS)) return res.status(400).json({error:'bad_section'});

    let params = [];
    switch(section){
      case 'incomes': {
        const { year, amount, currency='RUB', notes=null } = req.body;
        params = [uid, Number(year), Number(amount), String(currency), notes];
        break;
      }
      case 'employments': {
        const { company, position, start_date, end_date=null, location=null, notes=null } = req.body;
        params = [uid, company?.trim(), position?.trim(), String(start_date), end_date?String(end_date):null, location, notes];
        break;
      }
      case 'weights': {
        const { date, kg, notes=null } = req.body;
        params = [uid, String(date), Number(kg), notes];
        break;
      }
      case 'yearly_goals': {
        const { year, title, status='planned', notes=null } = req.body;
        params = [uid, Number(year), title?.trim(), status, notes];
        break;
      }
      case 'travels': {
        const { date, country, city=null, notes=null } = req.body;
        params = [uid, String(date), country?.trim(), city?.trim()||null, notes];
        break;
      }
      case 'residences': {
        const { start_date, end_date=null, country, city, address=null, notes=null } = req.body;
        params = [uid, String(start_date), end_date?String(end_date):null, country?.trim(), city?.trim(), address, notes];
        break;
      }
    }

    const r = await run(INSERTS[section], params);
    res.json({ ok:true, id: r.lastID });
  }catch(e){
    console.error('history.create error:', e);
    res.status(500).json({error:'history_create_failed'});
  }
};

exports.update = async (req,res)=>{
  try{
    const uid = req.userId;
    const section = (req.params.section||'').toLowerCase();
    const id = Number(req.params.id);
    if (!(section in UPDATES)) return res.status(400).json({error:'bad_section'});

    let params = [];
    switch(section){
      case 'incomes': {
        const { year, amount, currency='RUB', notes=null } = req.body;
        params = [Number(year), Number(amount), String(currency), notes, id, uid];
        break;
      }
      case 'employments': {
        const { company, position, start_date, end_date=null, location=null, notes=null } = req.body;
        params = [company?.trim(), position?.trim(), String(start_date), end_date?String(end_date):null, location, notes, id, uid];
        break;
      }
      case 'weights': {
        const { date, kg, notes=null } = req.body;
        params = [String(date), Number(kg), notes, id, uid];
        break;
      }
      case 'yearly_goals': {
        const { year, title, status='planned', notes=null } = req.body;
        params = [Number(year), title?.trim(), status, notes, id, uid];
        break;
      }
      case 'travels': {
        const { date, country, city=null, notes=null } = req.body;
        params = [String(date), country?.trim(), city?.trim()||null, notes, id, uid];
        break;
      }
      case 'residences': {
        const { start_date, end_date=null, country, city, address=null, notes=null } = req.body;
        params = [String(start_date), end_date?String(end_date):null, country?.trim(), city?.trim(), address, notes, id, uid];
        break;
      }
    }

    await run(UPDATES[section], params);
    res.json({ ok:true });
  }catch(e){
    console.error('history.update error:', e);
    res.status(500).json({error:'history_update_failed'});
  }
};

exports.remove = async (req,res)=>{
  try{
    const uid = req.userId;
    const section = (req.params.section||'').toLowerCase();
    const id = Number(req.params.id);
    if (!(section in DELETES)) return res.status(400).json({error:'bad_section'});

    await run(DELETES[section], [id, uid]);
    res.json({ ok:true });
  }catch(e){
    console.error('history.remove error:', e);
    res.status(500).json({error:'history_remove_failed'});
  }
};