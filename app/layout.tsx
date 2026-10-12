import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: '1PicDiary',
  description:
    'Photo diaries for the people, relationships, pets, and moments in your life',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang='en' className='h-full antialiased'>
      <body className='min-h-full'>{children}</body>
    </html>
  );
}
