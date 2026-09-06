import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, exchangeCodeForTokenMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  exchangeCodeForTokenMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/google-auth", () => ({
  exchangeCodeForToken: exchangeCodeForTokenMock,
}));

import { GET } from "@/app/api/auth/google/callback/route";

describe("GET /api/auth/google/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects with missing_code when code is absent", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn() });

    const response = await GET(new Request("http://localhost/api/auth/google/callback"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/?auth=missing_code");
  });

  it("redirects with state_error when oauth state mismatches", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "expected" })),
    });

    const response = await GET(
      new Request("http://localhost/api/auth/google/callback?code=abc&state=wrong")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/?auth=state_error");
  });

  it("redirects with token_error when token exchange fails", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "match-state" })),
    });
    exchangeCodeForTokenMock.mockRejectedValue(new Error("boom"));

    const response = await GET(
      new Request("http://localhost/api/auth/google/callback?code=abc&state=match-state")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/?auth=token_error");
  });
});
