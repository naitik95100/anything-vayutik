import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';
import './global.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Anything App',
  description: 'Created with Anything',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="/fontawesome/releases/v6.3.0/css/pro.min.css?token=2c15cc0cc7"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Script
          src="https://unpkg.com/@dotlottie/player-component@latest/dist/dotlottie-player.mjs"
          strategy="afterInteractive"
          type="module"
        />
      </body>
    </html>
  );
}
