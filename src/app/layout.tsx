// app/layout.tsx
import type { Metadata } from "next";
import { Inter, Poppins, JetBrains_Mono } from "next/font/google";
import { GoogleAnalytics } from '@next/third-parties/google';
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/i18n";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: {
    default: "Callengo — AI Phone Agents for Business",
    template: "%s | Callengo",
  },
  description:
    "Automate outbound calls with AI voice agents. Qualify leads, validate data, and confirm appointments — so your team never has to.",
  metadataBase: new URL("https://app.callengo.com"),
  applicationName: "Callengo",
  keywords: [
    "AI phone agents",
    "outbound call automation",
    "lead qualification",
    "AI voice agents",
    "appointment confirmation",
    "data validation",
    "B2B SaaS",
    "sales automation",
    "AI calling platform",
  ],
  authors: [{ name: "Callengo" }],
  creator: "Callengo",
  publisher: "Callengo",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://app.callengo.com",
    siteName: "Callengo",
    title: "Callengo — AI Phone Agents for Business",
    description:
      "Automate outbound calls with AI voice agents. Qualify leads, validate data, and confirm appointments — so your team never has to.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Callengo — AI Phone Agents for Business",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Callengo — AI Phone Agents for Business",
    description:
      "Automate outbound calls with AI voice agents. Qualify leads, validate data, and confirm appointments.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} ${jetbrainsMono.variable}`}>
        <ErrorBoundary>
          <LanguageProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </LanguageProvider>
        </ErrorBoundary>
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  );
}