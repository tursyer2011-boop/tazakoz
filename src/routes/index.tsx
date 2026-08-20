import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Camera, MapPin, ShieldCheck, Users, Waves } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TAZA KÖZ — мониторинг чистоты водоёмов Казахстана" },
      {
        name: "description",
        content:
          "Сфотографируй загрязнение водоёма — ИИ проверит снимок, точка появится на карте, а бригада выедет на уборку. Kör. Habarla. Qorğa.",
      },
      { property: "og:title", content: "TAZA KÖZ — чистые водоёмы Казахстана" },
      {
        property: "og:description",
        content: "Народный мониторинг загрязнений воды: ИИ-проверка фото, карта, бригады и Taza Credits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  { icon: Camera, title: "Фото за 10 секунд", text: "Снимок берега или воды прямо из приложения." },
  { icon: Brain, title: "ИИ-проверка", text: "Модель оценивает подлинность и масштаб загрязнения." },
  { icon: MapPin, title: "Живая карта", text: "Каждая подтверждённая точка появляется на карте страны." },
  { icon: Users, title: "Бригады рядом", text: "Заявка уходит в ближайший пункт и назначается команде." },
  { icon: Waves, title: "Состояние воды", text: "Погода и обстановка по вашему водоёму в одном экране." },
  { icon: ShieldCheck, title: "Taza Credits", text: "За подтверждённые сигналы начисляются кредиты." },
];

const STEPS = [
  { n: "01", title: "Заметил", text: "Мусор, сток или пятно на воде." },
  { n: "02", title: "Снял", text: "Фото уходит на ИИ-проверку." },
  { n: "03", title: "Отметили", text: "Точка на карте и заявка бригаде." },
  { n: "04", title: "Убрали", text: "Команда закрывает вызов, вы получаете кредиты." },
];

function LandingPage() {
  const { session } = useSession();
  const primaryTo = session ? "/map" : "/auth";
  const primaryLabel = session ? "Открыть карту" : "Начать";

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16">
      <header className="flex items-center justify-between py-5">
        <Logo compact />
        <Link
          to="/auth"
          className="neu-raised rounded-full px-4 py-2 text-sm font-medium text-foreground"
        >
          {session ? "Профиль" : "Войти"}
        </Link>
      </header>

      <section className="flex flex-col items-center gap-6 pt-6 pb-14 text-center">
        <Logo />
        <h1 className="text-brand-gradient max-w-2xl text-4xl leading-tight font-semibold sm:text-5xl">
          Чистые водоёмы Казахстана начинаются с одного снимка
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          TAZA KÖZ — народная система мониторинга загрязнений воды: вы сообщаете, ИИ проверяет,
          бригады убирают.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to={primaryTo}
            className="bg-brand-gradient shadow-brand-glow rounded-2xl px-7 py-3.5 text-base font-semibold text-primary-foreground"
          >
            {primaryLabel}
          </Link>
          <Link to="/worker" className="neu-raised rounded-2xl px-7 py-3.5 text-base font-medium">
            Работать в бригаде
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <h2 className="sr-only">Возможности платформы</h2>
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <article key={title} className="neu-raised rounded-3xl p-5">
            <span className="neu-inset mb-4 flex size-11 items-center justify-center rounded-2xl">
              <Icon className="size-5 text-primary" strokeWidth={1.6} />
            </span>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </article>
        ))}
      </section>

      <section className="mt-14">
        <h2 className="text-center text-2xl font-semibold">Как это работает</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="neu-inset rounded-3xl p-5">
              <span className="text-brand-gradient text-2xl font-semibold">{s.n}</span>
              <p className="mt-2 font-medium">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="neu-raised mt-14 flex flex-col items-center gap-4 rounded-3xl px-6 py-10 text-center">
        <h2 className="text-2xl font-semibold">Kör. Habarla. Qorğa.</h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          Присоединяйтесь к сообществу, которое возвращает чистоту рекам и озёрам Казахстана.
        </p>
        <Link
          to={primaryTo}
          className="bg-brand-gradient shadow-brand-glow rounded-2xl px-7 py-3.5 text-base font-semibold text-primary-foreground"
        >
          {primaryLabel}
        </Link>
      </section>
    </main>
  );
}