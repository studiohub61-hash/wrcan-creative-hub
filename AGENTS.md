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

- App data lives in Lovable Cloud (tables, storage buckets, realtime); storage buckets are private and media is served via signed URLs because public buckets are blocked.
- The home-page UAT panel keeps tester results in browser localStorage and exports CSV; no database table is used for it.
- The infrastructure feature at /ecd/infrastructure renders the dedicated InfrastructureAudit tool, saving owner-scoped ecd_records and private campaign photos with per-upload location and timestamp metadata so evidence can be reviewed later.
- The public /attendance dashboard shares registered people and attendance logs through device-local state and localStorage, retaining sample profiles without Cloud reads or writes so testing requires no account; camera access is user-initiated and tracks stop on exit. Punctuality uses Africa/Johannesburg shift times and stable person IDs so matching names cannot mix records.
- The public /retention dashboard uses an explicit sample cohort and pure calculation/export helpers; intervention photos and opt-in GPS stay in page memory, preventing unapproved storage of student evidence.
