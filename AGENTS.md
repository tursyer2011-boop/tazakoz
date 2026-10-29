<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Lite version for old Safari (iOS 6) lives in server routes under src/routes/lite/* rendering plain HTML via src/lib/lite.server.ts (cookie session, CSRF); complaint logic is shared in src/lib/report-core.server.ts — why: old WebKit cannot run the React app, and both versions must apply identical anti-fraud and reward rules.
- Modern maps share Map2Gis with dynamically loaded MapGL and reconciled HTML markers; weather uses an authenticated cached server function at a fixed regional location — why: preserve interactions and live team movement without exposing server credentials or requesting weather outside the service region.
- Map and lite report reads use the authenticated RLS client, including area photos; never bypass report visibility with an admin read — why: ownership and staff assignment must apply across all resident surfaces.
- New-report alerts are persisted by an INSERT trigger in a recipient-owned notification inbox and polled from the shared header — why: every creation path notifies volunteers without exposing report contents or losing alerts while offline.
