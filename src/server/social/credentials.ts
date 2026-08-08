import {
  encryptSecret,
  decryptSecret,
  hashToken,
  randomUrlSafeToken,
} from "@/lib/crypto/token-vault";
import type { SocialTokenBundle } from "@/server/social/types";

export function createOAuthStateToken(): string {
  return randomUrlSafeToken(32);
}

export function hashOAuthState(state: string): string {
  return hashToken(state);
}

export function encryptTokenBundle(tokens: SocialTokenBundle) {
  const access = encryptSecret(tokens.accessToken);
  const refresh = tokens.refreshToken
    ? encryptSecret(tokens.refreshToken)
    : null;
  return {
    accessCiphertext: access.ciphertext,
    accessIv: access.iv,
    accessAuthTag: access.authTag,
    refreshCiphertext: refresh?.ciphertext ?? null,
    refreshIv: refresh?.iv ?? null,
    refreshAuthTag: refresh?.authTag ?? null,
    tokenType: tokens.tokenType || "Bearer",
    scopes: tokens.scopes,
    accessExpiresAt: tokens.accessExpiresAt ?? null,
    refreshExpiresAt: tokens.refreshExpiresAt ?? null,
    keyVersion: access.keyVersion,
  };
}

export function decryptTokenBundle(row: {
  accessCiphertext: string;
  accessIv: string;
  accessAuthTag: string;
  refreshCiphertext: string | null;
  refreshIv: string | null;
  refreshAuthTag: string | null;
  tokenType: string;
  scopes: string[];
  accessExpiresAt: Date | null;
  refreshExpiresAt: Date | null;
}): SocialTokenBundle {
  const accessToken = decryptSecret({
    ciphertext: row.accessCiphertext,
    iv: row.accessIv,
    authTag: row.accessAuthTag,
  });
  let refreshToken: string | null = null;
  if (row.refreshCiphertext && row.refreshIv && row.refreshAuthTag) {
    refreshToken = decryptSecret({
      ciphertext: row.refreshCiphertext,
      iv: row.refreshIv,
      authTag: row.refreshAuthTag,
    });
  }
  return {
    accessToken,
    refreshToken,
    tokenType: row.tokenType,
    scopes: row.scopes,
    accessExpiresAt: row.accessExpiresAt,
    refreshExpiresAt: row.refreshExpiresAt,
  };
}

/** Redact any secret-looking strings from objects before logging/API. */
export function redactSecrets<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") {
    if (
      /access[_-]?token|refresh[_-]?token|client_secret|bearer\s+[a-z0-9._-]+/i.test(
        value,
      )
    ) {
      return "[REDACTED]" as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactSecrets(v)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (
        /token|secret|password|authorization|ciphertext|authTag|codeVerifier/i.test(
          k,
        )
      ) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out as T;
  }
  return value;
}

export function assertNoTokenLeak(payload: unknown): void {
  const json = JSON.stringify(payload);
  if (!json) return;
  // Encrypted ciphertext is ok; raw bearer-like long secrets in known keys aren't.
  if (
    /"accessToken"\s*:\s*"[^"]{20,}"|"refreshToken"\s*:\s*"[^"]{20,}"|"access_token"\s*:\s*"[^"]{8,}"/.test(
      json,
    )
  ) {
    throw new Error("TOKEN_LEAK_DETECTED");
  }
}
