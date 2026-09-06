import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "1PicDiary",
  description: "One photo diary per kid per day",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
