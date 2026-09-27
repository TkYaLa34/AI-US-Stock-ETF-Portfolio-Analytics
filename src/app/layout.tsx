import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AI US Stock & ETF Portfolio Analytics',
    template: '%s | AI Portfolio Analytics',
  },
  description:
    'วิเคราะห์และติดตามพอร์ตโฟลิโอหุ้นและกองทุนของคุณ พร้อมข้อมูลเชิงลึกจาก AI',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="th">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
