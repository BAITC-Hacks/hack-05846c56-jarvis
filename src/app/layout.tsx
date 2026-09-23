import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jarvis — ваш ассистент EKT',
  description: 'Подбирайте электротехнику, сравнивайте товары и собирайте проект с Jarvis. На русском и қазақша.',
  icons: { icon: '/icon.svg' },
};
export const viewport: Viewport = { themeColor: '#0b0b0d', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
