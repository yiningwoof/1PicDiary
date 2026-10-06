import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptGoogleToken, encryptGoogleToken } from "@/lib/token-crypto";

describe("Google token encryption", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  });

  it("round trips a token without storing its plaintext", () => {
    const encrypted = encryptGoogleToken("refresh-secret", "session:refresh");
    expect(encrypted).not.toContain("refresh-secret");
    expect(decryptGoogleToken(encrypted, "session:refresh")).toBe("refresh-secret");
  });

  it("rejects a token moved to a different session or token type", () => {
    const encrypted = encryptGoogleToken("secret", "session-a:refresh");
    expect(() => decryptGoogleToken(encrypted, "session-b:refresh")).toThrow();
    expect(() => decryptGoogleToken(encrypted, "session-a:access")).toThrow();
  });
});
