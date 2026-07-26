import { NextResponse } from "next/server";
import { z } from "zod";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

const bodySchema = z.object({
  locale: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    if (!isLocale(body.locale)) {
      return NextResponse.json({ error: "Invalid locale." }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true, locale: body.locale });
    response.cookies.set(LOCALE_COOKIE, body.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
}
