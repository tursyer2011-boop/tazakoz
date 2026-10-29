type ReportOwner = { user_id: string; assigned_worker_id?: string | null };

/** Defense in depth; the database remains the authoritative access boundary. */
export function canReadReport(report: ReportOwner, userId: string, roles: readonly string[]) {
  return report.user_id === userId || roles.includes("admin") || roles.includes("moderator") ||
    (roles.includes("worker") && report.assigned_worker_id === userId);
}