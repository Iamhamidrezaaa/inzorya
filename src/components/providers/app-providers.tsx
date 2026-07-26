"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleProvider } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export function AppProviders({
  children,
  locale,
  dictionary,
}: {
  children: React.ReactNode;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          forcedTheme={undefined}
        >
          <LocaleProvider locale={locale} dictionary={dictionary}>
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster
                theme="system"
                position={locale === "fa" ? "bottom-left" : "bottom-right"}
                richColors
                closeButton
                dir={locale === "fa" ? "rtl" : "ltr"}
              />
            </TooltipProvider>
          </LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
