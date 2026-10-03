import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { submitReportCore } from "@/lib/report-core.server";

const SubmitInput = z.object({
  imageBase64: z.string().min(100),
  photoPath: z.string().min(1),
  comment: z.string().max(600).default(""),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  region: z.string().max(80).default(""),
});

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SubmitInput.parse(data))
  .handler(async ({ data, context }) => submitReportCore(context.supabase, context.userId, data));
