import { Button } from "@/components/ui/button";
import { ArrowRight, Check, TrendingUp, Pill } from "lucide-react";
import { Petals } from "./Petals";

export const Hero = () => {
  return (
    <section className="relative pt-32 pb-24 overflow-hidden bg-hero">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <Petals count={16} />

      {/* Vertical kanji decoration */}
      <div className="hidden lg:flex absolute left-8 top-32 vertical-jp text-sakura/30 text-xl select-none">
        桜梅桃李
      </div>
      <div className="hidden lg:flex absolute right-8 top-32 vertical-jp text-mint/25 text-xl select-none">
        自分の花
      </div>

      {/* Floating orbs */}
      <div className="absolute top-40 -left-20 h-72 w-72 rounded-full bg-mint/15 blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-20 -right-20 h-80 w-80 rounded-full bg-sakura/15 blur-3xl animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

      <div className="container relative mx-auto">
        <div className="max-w-3xl mx-auto text-center animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-card/40 backdrop-blur-sm text-xs text-muted-foreground mb-8">
            <span className="font-mincho text-sakura">桜</span>
            <span>Ouibaitori — каждый цветёт в своё время</span>
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
            Цвести{" "}
            <span className="text-gradient-sakura">в своём ритме</span>,
            <br />
            а не в чужом
          </h1>

          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            o-board — спокойное пространство для задач, финансов и долгих целей.
            Без гонки, без сравнений с чужими успехами. Только ваш сад и ваш темп.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-to-r from-mint to-mint-glow text-primary-foreground hover:opacity-90 font-medium px-8 h-12 shadow-glow group">
              <a href="/app/register">
                Посадить свой сад
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-12 px-6 text-muted-foreground hover:text-foreground">
              <a href="/app/login">Посмотреть, как растёт</a>
            </Button>
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            Бесплатно навсегда · Без карты · Без сравнений с другими
          </p>
        </div>

        {/* Floating dashboard preview */}
        <div className="relative mt-20 max-w-5xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
          <div className="relative grid grid-cols-12 gap-4">
            <PreviewCard className="col-span-12 md:col-span-5 animate-float-slow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold">Сегодня</h3>
                <span className="text-xs text-muted-foreground">3 / 5</span>
              </div>
              <ul className="space-y-3 text-sm">
                {[
                  { text: "Спринт-ревью с командой", done: true },
                  { text: "Перевести зарплату на вклад", done: true },
                  { text: "Витамин D — 2000 МЕ", done: true },
                  { text: "Прогулка 30 минут", done: false },
                ].map((t, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${t.done ? "bg-mint border-mint" : "border-border"}`}>
                      {t.done && <Check className="h-3 w-3 text-primary-foreground" />}
                    </span>
                    <span className={t.done ? "line-through text-muted-foreground" : ""}>{t.text}</span>
                  </li>
                ))}
              </ul>
            </PreviewCard>

            <PreviewCard className="col-span-12 md:col-span-4 animate-float-slow" delay="1s">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold">Баланс месяца</h3>
                <TrendingUp className="h-4 w-4 text-mint" />
              </div>
              <div className="text-3xl font-display font-bold tracking-tight">+ 84 320 ₽</div>
              <div className="text-xs text-muted-foreground mt-1">из бюджета 120 000 ₽</div>
              <div className="mt-4 h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full w-[70%] rounded-full bg-gradient-to-r from-mint to-mint-glow" />
              </div>
              <div className="mt-4 flex gap-2 text-[11px]">
                <span className="px-2 py-1 rounded-md bg-mint/10 text-mint">Еда 22%</span>
                <span className="px-2 py-1 rounded-md bg-coral/10 text-coral">Транспорт 14%</span>
              </div>
            </PreviewCard>

            <PreviewCard className="col-span-12 md:col-span-3 animate-float-slow" delay="2s">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-coral/15">
                  <Pill className="h-4 w-4 text-coral" />
                </span>
                <h3 className="font-display font-semibold text-sm">Лекарства</h3>
              </div>
              <div className="text-sm text-muted-foreground">Через 12 минут</div>
              <div className="mt-1 font-medium">Магний B6 · 1 таб.</div>
              <button className="mt-4 w-full text-xs py-2 rounded-lg bg-coral/15 text-coral hover:bg-coral/25 transition-colors">
                Принял
              </button>
            </PreviewCard>
          </div>
        </div>
      </div>
    </section>
  );
};

const PreviewCard = ({ children, className = "", delay }: { children: React.ReactNode; className?: string; delay?: string }) => (
  <div
    className={`bg-card-glass border border-border/60 rounded-2xl p-5 shadow-card-soft ${className}`}
    style={delay ? { animationDelay: delay } : undefined}
  >
    {children}
  </div>
);