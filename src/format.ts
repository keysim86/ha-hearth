// Liczby, godziny i kolory temperatury — wspólne dla wszystkich stylów.

export const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

export const f1 = (v: number | null): string =>
  v === null ? "—" : v.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Kwota w złotych z groszami („692,61 zł”). */
export const zl = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : `${v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
export const round = (v: number | null): string => (v === null ? "—" : Math.round(v).toLocaleString("pl-PL"));

/** Minuta doby z napisu „HH:MM[:SS]”. */
export const minutes = (s: string | null | undefined): number | null => {
  if (!s || !/^\d{1,2}:\d{2}/.test(s)) return null;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

export const hhmm = (s: string | null | undefined): string => (s ? s.slice(0, 5) : "—");

export function clock(timeZone?: string) {
  const fmt = new Intl.DateTimeFormat("pl-PL", { timeZone, hour: "2-digit", minute: "2-digit" });
  return {
    hm: (d: Date | number) => fmt.format(d),
    minuteOfDay: (d: Date | number) => {
      const [h, m] = fmt.format(d).split(":").map(Number);
      return h * 60 + m;
    },
  };
}

/** 17 °C niebiesko → 26 °C pomarańczowo. */
export const hue = (t: number): number => 212 - Math.max(0, Math.min(1, (t - 17) / 9)) * 190;
export const tempColor = (t: number | null): string =>
  t === null ? "var(--muted)" : `hsl(${hue(t).toFixed(0)} 72% var(--temp-l))`;

export const duration = (ms: number): string => {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h${m % 60 ? ` ${m % 60} min` : ""}`;
  return `${Math.floor(h / 24)} dni${h % 24 ? ` ${h % 24} h` : ""}`;
};
