import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeCleanup } from "@/lib/ai.server";
import { sendTelegram } from "@/lib/telegram.server";

const ApplyInput = z.object({
  fullName: z.string().trim().min(3).max(120),
  phone: z.string().trim().min(10).max(20),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату рождения"),
  iin: z.string().trim().regex(/^\d{12}$/, "ИИН должен содержать 12 цифр"),
  docType: z.enum(["id_card", "passport", "birth_certificate", "none"]),
  docNumber: z.string().trim().max(20).default(""),
  docFrontUrl: z.string().trim().max(300).default(""),
  docBackUrl: z.string().trim().max(300).default(""),
  selfieUrl: z.string().trim().max(300).default(""),
  fatherName: z.string().trim().max(120).default(""),
  motherName: z.string().trim().max(120).default(""),
  parentFullName: z.string().trim().max(120).default(""),
  parentContact: z.string().trim().max(120).default(""),
  parentConsent: z.boolean().default(false),
  parentDocUrl: z.string().trim().max(300).default(""),
  region: z.string().max(80).default(""),
  regionCode: z.string().max(20).default(""),
  city: z.string().max(80).default(""),
  about: z.string().max(800).default(""),
  experience: z.string().max(800).default(""),
  hasTransport: z.boolean().default(false),
});

const ReviewInput = z.object({
  applicationId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(400).default(""),
});

const TakeInput = z.object({ reportId: z.string().uuid() });

const DOC_LABELS: Record<string, string> = {
  id_card: "Удостоверение личности",
  passport: "Паспорт",
  birth_certificate: "Свидетельство о рождении",
  none: "Документ не предоставлен",
};

function calculateAge(birthDate: string): number | null {
  const born = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  if (born.getTime() > now.getTime()) return null;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - born.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

const CompleteInput = z.object({
  reportId: z.string().uuid(),
  afterPhotoPath: z.string().min(1),
  afterImageBase64: z.string().min(100),
  beforeImageBase64: z.string().min(100),
});

export const applyAsWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ApplyInput.parse(data))
  .handler(async ({ data, context }) => {
    const age = calculateAge(data.birthDate);
    if (age === null) throw new Error("Некорректная дата рождения");
    if (age < 16) throw new Error("Заявки принимаются с 16 лет");
    const isMinor = age < 18;
    if (isMinor) {
      if (data.parentFullName.trim().length < 3) throw new Error("Укажите ФИО родителя или законного представителя");
      if (data.parentContact.trim().length < 5) throw new Error("Укажите контакт родителя или законного представителя");
      if (!data.parentConsent) throw new Error("Требуется согласие родителя или законного представителя");
      if (!data.parentDocUrl) throw new Error("Загрузите документ родителя или законного представителя");
    } else {
      if (data.docType === "none" || data.docType === "birth_certificate") {
        throw new Error("Для совершеннолетних нужен удостоверение личности или паспорт");
      }
      if (data.docNumber.trim().length < 4) throw new Error("Укажите номер документа");
      if (!data.docFrontUrl) throw new Error("Загрузите фото документа");
    }

    const { data: application, error } = await context.supabase
      .from("worker_applications")
      .insert({
        user_id: context.userId,
        full_name: data.fullName,
        phone: data.phone,
        birth_date: data.birthDate,
        applicant_age: age,
        iin: data.iin,
        doc_type: data.docType,
        doc_number: data.docNumber,
        doc_front_url: data.docFrontUrl || null,
        doc_back_url: data.docBackUrl || null,
        selfie_url: data.selfieUrl || null,
        father_name: data.fatherName,
        mother_name: data.motherName,
        parent_full_name: data.parentFullName,
        parent_contact: data.parentContact,
        parent_consent: data.parentConsent,
        parent_doc_url: data.parentDocUrl || null,
        region: data.region,
        region_code: data.regionCode,
        city: data.city,
        about: data.about,
        experience: data.experience,
        has_transport: data.hasTransport,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") throw new Error("Ваша заявка уже на рассмотрении");
      throw new Error(error.message);
    }

    const telegram = await sendTelegram(
      `🧹 <b>Новая заявка ${isMinor ? "волонтёра 16–17 лет" : "работника"} TAZA KÖZ</b>\n` +
        `ФИО: ${data.fullName}\nТелефон: ${data.phone}\n` +
        `Возраст: ${age}\n` +
        `ИИН: ${data.iin}\n` +
        `Документ: ${DOC_LABELS[data.docType]} ${data.docNumber ? `№ ${data.docNumber}` : "—"}\n` +
        (isMinor
          ? `Представитель: ${data.parentFullName} (${data.parentContact}) — согласие получено\n`
          : "") +
        `Родители: ${data.fatherName || "—"} / ${data.motherName || "—"}\n` +
        `Регион: ${data.region} · ${data.city}\n` +
        `Транспорт: ${data.hasTransport ? "есть" : "нет"}\n` +
        `Опыт: ${data.experience || "—"}\nО себе: ${data.about || "—"}`,
      [
        [
          { text: "✅ Одобрить", callback_data: `wapp:approve:${application.id}` },
          { text: "❌ Отклонить", callback_data: `wapp:reject:${application.id}` },
        ],
      ],
    );

    if (telegram.sent) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("worker_applications")
        .update({ telegram_notified_at: new Date().toISOString() })
        .eq("id", application.id);
    }

    return { id: application.id, telegramNotified: telegram.sent };
  });

export const reviewApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ReviewInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isModerator } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "moderator",
    });
    if (!isStaff && !isModerator) throw new Error("Недостаточно прав");

    const { data: application, error } = await context.supabase
      .from("worker_applications")
      .update({
        status: data.decision,
        review_note: data.note,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.applicationId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (data.decision === "approved") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: application.user_id, role: "worker" }, { onConflict: "user_id,role" });
    }

    return { status: data.decision };
  });

export const takeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TakeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isWorker } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "worker",
    });
    if (!isWorker) throw new Error("Доступ только для работников");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("reports")
      .update({
        assigned_worker_id: context.userId,
        assigned_at: new Date().toISOString(),
        status: "assigned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.reportId)
      .is("assigned_worker_id", null)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Задание уже взято другим работником");
    return { ok: true };
  });

export const completeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CompleteInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: report, error: readError } = await context.supabase
      .from("reports")
      .select("id, assigned_worker_id, worker_reward, severity")
      .eq("id", data.reportId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!report || report.assigned_worker_id !== context.userId) {
      throw new Error("Это задание вам не назначено");
    }

    const verdict = await analyzeCleanup(data.beforeImageBase64, data.afterImageBase64);
    const accepted = verdict.is_real_photo && verdict.same_place && verdict.is_clean;
    const reason = verdict.reason || (accepted ? "Уборка подтверждена." : "Уборка не подтверждена.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!accepted) {
      await supabaseAdmin
        .from("reports")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("id", report.id);
      return { accepted, reason, reward: 0 };
    }

    const reward = report.worker_reward ?? 0;
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("reports")
      .update({
        status: "resolved",
        cleaned_photo_url: data.afterPhotoPath,
        cleaned_at: now,
        verified_at: now,
        updated_at: now,
      })
      .eq("id", report.id);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits, total_credits")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile) {
      await supabaseAdmin
        .from("profiles")
        .update({ credits: profile.credits + reward, total_credits: profile.total_credits + reward })
        .eq("id", context.userId);
    }
    await supabaseAdmin.from("credit_transactions").insert({
      user_id: context.userId,
      amount: reward,
      kind: "cleanup_reward",
      note: `Уборка подтверждена ИИ (${report.severity})`,
      report_id: report.id,
    });

    await sendTelegram(`✅ <b>Уборка подтверждена</b>\nЗадание ${report.id}\nНачислено: ${reward} Taza Credits`);

    return { accepted, reason, reward };
  });
