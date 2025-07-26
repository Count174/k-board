import React from 'react';
import { CalendarDays } from 'lucide-react';

export default function GreetingsHeader({ name = 'Кирилл' }) {
  const hours = new Date().getHours();
  const greeting =
    hours < 12 ? 'Доброе утро' :
    hours < 18 ? 'Добрый день' :
    'Добрый вечер';

  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-md mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">{greeting}, {name}</h1>
        <p className="text-zinc-500 dark:text-zinc-400">{today}</p>
      </div>
      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
        <CalendarDays className="w-5 h-5" />
        <span>{today}</span>
      </div>
    </div>
  );
}