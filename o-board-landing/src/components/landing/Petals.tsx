import { useMemo } from "react";

/**
 * Falling sakura petals — soft decorative layer for the hero.
 * Pure CSS shapes (no images), pointer-events: none.
 */
export const Petals = ({ count = 14 }: { count?: number }) => {
  const petals = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 18,
        duration: 14 + Math.random() * 14,
        size: 8 + Math.random() * 10,
        opacity: 0.25 + Math.random() * 0.45,
        hue: Math.random() > 0.5 ? "sakura" : "sakura-deep",
        key: i,
      })),
    [count]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {petals.map((p) => (
        <span
          key={p.key}
          className="absolute top-0 animate-petal-fall"
          style={{
            left: `${p.left}%`,
            animationDelay: `-${p.delay}s`,
            animationDuration: `${p.duration}s`,
            opacity: p.opacity,
          }}
        >
          <span
            className="block animate-drift"
            style={{ animationDuration: `${6 + Math.random() * 6}s` }}
          >
            <Petal size={p.size} hue={p.hue as "sakura" | "sakura-deep"} />
          </span>
        </span>
      ))}
    </div>
  );
};

const Petal = ({ size, hue }: { size: number; hue: "sakura" | "sakura-deep" }) => {
  const fill = hue === "sakura" ? "hsl(var(--sakura))" : "hsl(var(--sakura-deep))";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2c2 4 6 6 6 10 0 4-3 8-6 10-3-2-6-6-6-10 0-4 4-6 6-10z"
        fill={fill}
      />
    </svg>
  );
};