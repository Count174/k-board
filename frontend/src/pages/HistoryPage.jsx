import { useEffect, useMemo, useState } from 'react';
import styles from '../styles/HistoryPage.module.css';
import { get, post, remove } from '../api/api';

function Money({ v }) {
  return <>{new Intl.NumberFormat('ru-RU').format(Math.round(v || 0))} ₽</>;
}

/** Линейный чарт на SVG с тултипами */
function LineChart({
  data,
  xKey,
  yKey,
  minY,
  maxY,
  formatX = (x, item) => (item?.label ?? String(x)),
  formatY = (y) => String(y),
}) {
  if (!data?.length) return <div className={styles.hint}>Нет данных</div>;

  const w = 560, h = 160, p = 20;
  const ys = data.map(d => Number(d[yKey]) || 0);
  const minx = 0, maxx = data.length - 1;
  const miny = minY ?? Math.min(...ys);
  const maxy = maxY ?? Math.max(...ys);
  const fx = (i) => p + (i - minx) * (w - 2 * p) / Math.max(1, (maxx - minx));
  const fy = (v) => h - p - (v - miny) * (h - 2 * p) / Math.max(1, (maxy - miny));

  const path = ys.map((y, i) => `${i === 0 ? 'M' : 'L'} ${fx(i)} ${fy(y)}`).join(' ');

  const [tip, setTip] = useState(null);
  const showTip = (i) => {
    const item = data[i];
    const y = Number(item[yKey]) || 0;
    setTip({
      i,
      left: fx(i),
      top: fy(y),
      xLabel: formatX(item[xKey], item),
      yLabel: formatY(y, item),
    });
  };
  const hideTip = () => setTip(null);

  return (
    <div className={styles.chartWrap}>
      <svg className={styles.chart} viewBox={`0 0 ${w} ${h}`} onMouseLeave={hideTip} aria-hidden>
        <path d={path} fill="none" stroke="white" strokeOpacity="0.8" strokeWidth="2" />
        {ys.map((y, i) => (
          <g key={i}>
            <circle
              cx={fx(i)} cy={fy(y)} r="3"
              fill="white"
              onMouseEnter={() => showTip(i)}
              onMouseMove={() => showTip(i)}
            />
            {/* щедрые hit-areas для удобного наведения */}
            <rect
              x={Math.max(0, fx(i) - 8)}
              y={Math.max(0, fy(y) - 12)}
              width="16" height="24"
              fill="transparent"
              onMouseEnter={() => showTip(i)}
              onMouseMove={() => showTip(i)}
            />
          </g>
        ))}
      </svg>

      {tip && (
        <div
          className={styles.tooltip}
          style={{
            left: Math.max(8, Math.min(tip.left + 10, w - 8)),
            top: Math.max(8, Math.min(tip.top - 8, h - 8))
          }}
        >
          <div className={styles.tooltipLine}>{tip.xLabel}</div>
          <div className={styles.tooltipValue}>{tip.yLabel}</div>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [data, setData] = useState(null);

  // формы
  const [incomeForm, setIncomeForm] = useState({ year: new Date().getFullYear(), amount: '' });
  const [weightForm, setWeightForm] = useState({ date: new Date().toISOString().slice(0,10), kg: '' });
  const [employmentForm, setEmploymentForm] = useState({ company:'', position:'', start_date:'', end_date:'', location:'', notes:'' });
  const [goalForm, setGoalForm] = useState({ year: new Date().getFullYear(), title:'', status:'planned' });
  const [travelForm, setTravelForm] = useState({ date: new Date().toISOString().slice(0,10), country:'', city:'' });
  const [resForm, setResForm] = useState({ start_date:'', end_date:'', country:'', city:'', address:'' });

  async function load(){
    const d = await get('history');
    setData(d);
  }
  useEffect(()=>{ load(); },[]);

  const incomesSorted = useMemo(()=>{
    return (data?.incomes || []).slice().sort((a,b)=>a.year-b.year);
  },[data]);

  const weightsSorted = useMemo(()=>{
    return (data?.weights || []).slice().sort((a,b)=>a.date.localeCompare(b.date));
  },[data]);

  // handlers create
  const addIncome = async ()=>{
    if (!incomeForm.year || !incomeForm.amount) return;
    await post('history/incomes', { year: Number(incomeForm.year), amount: Number(incomeForm.amount) });
    setIncomeForm(f=>({ ...f, amount: '' }));
    await load();
  };
  const addWeight = async ()=>{
    if (!weightForm.date || !weightForm.kg) return;
    await post('history/weights', { date: weightForm.date, kg: Number(weightForm.kg) });
    setWeightForm(f=>({ ...f, kg: '' }));
    await load();
  };
  const addEmployment = async ()=>{
    if (!employmentForm.company || !employmentForm.position || !employmentForm.start_date) return;
    await post('history/employments', employmentForm);
    setEmploymentForm({ company:'', position:'', start_date:'', end_date:'', location:'', notes:'' });
    await load();
  };
  const addGoal = async ()=>{
    if (!goalForm.year || !goalForm.title) return;
    await post('history/yearly_goals', goalForm);
    setGoalForm(f=>({ ...f, title:'' }));
    await load();
  };
  const addTravel = async ()=>{
    if (!travelForm.date || !travelForm.country) return;
    await post('history/travels', travelForm);
    setTravelForm({ date: new Date().toISOString().slice(0,10), country:'', city:'' });
    await load();
  };
  const addResidence = async ()=>{
    if (!resForm.start_date || !resForm.country || !resForm.city) return;
    await post('history/residences', resForm);
    setResForm({ start_date:'', end_date:'', country:'', city:'', address:'' });
    await load();
  };

  const del = async (section, id)=>{
    await remove(`history/${section}/${id}`);
    await load();
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.header}>
          <div className={styles.title}>📜 История пользователя</div>
        </div>

        <div className={styles.grid}>

          {/* Доходы */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Доход по годам</div>
            <div className={styles.row}>
              <input className={styles.input} type="number" placeholder="Год"
                value={incomeForm.year} onChange={e=>setIncomeForm(f=>({...f, year:e.target.value}))}/>
              <input className={styles.input} type="number" placeholder="Сумма, ₽"
                value={incomeForm.amount} onChange={e=>setIncomeForm(f=>({...f, amount:e.target.value}))}/>
              <button className={styles.btn} onClick={addIncome}>Добавить</button>
            </div>
            <LineChart
              data={incomesSorted.map(x=>({ x: x.year, y: x.amount }))}
              xKey="x"
              yKey="y"
              formatX={(x)=>String(x)}
              formatY={(y)=>new Intl.NumberFormat('ru-RU').format(Math.round(y)) + ' ₽'}
            />
            <div className={styles.list}>
              {(data?.incomes||[]).sort((a,b)=>b.year-a.year).map(r=>(
                <div key={r.id} className={styles.item}>
                  <div>{r.year}: <b><Money v={r.amount}/></b></div>
                  <button className={styles.btnGhost} onClick={()=>del('incomes', r.id)}>Удалить</button>
                </div>
              ))}
            </div>
          </div>

          {/* Вес */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Вес</div>
            <div className={styles.row}>
              <input className={styles.input} type="date" value={weightForm.date}
                onChange={e=>setWeightForm(f=>({...f, date:e.target.value}))}/>
              <input className={styles.input} type="number" step="0.1" placeholder="кг"
                value={weightForm.kg} onChange={e=>setWeightForm(f=>({...f, kg:e.target.value}))}/>
              <button className={styles.btn} onClick={addWeight}>Добавить</button>
            </div>
            <LineChart
              data={weightsSorted.map((w,i)=>({ x: i, y: w.kg, label: w.date }))}
              xKey="x"
              yKey="y"
              formatX={(_, item)=>item?.label || ''}
              formatY={(y)=>`${y} кг`}
            />
            <div className={styles.list}>
              {weightsSorted.slice().reverse().map(r=>(
                <div key={r.id} className={styles.item}>
                  <div>{r.date}: <b>{r.kg} кг</b></div>
                  <button className={styles.btnGhost} onClick={()=>del('weights', r.id)}>Удалить</button>
                </div>
              ))}
            </div>
          </div>

          {/* Работа */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Работа и позиции</div>
            <div className={styles.row}>
              <input className={styles.input} placeholder="Компания" value={employmentForm.company}
                onChange={e=>setEmploymentForm(f=>({...f, company:e.target.value}))}/>
              <input className={styles.input} placeholder="Должность" value={employmentForm.position}
                onChange={e=>setEmploymentForm(f=>({...f, position:e.target.value}))}/>
            </div>
            <div className={styles.row}>
              <input className={styles.input} type="date" placeholder="Начало" value={employmentForm.start_date}
                onChange={e=>setEmploymentForm(f=>({...f, start_date:e.target.value}))}/>
              <input className={styles.input} type="date" placeholder="Окончание (опц.)" value={employmentForm.end_date}
                onChange={e=>setEmploymentForm(f=>({...f, end_date:e.target.value}))}/>
              <input className={styles.input} placeholder="Локация (опц.)" value={employmentForm.location}
                onChange={e=>setEmploymentForm(f=>({...f, location:e.target.value}))}/>
              <button className={styles.btn} onClick={addEmployment}>Добавить</button>
            </div>
            <div className={styles.list}>
              {(data?.employments||[]).map(r=>(
                <div key={r.id} className={styles.item}>
                  <div>
                    <b>{r.company}</b> — {r.position} · {r.start_date} — {r.end_date || 'по наст.'}{r.location?` · ${r.location}`:''}
                  </div>
                  <button className={styles.btnGhost} onClick={()=>del('employments', r.id)}>Удалить</button>
                </div>
              ))}
            </div>
          </div>

          {/* Годовые цели */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Цели прошлых лет</div>
            <div className={styles.row}>
              <input className={styles.input} type="number" placeholder="Год" value={goalForm.year}
                onChange={e=>setGoalForm(f=>({...f, year:e.target.value}))}/>
              <input className={styles.input} placeholder="Цель" value={goalForm.title}
                onChange={e=>setGoalForm(f=>({...f, title:e.target.value}))}/>
              <select className={styles.input} value={goalForm.status}
                onChange={e=>setGoalForm(f=>({...f, status:e.target.value}))}>
                <option value="planned">В планах</option>
                <option value="inprogress">В работе</option>
                <option value="done">Сделано</option>
                <option value="dropped">Снято</option>
              </select>
              <button className={styles.btn} onClick={addGoal}>Добавить</button>
            </div>
            <div className={styles.list}>
              {(data?.yearly_goals||[]).map(r=>(
                <div key={r.id} className={styles.item}>
                  <div>{r.year}: {r.title} — <i>{r.status}</i></div>
                  <button className={styles.btnGhost} onClick={()=>del('yearly_goals', r.id)}>Удалить</button>
                </div>
              ))}
            </div>
          </div>

          {/* Поездки */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Поездки</div>
            <div className={styles.row}>
              <input className={styles.input} type="date" value={travelForm.date}
                onChange={e=>setTravelForm(f=>({...f, date:e.target.value}))}/>
              <input className={styles.input} placeholder="Страна" value={travelForm.country}
                onChange={e=>setTravelForm(f=>({...f, country:e.target.value}))}/>
              <input className={styles.input} placeholder="Город (опц.)" value={travelForm.city}
                onChange={e=>setTravelForm(f=>({...f, city:e.target.value}))}/>
              <button className={styles.btn} onClick={addTravel}>Добавить</button>
            </div>
            <div className={styles.list}>
              {(data?.travels||[]).map(r=>(
                <div key={r.id} className={styles.item}>
                  <div>{r.date}: {r.country}{r.city?` — ${r.city}`:''}</div>
                  <button className={styles.btnGhost} onClick={()=>del('travels', r.id)}>Удалить</button>
                </div>
              ))}
            </div>
          </div>

          {/* Где жил */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Где жил</div>
            <div className={styles.row}>
              <input className={styles.input} type="date" placeholder="Начало" value={resForm.start_date}
                onChange={e=>setResForm(f=>({...f, start_date:e.target.value}))}/>
              <input className={styles.input} type="date" placeholder="Окончание (опц.)" value={resForm.end_date}
                onChange={e=>setResForm(f=>({...f, end_date:e.target.value}))}/>
            </div>
            <div className={styles.row}>
              <input className={styles.input} placeholder="Страна" value={resForm.country}
                onChange={e=>setResForm(f=>({...f, country:e.target.value}))}/>
              <input className={styles.input} placeholder="Город" value={resForm.city}
                onChange={e=>setResForm(f=>({...f, city:e.target.value}))}/>
              <input className={styles.input} placeholder="Адрес (опц.)" value={resForm.address}
                onChange={e=>setResForm(f=>({...f, address:e.target.value}))}/>
              <button className={styles.btn} onClick={addResidence}>Добавить</button>
            </div>
            <div className={styles.list}>
              {(data?.residences||[]).map(r=>(
                <div key={r.id} className={styles.item}>
                  <div>{r.start_date} — {r.end_date || 'по наст.'}: {r.city}, {r.country}{r.address?` — ${r.address}`:''}</div>
                  <button className={styles.btnGhost} onClick={()=>del('residences', r.id)}>Удалить</button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}