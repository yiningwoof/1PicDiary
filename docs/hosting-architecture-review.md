# 1PicDiary Hosting Architecture Review

**Status:** Accepted for development and initial private deployment  
**Reviewed:** September 19, 2026  
**Revisit when:** preparing for a public launch, Supabase Free becomes limiting, or hosting costs/latency justify a migration

## Decision

Use this stack for development and the first private deployment:

- **Google Cloud Run:** host the complete Next.js application, API routes, Google OAuth flow, Sharp/libvips image composition, and Google Photos uploads.
- **Supabase Free:** store subjects, diary dates and text, versioned text layouts, and Google album/media IDs.
- **Google Photos:** store original and composed photos. Do not duplicate photos in Supabase Storage.
- **Optional Cloudflare later:** DNS, CDN, firewall, or a full migration to Workers + Containers + D1.

```text
Browser
   ↓
Cloud Run: Next.js + OAuth + Sharp
   ├── Supabase: metadata
   └── Google Photos: images
```

## Why this is the current choice

Cloud Run runs a normal Linux container, so the existing Node.js, Sharp, and libvips implementation can deploy with few architectural changes. Supabase already matches the PostgreSQL schema and server-side data-access code. Both services can scale to zero or provide a useful free allowance during development.

This choice prioritizes finishing and learning one working, production-shaped system before adopting a second platform.

## Terse tradeoffs

| Option | Pros | Cons |
|---|---|---|
| Cloud Run + Supabase | Least rewrite; normal Node.js and native Sharp; PostgreSQL; simple single-service debugging; portable container | Two vendors; Google Cloud setup is more involved; Supabase Free pauses when inactive and lacks automatic backups |
| Cloudflare Worker + Container + D1 | Integrated DNS/CDN/security/database/compute; low base price; global Worker; D1 Time Travel; native Sharp works in Container | Containers require paid Workers; Worker-to-Container routing; D1/SQLite rewrite; authorization moves into app code; Containers are newer |
| Cloudflare Worker only | Global, fast, inexpensive for lightweight logic | 128 MB memory; no normal native Sharp/libvips runtime; unsuitable for current image pipeline |

## Finances

Current public pricing can change; verify before launch.

| Service | Development expectation | Production consideration |
|---|---|---|
| Cloud Run | Ongoing free allowance; scale to zero; billing account required | Pay per request/CPU/memory/network beyond allowance; use billing alerts and a low maximum instance count |
| Supabase Free | $0; 500 MB database; two active projects; sufficient for metadata testing | May pause after one inactive week; no automatic backups; do not treat it as the sole copy of irreplaceable data |
| Supabase Pro | Not needed initially | Starts around $25/month; suitable when public traffic, uptime, and managed backups matter |
| Google Photos | Uses the user's Google storage | Storage cost/limits belong to the user's Google account |
| Cloudflare Worker + Container + D1 | Container use is not available on the free Workers plan | Workers Paid starts around $5/month and includes initial Worker, Container, and D1 usage, with usage charges beyond allowances |

References: [Cloud Run pricing](https://cloud.google.com/run/pricing), [Supabase pricing](https://supabase.com/pricing), [Cloudflare Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/).

## Initial implementation plan

1. Use Supabase Free for replaceable development data.
2. Keep photographs only in Google Photos.
3. Containerize the current Next.js app for Cloud Run.
4. Use request-based billing, zero minimum instances, a conservative maximum instance count, and billing alerts.
5. Store Google and Supabase secrets only in server-side environment variables or managed secrets.
6. Register the production Cloud Run/custom-domain OAuth callback with Google.
7. Add Google refresh-token handling before broader use.
8. Export Supabase data periodically once diary records become valuable; upgrade before depending on production uptime/backups.

## Keeping a future migration feasible

- Put database operations behind a small repository interface rather than spreading `supabase.from(...)` calls through routes.
- Generate subject UUIDs in application code where practical.
- Keep diary dates as `YYYY-MM-DD` and layouts as versioned portable JSON.
- Keep Google album/media IDs independent from the database provider.
- Maintain versioned schema migrations and tested export/import scripts.
- Make owner-scoped access mandatory at the repository boundary.
- Avoid storing provider-specific URLs in diary records.

## Feasible future Cloudflare architecture

```text
Browser
   ↓
Cloudflare Worker: routing, OAuth, authorization, D1 access
   ├── D1: diary metadata
   └── Cloudflare Container: Node.js + Sharp/libvips
                              └── Google Photos
```

A later migration is feasible because images remain in Google Photos and only metadata must move. Expected work:

- Convert PostgreSQL types and constraints to SQLite-compatible D1 SQL.
- Replace Supabase queries with parameterized D1 queries.
- Replace PostgreSQL RLS/service-role behavior with explicit Worker authorization.
- Import subjects and diaries, validate counts and relationships, then perform a short write freeze for final cutover.
- Update Google OAuth redirect URIs and point the production domain to Cloudflare.

Before migrating, run a proof using realistic phone photos to measure Container cold starts, Sharp memory/CPU use, output correctness, and end-to-end Google Photos upload time. Keep Supabase read-only during a rollback window after cutover.

## Public-launch review triggers

Reassess the architecture when any of these becomes true:

- The app will serve users beyond a private test group.
- Diary metadata is no longer replaceable.
- Supabase Free pausing or lack of backups is unacceptable.
- Google OAuth verification and privacy/deletion requirements are ready.
- Actual usage shows Cloudflare consolidation would materially lower cost or improve latency.
- The team wants the migration as a deliberate learning project and can test it without risking production data.
