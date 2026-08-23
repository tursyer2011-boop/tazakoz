import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Brain,
  Camera,
  MapPin,
  ShieldCheck,
  Users,
  Waves,
  Code,
  Target,
  PenTool,
  Leaf,
  Heart,
  Zap,
  Wallet,
  Bot,
  Mail,
  Info,
  ArrowRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useSession } from "@/hooks/useSession";
import avatarErnar from "@/assets/team-ernar.jpg";
import avatarAlmagul from "@/assets/team-almagul.jpg";
import avatarKarakat from "@/assets/team-karakat.jpg";

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

const CREATORS = [
  {
    name: "Турсынгалиев Ернар Ержанович",
    role: "Lead Developer",
    badge: "Технический лидер",
    icon: Code,
    avatar: avatarErnar,
    accent: "text-primary",
  },
  {
    name: "Урал Алмагүл Сакенқызы",
    role: "Product Manager",
    badge: "Менеджер продукта",
    icon: Target,
    avatar: avatarAlmagul,
    accent: "text-accent",
  },
  {
    name: "Қазыбай Қарақат Асылбекқалиқызы",
    role: "UI/UX Designer",
    badge: "UI/UX дизайнер",
    icon: PenTool,
    avatar: avatarKarakat,
    accent: "text-water",
  },
];

const STATS = [
  { value: "100+", label: "Пунктов в каждой области", icon: MapPin },
  { value: "100%", label: "Прозрачность выплат через Kaspi", icon: Wallet },
  { value: "AI", label: "Фотоотчёты и верификация", icon: Brain },
];

const FOOTER_LINKS = [
  { label: "Карта", to: "/map" },
  { label: "Поддержка", to: "/chat" },
];

function LandingPage() {
  const { session } = useSession();
  const primaryTo = session ? "/map" : "/auth";
  const primaryLabel = session ? "Открыть карту" : "Начать";

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-0">
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
          <article key={title} className="neu-raised rounded-3xl p-5 transition-transform hover:-translate-y-1">
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

      {/* Mission & Impact */}
      <section className="mt-16 grid gap-6 lg:grid-cols-2">
        <div className="neu-raised rounded-3xl p-6">
          <span className="neu-inset mb-4 flex size-11 items-center justify-center rounded-2xl">
            <Leaf className="size-5 text-primary" strokeWidth={1.6} />
          </span>
          <h2 className="text-2xl font-semibold">Экологическое будущее Казахстана</h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Мы создаём первую народную экосистему мониторинга водоёмов, где каждый житель
            становится участником большого изменения. TAZA KÖZ объединяет технологии, местные
            сообщества и экологические инициативы в одной платформе.
          </p>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Наша миссия — сделать чистоту рек, озёр и водохранилищ видимой, измеримой и
            вознаграждаемой. Kör. Habarla. Qorğa.
          </p>
        </div>
        <div className="neu-raised rounded-3xl p-6">
          <span className="neu-inset mb-4 flex size-11 items-center justify-center rounded-2xl">
            <Heart className="size-5 text-accent" strokeWidth={1.6} />
          </span>
          <h2 className="text-2xl font-semibold">Почему это важно</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Каждый сигнал проверяется ИИ и попадает на публичную карту.</span>
            </li>
            <li className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Бригады получают точные координаты и маршруты до места загрязнения.</span>
            </li>
            <li className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Активные жители получают Taza Credits — реальные выплаты через Kaspi.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Interactive Stats */}
      <section className="mt-16">
        <h2 className="text-center text-2xl font-semibold">Цифры TAZA KÖZ</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {STATS.map(({ value, label, icon: Icon }) => (
            <article
              key={label}
              className="neu-raised group rounded-3xl p-6 text-center transition-all hover:-translate-y-1 hover:shadow-brand-glow"
            >
              <span className="neu-inset mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl">
                <Icon className="size-5 text-primary transition-colors group-hover:text-accent" strokeWidth={1.6} />
              </span>
              <p className="text-brand-gradient text-4xl font-bold tracking-tight">{value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{label}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Creators & Team */}
      <section className="mt-16" id="creators">
        <div className="text-center">
          <h2 className="text-3xl font-semibold">Создатели проекта</h2>
          <p className="mt-2 text-sm text-muted-foreground">Разработчики Taza Koz</p>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CREATORS.map(({ name, role, badge, icon: Icon, avatar, accent }) => (
            <article
              key={name}
              className="neu-raised group relative overflow-hidden rounded-3xl p-5 transition-all hover:-translate-y-1.5"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-brand-gradient opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="flex items-center gap-4">
                <div className="neu-inset shrink-0 rounded-full p-1">
                  <img
                    src={avatar}
                    alt={name}
                    width={88}
                    height={88}
                    className="size-22 rounded-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="min-w-0">
                  <span className="neu-inset inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Icon className="size-3" strokeWidth={1.8} />
                    {badge}
                  </span>
                  <h3 className="mt-2 text-base font-semibold leading-snug">{name}</h3>
                  <p className={`mt-0.5 text-sm font-medium ${accent}`}>{role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="neu-raised mt-16 flex flex-col items-center gap-4 rounded-3xl px-6 py-10 text-center">
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

      {/* 2026 Footer */}
      <footer className="mt-16 border-t border-border pt-8 pb-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Logo compact />
            <div>
              <p className="text-sm font-semibold">TAZA KOZ</p>
              <p className="text-xs text-muted-foreground">Чистота одним касанием</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 Taza Koz. Все права защищены.</p>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
          {FOOTER_LINKS.map(({ label, to }) => (
            <Link
              key={label}
              to={to}
              className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}
          <a
            href="https://t.me/TazaKozBot"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Bot className="size-4" />
            Telegram Bot
          </a>
        </div>
      </footer>
    </main>
  );
}
