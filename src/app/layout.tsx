import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { getI18n } from "@/i18n/server";
import "@fontsource/estedad/arabic-400.css";
import "@fontsource/estedad/arabic-500.css";
import "@fontsource/estedad/arabic-600.css";
import "@fontsource/estedad/arabic-700.css";
import "@fontsource/estedad/latin-400.css";
import "@fontsource/estedad/latin-500.css";
import "@fontsource/estedad/latin-600.css";
import "@fontsource/estedad/latin-700.css";
import "./globals.css";

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Inzorya",
    template: "%s · Inzorya",
  },
  description: "AI Marketing Operating System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, dictionary, dir } = await getI18n();

  return (
    <html
      lang={locale}
      dir={dir}
      className="light"
      suppressHydrationWarning
    >
      <head>
        {/* Force light before paint — clears legacy dark localStorage */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{localStorage.removeItem('inzorya-theme');localStorage.removeItem('inzorya-theme-v2');if(!localStorage.getItem('inzorya-light-migrate-1')){localStorage.setItem('inzorya-theme-v3','light');localStorage.setItem('inzorya-light-migrate-1','1');}var t=localStorage.getItem('inzorya-theme-v3');if(t!=='dark')t='light';localStorage.setItem('inzorya-theme-v3',t);var d=document.documentElement;d.classList.remove('dark','light');d.classList.add(t);d.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${sans.variable} min-h-svh antialiased ${
          locale === "fa" ? "font-fa" : "font-sans"
        }`}
      >
        <AppProviders locale={locale} dictionary={dictionary}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
