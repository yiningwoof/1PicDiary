# 1PicDiary

一个基于 Next.js 的 Web App：
- 在手机上选择日记主题（自己、孩子、婚姻或宠物等）
- 上传一张照片并输入一句日记
- 选择文字位置并预览合成图
- 保存到 Google Photos 的指定 app album

## Tech Stack

- Next.js + TypeScript
- Tailwind CSS + shadcn/ui 风格组件
- Sharp（图片合成）
- Supabase（Postgres）
- Google OAuth + Google Photos Library API
- Testing: Vitest + Playwright

## 环境变量

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

## 运行

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

## Supabase 表结构

将 `supabase/schema.sql` 内容粘贴到 Supabase SQL Editor 执行。


## Subject-specific albums

Connect Google Photos, add a subject with an album name (for example, A → A's Diary),
then select that subject before uploading. Add B with B's Diary separately.
The server stores each subject and Google album ID in Supabase, scoped to the verified
Google account. Saves resolve the subject on the server and ignore caller-supplied
subject names or album destinations. Existing app-created albums can be reused by
name during setup; subsequent saves use the stored album ID even after a Photos rename.
Do not change the Google OAuth client ID after creating albums.

Run `supabase/schema.sql` in your empty Supabase database. It creates `subjects`
first, followed by `diaries` with a required `subject_id` foreign key. Subject profiles require
`SUPABASE_URL` and `SUPABASE_SECRET_KEY` on the server. The secret key must start with `sb_secret_` and neither server setting should use a `NEXT_PUBLIC_` prefix. The legacy `SUPABASE_SERVICE_ROLE_KEY` remains supported temporarily as a fallback. No Supabase Storage bucket is needed. Images are uploaded only to Google Photos;
Supabase stores the Google media ID and diary metadata.
The subjects table has RLS enabled with no public policies: only server service-role
queries may access it, and every query must filter by the verified Google subject.

The app creates or reuses the album when adding a subject. Choose distinct subject and
album names per Google account. Unfinished photo drafts stay separate per subject
while the page remains open; reloads do not retain those drafts. Subjects and album
mappings are stored in the database and load after reconnecting on another device.
If Google Photos accepts an album but the database write fails, retry with the same
album name to reuse it. Account sign-in must be renewed when the access token expires.


## Diary dates and Google-only image storage

Each subject’s editor has a diary date defaulting to the browser’s local calendar day.
Users can change it for past entries. Saves require a real YYYY-MM-DD calendar date,
stored as `diaries.diary_date` (Postgres DATE). `created_at` remains the timestamp of
record creation. Both `subject_id` and `diary_date` are required in the database.

Use `supabase/schema.sql` for initial setup. No migration is needed before tables
have been created. Later schema changes should use separate migrations.
No image bytes are sent to Supabase Storage, and no Storage bucket is required.

## Subject relationship

`diaries.subject_id` references `subjects.id`. Subject names, Google account ownership,
and album settings live only in `subjects`, rather than being duplicated in each
entry. Join through `subject_id` when reading those details. The save API verifies
that the subject belongs to the connected Google account before saving a diary.
The foreign key prevents nonexistent subjects and restricts deleting a subject with
existing diaries. Multiple entries on the same diary date are allowed.


## Generic diary subjects

`subjects` represents anything a diary is about: a person, a relationship, a pet,
or another topic. `diaries.subject_id` is the required foreign key to `subjects.id`.
The browser loads and creates subjects through `/api/subjects`; save requests send
`subjectId`, while preview requests send `subjectName`. Each subject retains its own
Google album and account ownership checks. No category restriction is imposed.


## Optional originals

Subject setup defaults “Keep original photos too” to checked. The album prefix
produces `<prefix>_diary` and, when checked, `<prefix>_daily_picture`. Both albums
are created or reused during setup. Unchecking creates only the diary album.
The saved subject preference controls later uploads; the client cannot override
album destinations during a save. Original bytes are uploaded unchanged with their
filename and MIME type. Supabase stores `google_original_media_item_id` alongside
`google_media_item_id`; it stores no image files. A failed original upload leaves
its reference NULL and returns a warning while retaining the finished diary record.
This adds preservation only; retrieving originals and reapplying layouts comes later.
Use the updated initial schema for a database whose tables have not yet been created.

### Adjusting text on photos

After selecting a photo and entering a diary line, drag the text to move it. Pinch with two fingers to change its size; drag the right handle to rewrap the text. Sliders, position presets, and keyboard controls provide alternatives. Export is enabled once the server-rendered preview finishes updating. The selection outline is never exported.

`diaries.text_layout` stores a versioned JSONB object: normalized `box` coordinates relative to the EXIF-oriented image, font family, font size and outline width as fractions of image width, colors, alignment, source, image dimensions, and the rendered text. Preview and export use the same renderer. This format allows a future AI suggestion and manual adjustments to share the same layout; AI placement and restoring old entries are not implemented yet. Photo bytes remain in Google Photos only.

For a new database, use the updated initial schema in `supabase/schema.sql`. An already-created database using `text_position` needs a migration before saving this new layout format.
