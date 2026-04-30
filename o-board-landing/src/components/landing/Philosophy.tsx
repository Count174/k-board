export const Philosophy = () => {
  return (
    <section id="philosophy" className="relative py-32 overflow-hidden">
      {/* Soft sakura glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-sakura/8 blur-3xl pointer-events-none" />

      <div className="container relative mx-auto">
        {/* Decorative divider */}
        <div className="flex items-center justify-center gap-4 mb-16">
          <span className="h-px w-16 bg-border" />
          <span className="font-mincho text-2xl text-sakura">桜梅桃李</span>
          <span className="h-px w-16 bg-border" />
        </div>

        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-medium text-sakura mb-4 tracking-widest uppercase">
            Ouibaitori · философия
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            Вишня, слива, персик и абрикос —{" "}
            <span className="text-gradient-sakura">каждый цветёт по-своему</span>
          </h2>
          <p className="mt-8 text-lg text-muted-foreground leading-relaxed">
            Древняя японская идея напоминает: нет смысла сравнивать вишню со сливой.
            Они расцветают в разное время, в разных условиях, и каждое цветение —
            прекрасно само по себе.
          </p>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            o-board построен на этой мысли. Никаких чужих метрик, рейтингов,
            «успешного успеха». Только ваш ритм, ваши цели и тихий, бережный
            интерфейс, который не торопит.
          </p>

          {/* Three blossoms */}
          <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            {[
              { kanji: "桜", name: "Сакура", desc: "ваш темп" },
              { kanji: "桃", name: "Персик", desc: "ваши цели" },
              { kanji: "梅", name: "Слива", desc: "ваш покой" },
            ].map((b) => (
              <div key={b.kanji} className="flex flex-col items-center gap-2">
                <span className="font-mincho text-5xl text-gradient-sakura">{b.kanji}</span>
                <span className="font-display font-medium">{b.name}</span>
                <span className="text-xs text-muted-foreground">{b.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};