import { createFileRoute } from "@tanstack/react-router";
import { checkCsrf, clearSessionCookies, redirect } from "@/lib/lite.server";

export const Route = createFileRoute("/lite/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fd = await request.formData();
        if (!checkCsrf(request, fd)) return redirect("/lite/profile");
        return redirect("/lite/login", clearSessionCookies());
      },
    },
  },
});
