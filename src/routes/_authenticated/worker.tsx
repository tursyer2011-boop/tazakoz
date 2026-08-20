import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, HardHat, IdCard, LoaderCircle, MapPin, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, hasRole } from "@/hooks/useProfile";
import { applyAsWorker, completeTask, takeTask } from "@/lib/worker.functions";
import { resizeImage, signedPhotoUrl, urlToDataUrl } from "@/lib/photos";
import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";
import { APPLICATION_STATUS_LABELS, REPORT_STATUS_LABELS } from "@/lib/credits";
import { SEVERITY, type Severity } from "@/lib/regions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/worker")({
  head: () => ({
    meta: [
      { title: "Портал работника — TAZA KÖZ" },
      { name: "description", content: "Заявки на уборку водоёмов, задания и награды для работников TAZA KÖZ." },
      { property: "og:title", content: "Портал работника — TAZA KÖZ" },
      { property: "og:description", content: "Берите задания по уборке водоёмов и получайте Taza Credits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkerPage,
});

function WorkerPage() {
  const { data: me, isLoading } = useProfile();
  const isWorker = hasRole(me?.roles, "worker", "captain", "admin");

  const application = useQuery({
    queryKey: ["my-worker-application", me?.user.id],
    enabled: Boolean(me?.user.id) && !isWorker,
    queryFn: async () => {
      const { data } = await supabase
        .from("worker_applications")
        .select("*")
        .eq("user_id", me!.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 py-6">
      <header className="flex items-center gap-3">
        <span className="bg-brand-gradient flex size-11 items-center justify-center rounded-2xl">
          <HardHat className="size-6 text-primary-foreground" strokeWidth={1.6} />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Портал работника</h1>
          <p className="text-xs text-muted-foreground">Уборка водоёмов Казахстана</p>
        </div>
      </header>

      {isWorker ? (
        <WorkerTasks userId={me!.user.id} />
      ) : application.isLoading ? (
        <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
      ) : application.data && application.data.status === "pending" ? (
        <div className="glass-card space-y-2 rounded-3xl p-5 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Clock className="size-5 text-primary" /> {APPLICATION_STATUS_LABELS["pending"]}
          </div>
          <p className="text-muted-foreground">
            Заявка отправлена координатору. Как только её одобрят, здесь появятся задания по уборке.
          </p>
        </div>
      ) : (
        <ApplicationForm
          rejectedNote={application.data?.status === "rejected" ? application.data.review_note : ""}
          onDone={() => application.refetch()}
        />
      )}
    </main>
  );
}

function ApplicationForm({ rejectedNote, onDone }: { rejectedNote: string; onDone: () => void }) {
  const apply = useServerFn(applyAsWorker);
  const { data: me } = useProfile();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [iin, setIin] = useState("");
  const [docType, setDocType] = useState<"id_card" | "passport">("id_card");
  const [docNumber, setDocNumber] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [parentFullName, setParentFullName] = useState("");
  const [parentContact, setParentContact] = useState("");
  const [parentConsent, setParentConsent] = useState(false);
  const [parentDoc, setParentDoc] = useState<UploadedDoc | null>(null);
  const [docFront, setDocFront] = useState<UploadedDoc | null>(null);
  const [docBack, setDocBack] = useState<UploadedDoc | null>(null);
  const [selfie, setSelfie] = useState<UploadedDoc | null>(null);
  const [place, setPlace] = useState<PickedLocation | null>(null);
  const [experience, setExperience] = useState("");
  const [about, setAbout] = useState("");
  const [hasTransport, setHasTransport] = useState(false);
  const [busy, setBusy] = useState(false);
  const age = calculateAge(birthDate);
  const isMinor = age !== null && age >= 16 && age < 18;
  const tooYoung = age !== null && age < 16;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (fullName.trim().length < 3 || phone.trim().length < 10 || !place) {
      toast.error("Заполните ФИО, телефон и место работы");
      return;
    }
    if (age === null) {
      toast.error("Укажите корректную дату рождения");
      return;
    }
    if (tooYoung) {
      toast.error("Заявки принимаются с 16 лет");
      return;
    }
    if (!/^\d{12}$/.test(iin.trim())) {
      toast.error("ИИН должен содержать 12 цифр");
      return;
    }
    if (!isMinor) {
      if (docNumber.trim().length < 4) {
        toast.error("Укажите номер документа");
        return;
      }
      if (!docFront) {
        toast.error("Загрузите фото документа");
        return;
      }
    } else {
      if (parentFullName.trim().length < 3 || parentContact.trim().length < 5) {
        toast.error("Заполните данные родителя или законного представителя");
        return;
      }
      if (!parentConsent) {
        toast.error("Нужно согласие родителя или законного представителя");
        return;
      }
      if (!parentDoc) {
        toast.error("Загрузите документ родителя");
        return;
      }
    }
    setBusy(true);
    try {
      const res = await apply({
        data: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          birthDate,
          iin: iin.trim(),
          docType: isMinor && !docFront ? "none" : docType,
          docNumber: docNumber.trim(),
          docFrontUrl: docFront?.path ?? "",
          docBackUrl: docBack?.path ?? "",
          selfieUrl: selfie?.path ?? "",
          fatherName: fatherName.trim(),
          motherName: motherName.trim(),
          parentFullName: parentFullName.trim(),
          parentContact: parentContact.trim(),
          parentConsent,
          parentDocUrl: parentDoc?.path ?? "",
          region: place.regionName,
          regionCode: place.regionCode,
          city: place.settlement.name,
          about: about.trim(),
          experience: experience.trim(),
          hasTransport,
        },
      });
      toast.success(
        res.telegramNotified
          ? "Заявка отправлена координатору в Telegram"
          : "Заявка отправлена и ждёт рассмотрения",
      );
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить заявку");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass-card space-y-4 rounded-3xl p-5">
      {rejectedNote && (
        <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-muted-foreground">
          Предыдущая заявка отклонена: {rejectedNote || "без комментария"}
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="w-name">ФИО</Label>
        <Input id="w-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 rounded-xl" maxLength={120} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="w-phone">Телефон</Label>
          <Input id="w-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 700 000 00 00" className="h-11 rounded-xl" maxLength={20} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="w-birth">Дата рождения</Label>
          <Input
            id="w-birth"
            type="date"
            required
            max={new Date().toISOString().slice(0, 10)}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="h-11 rounded-xl"
          />
          {age !== null && (
            <span className={`text-[11px] ${tooYoung ? "text-destructive" : "text-muted-foreground"}`}>
              Возраст: {age}
            </span>
          )}
        </div>
      </div>

      {tooYoung && (
        <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
          Подать заявку можно с 16 лет.
        </p>
      )}

      {isMinor && (
        <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">Родитель / законный представитель</p>
          <div className="grid gap-1.5">
            <Label htmlFor="w-parent-name">ФИО представителя</Label>
            <Input id="w-parent-name" value={parentFullName} onChange={(e) => setParentFullName(e.target.value)} className="h-11 rounded-xl" maxLength={120} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="w-parent-contact">Телефон или e-mail представителя</Label>
            <Input id="w-parent-contact" value={parentContact} onChange={(e) => setParentContact(e.target.value)} className="h-11 rounded-xl" maxLength={120} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <DocUpload label="Документ представителя" userId={me?.user.id} value={parentDoc} onChange={setParentDoc} />
          </div>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={parentConsent} onCheckedChange={(v) => setParentConsent(v === true)} className="mt-0.5" />
            <span className="text-muted-foreground">
              Родитель / законный представитель согласен на участие несовершеннолетнего в работах TAZA KÖZ.
            </span>
          </label>
        </div>
      )}

      <div className="space-y-3 rounded-2xl bg-secondary/30 p-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <IdCard className="size-4 text-primary" /> Документы
        </p>
        <div className="grid gap-1.5">
          <Label htmlFor="w-iin">ИИН</Label>
          <Input
            id="w-iin"
            value={iin}
            inputMode="numeric"
            onChange={(e) => setIin(e.target.value.replace(/\D/g, "").slice(0, 12))}
            placeholder="12 цифр"
            className="h-11 rounded-xl"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Тип документа</Label>
            <div className="flex h-11 items-center gap-1 rounded-xl bg-background/60 p-1">
              {(["id_card", "passport"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDocType(t)}
                  className={`h-9 flex-1 rounded-lg text-xs font-medium transition ${
                    docType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {t === "id_card" ? "Удостоверение" : "Паспорт"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="w-docnum">Номер документа</Label>
            <Input id="w-docnum" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className="h-11 rounded-xl" maxLength={20} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <DocUpload label="Лицевая" userId={me?.user.id} value={docFront} onChange={setDocFront} />
          <DocUpload label="Оборот" userId={me?.user.id} value={docBack} onChange={setDocBack} />
          <DocUpload label="Селфи с док." userId={me?.user.id} value={selfie} onChange={setSelfie} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {isMinor
            ? "Для 16–17 лет документ загружается, только если он у вас есть. Файлы видны вам и координаторам TAZA KÖZ."
            : "Документы видны только вам и координаторам TAZA KÖZ."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="w-father">ФИО отца</Label>
          <Input id="w-father" value={fatherName} onChange={(e) => setFatherName(e.target.value)} className="h-11 rounded-xl" maxLength={120} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="w-mother">ФИО матери</Label>
          <Input id="w-mother" value={motherName} onChange={(e) => setMotherName(e.target.value)} className="h-11 rounded-xl" maxLength={120} />
        </div>
      </div>

      <LocationPicker value={place} onChange={setPlace} />
      <div className="grid gap-1.5">
        <Label htmlFor="w-exp">Опыт работы</Label>
        <Textarea id="w-exp" value={experience} onChange={(e) => setExperience(e.target.value)} rows={2} maxLength={800} className="rounded-2xl" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="w-about">О себе</Label>
        <Textarea id="w-about" value={about} onChange={(e) => setAbout(e.target.value)} rows={2} maxLength={800} className="rounded-2xl" />
      </div>
      <label className="flex items-center gap-3 rounded-2xl bg-secondary/40 p-3 text-sm">
        <Checkbox checked={hasTransport} onCheckedChange={(v) => setHasTransport(v === true)} />
        <span className="text-muted-foreground">Есть свой транспорт для вывоза мусора</span>
      </label>
      <Button
        type="submit"
        disabled={busy || tooYoung}
        className="bg-brand-gradient shadow-brand-glow h-12 w-full rounded-xl text-base font-semibold text-primary-foreground"
      >
        {busy ? <LoaderCircle className="size-5 animate-spin" /> : "Отправить заявку"}
      </Button>
    </form>
  );
}

type UploadedDoc = { path: string; preview: string };

function calculateAge(birthDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const born = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(born.getTime()) || born.getTime() > Date.now()) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - born.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

function DocUpload({
  label,
  userId,
  value,
  onChange,
}: {
  label: string;
  userId: string | undefined;
  value: UploadedDoc | null;
  onChange: (doc: UploadedDoc | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    setBusy(true);
    try {
      const { blob, dataUrl } = await resizeImage(file, 1600);
      const path = `${userId}/doc-${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from("worker-docs")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      onChange({ path, preview: dataUrl });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить фото");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background/60"
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin text-primary" />
        ) : value ? (
          <img src={value.preview} alt={label} className="size-full object-cover" />
        ) : (
          <Upload className="size-4 text-muted-foreground" />
        )}
      </button>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        {value && (
          <button
            type="button"
            aria-label={`Удалить файл: ${label}`}
            onClick={() => onChange(null)}
            className="text-muted-foreground"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function WorkerTasks({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const take = useServerFn(takeTask);
  const complete = useServerFn(completeTask);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const tasks = useQuery({
    queryKey: ["worker-tasks", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("approved", true)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });

  async function onTake(reportId: string) {
    setBusyId(reportId);
    try {
      await take({ data: { reportId } });
      toast.success("Задание закреплено за вами");
      await queryClient.invalidateQueries({ queryKey: ["worker-tasks"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось взять задание");
    } finally {
      setBusyId(null);
    }
  }

  async function onAfterPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const reportId = activeId;
    e.target.value = "";
    if (!file || !reportId) return;
    const report = tasks.data?.find((t) => t.id === reportId);
    if (!report) return;

    setBusyId(reportId);
    try {
      const { blob, dataUrl } = await resizeImage(file);
      const path = `${userId}/cleaned-${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("reports")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;

      const beforeUrl = await signedPhotoUrl(report.photo_url);
      if (!beforeUrl) throw new Error("Не удалось загрузить фото до уборки");
      const beforeData = await urlToDataUrl(beforeUrl);

      const res = await complete({
        data: {
          reportId,
          afterPhotoPath: path,
          afterImageBase64: dataUrl,
          beforeImageBase64: beforeData,
        },
      });
      if (res.accepted) toast.success(`Уборка подтверждена! +${res.reward} Taza Credits`);
      else toast.error(res.reason);
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setBusyId(null);
    }
  }

  if (tasks.isLoading) return <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />;
  const items = tasks.data ?? [];

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onAfterPhoto} />
      {items.length === 0 && (
        <p className="glass-card rounded-3xl p-5 text-center text-sm text-muted-foreground">
          Свободных заданий пока нет
        </p>
      )}
      {items.map((task) => {
        const mine = task.assigned_worker_id === userId;
        const free = !task.assigned_worker_id;
        const severity = SEVERITY[(task.severity as Severity) ?? "low"];
        return (
          <article key={task.id} className="glass-card space-y-3 rounded-3xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{task.address || task.region || "Без адреса"}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" /> {task.lat.toFixed(4)}, {task.lng.toFixed(4)}
                </p>
              </div>
              <span className="rounded-full px-2 py-1 text-xs" style={{ color: severity.color, background: "oklch(1 0 0 / 6%)" }}>
                {severity.label}
              </span>
            </div>
            {task.comment && <p className="text-sm text-muted-foreground">{task.comment}</p>}
            <p className="text-xs text-muted-foreground">
              Статус: {REPORT_STATUS_LABELS[task.status] ?? task.status} · Награда: {task.worker_reward} кредитов
            </p>
            {free && (
              <Button onClick={() => onTake(task.id)} disabled={busyId === task.id} className="h-11 w-full rounded-xl">
                {busyId === task.id ? <LoaderCircle className="size-4 animate-spin" /> : "Взять задание"}
              </Button>
            )}
            {mine && (
              <Button
                variant="secondary"
                disabled={busyId === task.id}
                onClick={() => {
                  setActiveId(task.id);
                  fileRef.current?.click();
                }}
                className="h-11 w-full rounded-xl"
              >
                {busyId === task.id ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    <Upload className="size-4" /> Фото после уборки
                  </span>
                )}
              </Button>
            )}
            {!free && !mine && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5" /> Задание уже взято
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
