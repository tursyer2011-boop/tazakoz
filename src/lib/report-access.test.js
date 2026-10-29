import { describe, expect, test } from "bun:test";
import { canReadReport } from "./report-access";

describe("report privacy", () => {
  const report = { user_id: "resident-a", assigned_worker_id: "worker-a" };
  test("a resident sees their own report", () => {
    expect(canReadReport(report, "resident-a", ["user"])).toBe(true);
  });
  test("other residents do not see someone else's report", () => {
    expect(canReadReport(report, "resident-b", ["user"])).toBe(false);
  });
  test("admins see every report", () => {
    expect(canReadReport(report, "admin-a", ["admin"])).toBe(true);
  });
  test("assigned volunteers retain their task access", () => {
    expect(canReadReport(report, "worker-a", ["worker"])).toBe(true);
    expect(canReadReport(report, "worker-b", ["worker"])).toBe(false);
  });
});