import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { hashToken } from "@/lib/crypto/token-vault";
import { writeIntegrationAudit } from "@/server/services/meta/integration";
import { IntegrationAuditKind } from "@prisma/client";

/**
 * Meta webhook foundation.
 * GET — hub verification (subscribe challenge)
 * POST — event receiver with signature validation scaffolding (no business processing)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN || "";

  if (mode === "subscribe" && token && expected && token === expected) {
    await writeIntegrationAudit({
      kind: IntegrationAuditKind.WEBHOOK_VALIDATED,
      message: "Webhook verification challenge accepted",
      meta: { mode },
    });
    return new NextResponse(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  await writeIntegrationAudit({
    kind: IntegrationAuditKind.WEBHOOK_REJECTED,
    message: "Webhook verification failed",
    meta: { mode, tokenPresent: Boolean(token) },
  });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") || "";
  const appSecret = process.env.META_APP_SECRET || "";

  let signatureValid = false;
  if (appSecret && signature.startsWith("sha256=")) {
    const expected = createHmac("sha256", appSecret)
      .update(rawBody)
      .digest("hex");
    const provided = signature.slice("sha256=".length);
    try {
      signatureValid = timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(provided),
      );
    } catch {
      signatureValid = false;
    }
  }

  // Accept structure only — do not process message payloads in this sprint
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = null;
  }

  await writeIntegrationAudit({
    kind: signatureValid
      ? IntegrationAuditKind.WEBHOOK_VALIDATED
      : IntegrationAuditKind.WEBHOOK_REJECTED,
    message: signatureValid
      ? "Webhook event received (stored audit only — not processed)"
      : "Webhook event rejected or unsigned",
    meta: {
      signatureValid,
      hasBody: Boolean(rawBody),
      object:
        parsed && typeof parsed === "object" && "object" in parsed
          ? (parsed as { object?: string }).object
          : null,
      verifyTokenHashHint: hashToken("meta-webhook").slice(0, 8),
      retryStrategy: "exponential",
    },
  });

  if (!signatureValid && process.env.META_API_ENABLED === "true") {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Always 200 when API disabled so Meta retries don't spam during foundation setup
  return NextResponse.json({ received: true, processed: false });
}
