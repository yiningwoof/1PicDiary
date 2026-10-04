import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

describe("canonical URL proxy", () => {
  it("preserves the path and query while redirecting an alternate Cloud Run host", () => {
    vi.stubEnv("APP_URL", "https://one-pic-diary-844649524292.us-central1.run.app");
    const request = new NextRequest("http://0.0.0.0:8080/connect-google-photos?auth=ok", {
      headers: { "x-forwarded-host": "one-pic-diary-rkgqfsgsla-uc.a.run.app" },
    });
    const response = proxy(request);
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://one-pic-diary-844649524292.us-central1.run.app/connect-google-photos?auth=ok"
    );
  });

  it("continues requests already using the canonical host", () => {
    vi.stubEnv("APP_URL", "https://one-pic-diary-844649524292.us-central1.run.app");
    const request = new NextRequest("http://0.0.0.0:8080/", {
      headers: { "x-forwarded-host": "one-pic-diary-844649524292.us-central1.run.app" },
    });
    expect(proxy(request).headers.get("x-middleware-next")).toBe("1");
  });

  it("does not redirect local development when APP_URL is unset", () => {
    vi.stubEnv("APP_URL", "");
    expect(proxy(new NextRequest("http://localhost:3000/")) .headers.get("x-middleware-next")).toBe("1");
  });
});
