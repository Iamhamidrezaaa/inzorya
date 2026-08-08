import type { Metadata } from "next";
import { AppProviders } from "@/components/providers/app-providers";
import { getI18n } from "@/i18n/server";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/estedad/arabic-400.css";
import "@fontsource/estedad/arabic-500.css";
import "@fontsource/estedad/arabic-600.css";
import "@fontsource/estedad/arabic-700.css";
import "@fontsource/estedad/latin-400.css";
import "@fontsource/estedad/latin-500.css";
import "@fontsource/estedad/latin-600.css";
import "@fontsource/estedad/latin-700.css";
import "./globals.css";

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
      <body
        className={`min-h-svh antialiased ${
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
