import { createFileRoute } from "@tanstack/react-router";
import { REGIONS } from "@/lib/regions";
import { checkCsrf, csrfToken, esc, page, requireLite, SEVERITY_RU } from "@/lib/lite.server";
import { submitReportCore } from "@/lib/report-core.server";

const MAX_BYTES = 8 * 1024 * 1024;

// Tiny ES3/ES5 script: fills coordinates when old Safari allows geolocation.
const GEO_SCRIPT = `<script>(function(){var s=document.getElementById('geo');if(!navigator.geolocation||!s)return;s.innerHTML='Определяем местоположение…';navigator.geolocation.getCurrentPosition(function(p){document.getElementById('lat').value=p.coords.latitude;document.getElementById('lng').value=p.coords.longitude;s.innerHTML='Местоположение определено (точность '+Math.round(p.coords.accuracy)+' м)';},function(){s.innerHTML='Не удалось определить местоположение — выберите город.';},{enableHighAccuracy:true,timeout:15000});})();</script>`;

function form(token: string, error = "") {
  const cities = REGIONS.map((r, i) => `<option value="${i}">${esc(r.name)}</option>`).join("");
  return `<h1>Сообщить о загрязнении</h1>
${error ? `<div class="msg err">${esc(error)}</div>` : ""}
<form class="card" method="post" action="/lite/report" enctype="multipart/form-data">
<input type="hidden" name="csrf" value="${esc(token)}">
<input type="hidden" name="lat" id="lat" value=""><input type="hidden" name="lng" id="lng" value="">
<label>Фото загрязнения</label><input type="file" name="photo" accept="image/*" required>
<label>Город</label><select name="city">${cities}</select>
<label>Адрес или ориентир</label><input type="text" name="address" maxlength="200" placeholder="Например: 15 мкр, пляж у дома 40">
<label>Комментарий</label><textarea name="comment" maxlength="600"></textarea>
<p class="muted" id="geo">Местоположение возьмём по выбранному городу.</p>
<button class="btn" type="submit">Отправить</button>
<p class="muted">Проверка фото занимает до минуты — не закрывайте страницу.</p>
</form>${GEO_SCRIPT}`;
}

export const Route = createFileRoute("/lite/report")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireLite(request);
        if ("response" in auth) return auth.response;
        const { token, setCookie } = csrfToken(request);
        return page({
          title: "Жалоба",
          active: "/lite/report",
          body: form(token),
          setCookies: [...auth.session.setCookies, setCookie],
        });
      },
      POST: async ({ request }) => {
        const auth = await requireLite(request);
        if ("response" in auth) return auth.response;
        const { session } = auth;
        const { token, setCookie } = csrfToken(request);
        const fail = (msg: string, status = 400) =>
          page({ title: "Жалоба", active: "/lite/report", body: form(token, msg), setCookies: [...session.setCookies, setCookie], status });

        let fd: FormData;
        try {
          fd = await request.formData();
        } catch {
          return fail("Не удалось прочитать форму. Попробуйте фото поменьше.");
        }
        if (!checkCsrf(request, fd)) return fail("Обновите страницу и попробуйте снова.");

        const photo = fd.get("photo");
        if (!photo || typeof photo === "string" || photo.size === 0) return fail("Добавьте фото.");
        if (photo.size > MAX_BYTES) return fail("Фото слишком большое (до 8 МБ).");
        const bytes = new Uint8Array(await photo.arrayBuffer());
        const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        if (!isJpeg && !isPng) return fail("Нужно фото в формате JPEG или PNG.");
        const mime = isJpeg ? "image/jpeg" : "image/png";

        const city = REGIONS[Number(fd.get("city"))] ?? REGIONS[0]!;
        let lat = Number(fd.get("lat"));
        let lng = Number(fd.get("lng"));
        const hasGeo = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        if (!hasGeo) {
          lat = city.lat;
          lng = city.lng;
        }
        const address = String(fd.get("address") ?? "").trim().slice(0, 200);
        const userComment = String(fd.get("comment") ?? "").trim().slice(0, 600);
        const comment = [address && `Адрес: ${address}`, userComment].filter(Boolean).join(". ").slice(0, 600);

        const path = `${session.userId}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await session.supabase.storage
          .from("reports")
          .upload(path, bytes, { contentType: mime });
        if (upErr) return fail("Не удалось загрузить фото. Попробуйте ещё раз.", 500);

        const imageBase64 = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
        try {
          const res = await submitReportCore(session.supabase, session.userId, {
            imageBase64,
            photoPath: path,
            comment,
            lat,
            lng,
            region: city.name,
          });
          const body = `<div class="card"><h1 class="${res.approved ? "ok" : "bad"}">${res.approved ? "Жалоба принята" : "Жалоба отклонена"}</h1>
<p>${esc(res.reason)}</p>
${res.approved ? `<p>Масштаб: <b>${esc(SEVERITY_RU[res.severity] ?? res.severity)}</b><br>Начислено: <b>+${esc(res.credits)}</b> кредитов</p>` : ""}
<p class="muted">${esc(res.address || address || city.name)}</p>
<a class="btn" href="/lite/report">Отправить ещё</a><a class="btn gray" href="/lite">На главную</a></div>`;
          return page({ title: "Результат", active: "/lite/report", body, setCookies: session.setCookies });
        } catch (e) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.storage.from("reports").remove([path]);
          return fail(e instanceof Error ? e.message : "Ошибка отправки.");
        }
      },
    },
  },
});
