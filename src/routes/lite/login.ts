import { createFileRoute } from "@tanstack/react-router";
import { anonClient, checkCsrf, csrfToken, esc, page, redirect, sessionCookies } from "@/lib/lite.server";

function form(token: string, email = "", error = "") {
  return `<h1>Вход</h1>
${error ? `<div class="msg err">${esc(error)}</div>` : ""}
<form class="card" method="post" action="/lite/login">
<input type="hidden" name="csrf" value="${esc(token)}">
<label>Почта</label><input type="email" name="email" value="${esc(email)}" autocapitalize="off" autocorrect="off" required>
<label>Пароль</label><input type="password" name="password" required>
<button class="btn" type="submit">Войти</button>
</form>
<p class="muted">Нет аккаунта? Зарегистрируйтесь на основном сайте tazakoz.online, а потом входите здесь.</p>`;
}

export const Route = createFileRoute("/lite/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { token, setCookie } = csrfToken(request);
        return page({ title: "Вход", nav: false, body: form(token), setCookies: [setCookie] });
      },
      POST: async ({ request }) => {
        const fd = await request.formData();
        const { token, setCookie } = csrfToken(request);
        const email = String(fd.get("email") ?? "").trim().slice(0, 200);
        const password = String(fd.get("password") ?? "").slice(0, 200);
        if (!checkCsrf(request, fd)) {
          return page({ title: "Вход", nav: false, body: form(token, email, "Обновите страницу и попробуйте снова."), setCookies: [setCookie], status: 400 });
        }
        const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
        if (error || !data.session) {
          return page({ title: "Вход", nav: false, body: form(token, email, "Неверная почта или пароль."), status: 401 });
        }
        return redirect("/lite", sessionCookies(data.session.access_token, data.session.refresh_token));
      },
    },
  },
});
