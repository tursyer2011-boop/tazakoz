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
