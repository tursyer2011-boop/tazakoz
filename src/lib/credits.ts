export const REPORT_CREDITS: Record<string, number> = { low: 10, medium: 25, high: 50 };
export const WORKER_REWARD: Record<string, number> = { low: 20, medium: 50, high: 100 };

export const CREDIT_KIND_LABELS: Record<string, string> = {
  report_approved: "Подтверждённая жалоба",
  cleanup_reward: "Награда за уборку",
  admin_adjust: "Корректировка администратора",
  redeem: "Списание",
};

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  pending: "На рассмотрении",
  approved: "Одобрена",
  rejected: "Отклонена",
};

export const REPORT_STATUS_LABELS: Record<string, string> = {
  new: "Новое",
  assigned: "Назначено",
  in_progress: "В работе",
  cleaned: "Убрано, ждёт проверки",
  resolved: "Проверено и закрыто",
};

export const KZT_PER_CREDIT = 5;
export const MIN_PAYOUT_CREDITS = 50;
export const MIN_DONATION_CREDITS = 10;
