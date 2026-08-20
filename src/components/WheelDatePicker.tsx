import { useEffect, useMemo, useRef } from "react";

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const ITEM_HEIGHT = 36;

function Column({
  values,
  labels,
  value,
  onChange,
  ariaLabel,
}: {
  values: number[];
  labels: string[];
  value: number;
  onChange: (next: number) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);
  const index = Math.max(0, values.indexOf(value));

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.scrollTo({ top: index * ITEM_HEIGHT });
  }, [index]);

  function handleScroll() {
    const node = ref.current;
    if (!node) return;
    if (frame.current) window.clearTimeout(frame.current);
    frame.current = window.setTimeout(() => {
      const next = Math.round(node.scrollTop / ITEM_HEIGHT);
      const picked = values[Math.min(values.length - 1, Math.max(0, next))];
      if (picked !== undefined && picked !== value) onChange(picked);
    }, 90);
  }

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      onScroll={handleScroll}
      className="wheel-column h-[108px] flex-1 snap-y snap-mandatory overflow-y-auto"
      style={{ scrollbarWidth: "none" }}
    >
      <div style={{ height: ITEM_HEIGHT }} aria-hidden />
      {values.map((v, i) => (
        <button
          key={v}
          type="button"
          role="option"
          aria-selected={v === value}
          onClick={() => onChange(v)}
          className={`flex h-9 w-full snap-center items-center justify-center text-sm transition ${
            i === index ? "font-semibold text-primary" : "text-muted-foreground"
          }`}
        >
          {labels[i]}
        </button>
      ))}
      <div style={{ height: ITEM_HEIGHT }} aria-hidden />
    </div>
  );
}

/** iOS-style drum picker for a birth date. Value format: YYYY-MM-DD. */
export function WheelDatePicker({
  value,
  onChange,
  minYear = 1930,
}: {
  value: string;
  onChange: (next: string) => void;
  minYear?: number;
}) {
  const now = new Date();
  const maxYear = now.getFullYear();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").map(Number) : null;
  const year = parsed ? parsed[0]! : maxYear - 20;
  const month = parsed ? parsed[1]! : 1;
  const day = parsed ? parsed[2]! : 1;

  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i),
    [maxYear, minYear],
  );
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  function emit(y: number, m: number, d: number) {
    const safeDay = Math.min(d, new Date(y, m, 0).getDate());
    onChange(`${y}-${String(m).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`);
  }

  return (
    <div className="neu-inset relative flex items-stretch gap-1 rounded-2xl px-2 py-1">
      <div className="pointer-events-none absolute inset-x-2 top-1/2 h-9 -translate-y-1/2 rounded-xl border border-primary/40 bg-primary/5" />
      <Column
        ariaLabel="День"
        values={days}
        labels={days.map(String)}
        value={day}
        onChange={(d) => emit(year, month, d)}
      />
      <Column
        ariaLabel="Месяц"
        values={months}
        labels={MONTHS}
        value={month}
        onChange={(m) => emit(year, m, day)}
      />
      <Column
        ariaLabel="Год"
        values={years}
        labels={years.map(String)}
        value={year}
        onChange={(y) => emit(y, month, day)}
      />
    </div>
  );
}