"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const OPTIONS: {
  locale: Locale;
  native: string;
  flagSrc: string;
  flagAlt: string;
}[] = [
  {
    locale: "en",
    native: "English",
    flagSrc: "/flags/england.svg",
    flagAlt: "England",
  },
  {
    locale: "fa",
    native: "فارسی",
    flagSrc: "/flags/iran.svg",
    flagAlt: "Iran",
  },
];

function FlagImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={20}
      height={14}
      className={cn(
        "h-3.5 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10",
        className,
      )}
      unoptimized
    />
  );
}

type Props = {
  variant?: "ghost" | "outline" | "secondary";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
};

export function LanguageSwitcher({
  variant = "ghost",
  size = "sm",
  className,
  showLabel = true,
}: Props) {
  const { locale, dictionary, setLocale, pending } = useI18n();
  const current = OPTIONS.find((o) => o.locale === locale) ?? OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          disabled={pending}
          className={cn("gap-1.5", className)}
          aria-label={dictionary.common.language}
        >
          <FlagImage src={current.flagSrc} alt={current.flagAlt} />
          {showLabel ? (
            <span
              className={cn(
                "text-xs font-medium",
                current.locale === "fa" && "font-fa",
              )}
            >
              {current.native}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9.5rem]">
        {OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.locale}
            disabled={pending}
            onClick={() => setLocale(opt.locale)}
            className="gap-2"
          >
            <FlagImage src={opt.flagSrc} alt={opt.flagAlt} />
            <span
              className={cn("flex-1", opt.locale === "fa" && "font-fa")}
            >
              {opt.native}
            </span>
            {locale === opt.locale ? (
              <Check className="size-4 shrink-0 opacity-70" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
