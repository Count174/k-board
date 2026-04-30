import { CheckSquare, Wallet, Pill, PiggyBank, CreditCard, Target } from "lucide-react";

type Accent = "mint" | "coral" | "amber" | "sky" | "violet";

const accentStyles: Record<Accent, { iconBg: string; iconText: string; orb: string; border: string }> = {
  mint:   { iconBg: "bg-mint/10",        iconText: "text-mint",        orb: "bg-mint/10",        border: "hover:border-mint/40" },
  coral:  { iconBg: "bg-coral/10",       iconText: "text-coral",       orb: "bg-coral/10",       border: "hover:border-coral/40" },
  amber:  { iconBg: "bg-amber/10",       iconText: "text-amber",       orb: "bg-amber/10",       border: "hover:border-amber/40" },
  sky:    { iconBg: "bg-sky/10",         iconText: "text-sky",         orb: "bg-sky/10",         border: "hover:border-sky/40" },
  violet: { iconBg: "bg-violet-soft/10", iconText: "text-violet-soft", orb: "bg-violet-soft/10", border: "hover:border-violet-soft/40" },
};

const features: { icon: typeof CheckSquare; title: string; desc: string; accent: Accent; span: string; visual: JSX.Element }[] = [
  {
    icon: CheckSquare,
    title: "Задачи дня",
    desc: "Маленькие шаги, из которых вырастает большое. Без ощущения вечной гонки.",
    accent: "mint",
    span: "md:col-span-2",
    visual: <TodoVisual />,
  },
  {
    icon: Wallet,
    title: "Финансы",
    desc: "Доходы и расходы без Excel. Тихая ясность вместо тревоги.",
    accent: "coral",
    span: "md:col-span-1",
    visual: <FinanceVisual />,
  },
  {
    icon: Pill,
    title: "Здоровье",
    desc: "Напоминания о лекарствах и привычках. Забота вместо контроля.",
    accent: "amber",
    span: "md:col-span-1",
    visual: <PillsVisual />,
  },
  {
    icon: PiggyBank,
    title: "Бюджет",
    desc: "Лимиты, которые вы сами выбрали. Месяц без сюрпризов.",
    accent: "sky",
    span: "md:col-span-1",
    visual: <BudgetVisual />,
  },
  {
    icon: CreditCard,
    title: "Обязательства",
    desc: "Кредиты и платежи на одном экране. Дышать становится легче.",
    accent: "violet",
    span: "md:col-span-1",
    visual: <CreditsVisual />,
  },
  {
    icon: Target,
    title: "Долгие цели",
    desc: "Мечты, которые цветут не за месяц. Ваш сад растёт в своём ритме.",
    accent: "mint",
    span: "md:col-span-2",
    visual: <GoalsVisual />,
  },
];

export const Features = () => {
  return (
    <section id="features" className="relative py-32">
      <div className="container mx-auto">
        <div className="max-w-2xl mb-16">
          <p className="text-sm text-mint font-medium mb-3 tracking-widest uppercase">
            <span className="font-mincho text-sakura mr-2">六</span>Шесть лепестков
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Шесть инструментов — <br />
            <span className="text-muted-foreground">один тихий сад</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            const a = accentStyles[f.accent];
            return (
              <div
                key={i}
                className={`group relative overflow-hidden rounded-3xl border border-border/60 bg-card-glass p-7 shadow-card-soft transition-all duration-500 ${a.border} ${f.span}`}
              >
                <div className={`absolute -top-20 -right-20 h-48 w-48 rounded-full ${a.orb} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />

                <div className="relative flex flex-col h-full">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${a.iconBg} ${a.iconText} mb-5`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-display text-xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">{f.desc}</p>
                  <div className="mt-auto">{f.visual}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

function TodoVisual() {
  return (
    <div className="space-y-2 text-sm">
      {[
        { t: "Подготовить презентацию", d: true },
        { t: "Звонок с дизайнером — 15:00", d: false },
        { t: "Заказать продукты", d: false },
      ].map((x, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/40 border border-border/40">
          <span className={`h-4 w-4 rounded-md border ${x.d ? "bg-mint border-mint" : "border-border"}`} />
          <span className={x.d ? "line-through text-muted-foreground" : ""}>{x.t}</span>
        </div>
      ))}
    </div>
  );
}

function FinanceVisual() {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1.5 h-20">
        {[40, 65, 35, 80, 55, 90, 70].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-coral/20 to-coral/70" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
        <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
      </div>
    </div>
  );
}

function PillsVisual() {
  return (
    <div className="space-y-2 text-xs">
      {[
        { t: "08:00", n: "Витамин D" },
        { t: "14:00", n: "Магний B6" },
        { t: "21:00", n: "Омега-3" },
      ].map((x, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/40 border border-border/40">
          <span className="text-muted-foreground">{x.t}</span>
          <span>{x.n}</span>
          <span className="h-2 w-2 rounded-full bg-amber" />
        </div>
      ))}
    </div>
  );
}

function BudgetVisual() {
  const cats: { n: string; p: number; c: string }[] = [
    { n: "Продукты", p: 78, c: "bg-sky" },
    { n: "Кафе", p: 45, c: "bg-coral" },
    { n: "Транспорт", p: 30, c: "bg-mint" },
  ];
  return (
    <div className="space-y-3">
      {cats.map((c, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1.5">
            <span>{c.n}</span>
            <span className="text-muted-foreground">{c.p}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className={`h-full rounded-full ${c.c}`} style={{ width: `${c.p}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CreditsVisual() {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/40 p-4">
      <div className="text-[11px] text-muted-foreground">Ипотека · Сбер</div>
      <div className="font-display text-lg font-semibold mt-0.5">42 380 ₽<span className="text-xs text-muted-foreground font-sans font-normal"> / мес</span></div>
      <div className="mt-3 h-1.5 rounded-full bg-background overflow-hidden">
        <div className="h-full w-[34%] rounded-full bg-violet-soft" />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
        <span>34% выплачено</span>
        <span>осталось 12 лет</span>
      </div>
    </div>
  );
}

function GoalsVisual() {
  const goals = [
    { n: "Накопить на квартиру", p: 62, sub: "1 240 000 / 2 000 000 ₽" },
    { n: "Прочитать 24 книги", p: 75, sub: "18 / 24" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {goals.map((g, i) => (
        <div key={i} className="rounded-xl border border-border/40 bg-secondary/40 p-4">
          <div className="text-sm font-medium">{g.n}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{g.sub}</div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-background overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-mint to-mint-glow" style={{ width: `${g.p}%` }} />
            </div>
            <span className="text-xs text-mint font-medium">{g.p}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}