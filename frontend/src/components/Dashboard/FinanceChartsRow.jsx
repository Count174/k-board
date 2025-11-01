// src/components/dashboard/FinanceChartsRow.jsx
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { get } from '../../api/api';
import styles from './FinanceChartsRow.module.css';
import { LineChart, TrendingDown, TrendingUp } from 'lucide-react';

function Segments({ value, onChange, options }) {
  return (
    <div className={styles.segments}>
      {options.map(opt=>(
        <button
          key={opt.value}
          className={`${styles.segBtn} ${value===opt.value?styles.segActive:''}`}
          onClick={()=>onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Line({ points, height=180 }) {
  if (!points.length) return <div className={styles.empty}>Нет данных</div>;
  const w = Math.max(240, points.length*14);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max-min);
  const fy = v => height-16 - ((v-min)/range)*(height-32);
  const fx = i => 12 + (i*(w-24))/Math.max(1, points.length-1);
  const d = points.map((v,i)=>`${i?'L':'M'}${fx(i)} ${fy(v)}`).join(' ');
  const avg = points.reduce((s,v)=>s+v,0)/points.length;

  return (
    <div className={styles.lineWrap}>
      <svg className={styles.line} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2"/>
        {points.map((v,i)=>(<circle key={i} cx={fx(i)} cy={fy(v)} r="2"/>))}
      </svg>
      <div className={styles.avgBadge}>ср: {Math.round(avg)}</div>
    </div>
  );
}

function money(v){ return new Intl.NumberFormat('ru-RU').format(Math.round(v||0))+' ₽'; }

export default function FinanceChartsRow(){
  const [period, setPeriod] = useState('30d');
  const [series, setSeries] = useState({ exp: [], inc: [] });

  useEffect(()=>{
    async function load(){
      // тянем все транзы и режем по периоду на клиенте
      const all = await get('finances');
      const end = dayjs();
      const start = period==='7d' ? end.subtract(6,'day')
                  : period==='30d' ? end.subtract(29,'day')
                  : end.subtract(89,'day');
      const rows = all.filter(r=>{
        const d = dayjs(r.date);
        return d.isSame(start,'day') || (d.isAfter(start,'day') && d.isBefore(end.add(1,'day'),'day'));
      });

      const map = {};
      for (let d = start; d.isSame(end,'day') || d.isBefore(end,'day'); d=d.add(1,'day')) {
        map[d.format('YYYY-MM-DD')] = { exp:0, inc:0 };
      }
      for (const r of rows) {
        const key = String(r.date).slice(0,10);
        if (!map[key]) continue;
        if (r.type==='expense') map[key].exp += Math.abs(Number(r.amount)||0);
        if (r.type==='income')  map[key].inc += Number(r.amount)||0;
      }
      const days = Object.keys(map).sort();
      setSeries({
        exp: days.map(k=>map[k].exp),
        inc: days.map(k=>map[k].inc)
      });
    }
    load();
  },[period]);

  const totalExp = useMemo(()=>series.exp.reduce((s,v)=>s+v,0),[series]);
  const totalInc = useMemo(()=>series.inc.reduce((s,v)=>s+v,0),[series]);

  return (
    <section className={styles.row}>
      <div className={styles.card}>
        <div className={styles.head}>
          <div className={styles.title}><TrendingDown size={18}/> Расходы</div>
          <Segments value={period} onChange={setPeriod}
            options={[{value:'7d',label:'7д'},{value:'30d',label:'30д'},{value:'90d',label:'90д'}]}/>
        </div>
        <div className={styles.total}>Итого: <b>{money(totalExp)}</b></div>
        <Line points={series.exp}/>
      </div>

      <div className={styles.card}>
        <div className={styles.head}>
          <div className={styles.title}><TrendingUp size={18}/> Доходы</div>
          <Segments value={period} onChange={setPeriod}
            options={[{value:'7d',label:'7д'},{value:'30d',label:'30д'},{value:'90d',label:'90д'}]}/>
        </div>
        <div className={styles.total}>Итого: <b>{money(totalInc)}</b></div>
        <Line points={series.inc}/>
      </div>
    </section>
  );
}