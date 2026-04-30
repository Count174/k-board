import { Sprout, Layout, Sun } from "lucide-react";

const steps = [
  {
    icon: Sprout,
    n: "01",
    title: "Посадите семя",
    desc: "Регистрация за 30 секунд. Без подтверждений по почте и нудных анкет.",
    kanji: "種",
  },
  {
    icon: Layout,
    n: "02",
    title: "Соберите свой сад",
    desc: "Включите только нужные модули — задачи, бюджет, цели. Остальное скрыто.",
    kanji: "庭",
  },
  {
    icon: Sun,
    n: "03",
    title: "Цветите в своём темпе",
    desc: "Утренний обзор подсказывает фокус дня. Вечерний — закрывает гештальты.",
    kanji: "花",
  },
];

export const HowItWorks = () => {
  return (
    <section id="how" className="py-32 relative">
      <div className="container mx-auto">
        <div className="max-w-2xl mb-16">
          <p className="text-sm text-coral font-medium mb-3 tracking-widest uppercase">
            <span className="font-mincho text-sakura mr-2">道</span>Путь
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Три шага до сада, <br />
            <span className="text-muted-foreground">который растёт сам</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="relative rounded-3xl border border-border/60 bg-card-glass p-8 hover:border-sakura/30 transition-colors group overflow-hidden">
                <span className="absolute top-4 right-6 font-mincho text-7xl text-sakura/10 group-hover:text-sakura/25 transition-colors select-none">
                  {s.kanji}
                </span>
                <div className="font-display text-5xl font-bold text-muted-foreground/20 mb-6 group-hover:text-mint/40 transition-colors">{s.n}</div>
                <div className="flex items-center gap-3 mb-3 relative">
                  <Icon className="h-5 w-5 text-mint" />
                  <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed relative">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};