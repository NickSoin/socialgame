import '@/styles/globals.css';
import localFont from 'next/font/local';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { DynamicLayoutProviders } from './DynamicLayoutProviders';
import { ClientLayout } from './ClientLayout';
import { getURL } from '@/utils/helpers';

const inter = localFont({
  src: [
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
});

const robotoMono = localFont({
  src: [
    { path: '../../node_modules/@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/roboto-mono/files/roboto-mono-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-roboto-mono',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol =
    requestHeaders.get('x-forwarded-proto') ??
    (host?.startsWith('localhost') || host?.startsWith('127.0.0.1')
      ? 'http'
      : 'https');
  const origin = host ? `${protocol}://${host}` : getURL();
  const imageUrl = new URL('/og.png', origin).toString();

  return {
    metadataBase: new URL(origin),
    title: {
      default: 'SteamBets — Steam forecasts',
      template: '%s · SteamBets',
    },
    description: 'Forecast upcoming Steam games.',
    openGraph: {
      title: 'SteamBets — Steam forecasts',
      description: 'Forecast upcoming Steam games.',
      type: 'website',
      images: [{ url: imageUrl, width: 1672, height: 941, alt: 'SteamBets social preview' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'SteamBets — Steam forecasts',
      description: 'Forecast upcoming Steam games.',
      images: [imageUrl],
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${robotoMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://shared.fastly.steamstatic.com" />
      </head>
      <body>
        <DynamicLayoutProviders>
          <ClientLayout>
            {children}
          </ClientLayout>
        </DynamicLayoutProviders>
      </body>
    </html>
  );
}
