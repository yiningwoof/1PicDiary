# 1PicDiary

一个基于 Next.js 的 Web App：
- 在手机上选择孩子
- 上传一张照片并输入一句日记
- 选择文字位置并预览合成图
- 保存到 Google Photos 的指定 app album

## Tech Stack

- Next.js + TypeScript
- Tailwind CSS + shadcn/ui 风格组件
- Sharp（图片合成）
- Supabase（Postgres + Storage）
- Google OAuth + Google Photos Library API
- Testing: Vitest + Playwright

## 环境变量

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_BUCKET_NAME=diary-images
```

## 运行

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

## Supabase 表结构

将 `supabase/schema.sql` 内容粘贴到 Supabase SQL Editor 执行。
