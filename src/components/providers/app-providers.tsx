"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/providers/theme-provider";
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
        <LocaleProvider locale={locale} dictionary={dictionary}>
          <ThemeProvider defaultTheme="light">
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster
                theme="light"
                position={locale === "fa" ? "bottom-left" : "bottom-right"}
                richColors
                closeButton
                dir={locale === "fa" ? "rtl" : "ltr"}
              />
            </TooltipProvider>
          </ThemeProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
