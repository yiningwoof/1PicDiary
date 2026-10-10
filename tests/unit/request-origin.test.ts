import { afterEach, describe, expect, it, vi } from "vitest";

import { hasTrustedRequestOrigin } from "@/lib/request-origin";

afterEach(() => vi.unstubAllEnvs());

describe("request origin validation", () => {
  it("accepts the browser host forwarded to a Cloud Run container", () => {
    const request = new Request("https://one-pic-diary-random-uc.a.run.app/api/subjects", {
      headers: {
        host: "one-pic-diary-844649524292.us-central1.run.app",
        origin: "https://one-pic-diary-844649524292.us-central1.run.app",
        "x-forwarded-proto": "https",
      },
    });

    expect(hasTrustedRequestOrigin(request)).toBe(true);
  });

  it("accepts the configured canonical app origin", () => {
    vi.stubEnv("APP_URL", "https://one-pic-diary.example.com");
    const request = new Request("http://0.0.0.0:8080/api/subjects", {
      headers: { origin: "https://one-pic-diary.example.com" },
    });

    expect(hasTrustedRequestOrigin(request)).toBe(true);
  });

  it("rejects a different website", () => {
    const request = new Request("https://one-pic-diary.example.com/api/subjects", {
      headers: {
        host: "one-pic-diary.example.com",
        origin: "https://attacker.example",
      },
    });

    expect(hasTrustedRequestOrigin(request)).toBe(false);
  });
});
