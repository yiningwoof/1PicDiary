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
    expect(response.headers.get("location")).toBe("http://localhost/connect-google-photos?auth=missing_code");
  });

  it("redirects with state_error when oauth state mismatches", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "expected" })),
    });

    const response = await GET(
      new Request("http://localhost/api/auth/google/callback?code=abc&state=wrong")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/connect-google-photos?auth=state_error");
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
    expect(response.headers.get("location")).toBe("http://localhost/connect-google-photos?auth=token_error");
  });

  it("returns to setup when consent is cancelled without exchanging a token", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn() });
    const response = await GET(
      new Request("http://localhost/api/auth/google/callback?error=access_denied")
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost/connect-google-photos?auth=cancelled"
    );
    expect(exchangeCodeForTokenMock).not.toHaveBeenCalled();
  });

  it("returns to setup with a secure session cookie after a valid callback", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "match-state" })),
    });
    exchangeCodeForTokenMock.mockResolvedValue({
      access_token: "test-access-token",
      expires_in: 3600,
    });
    const response = await GET(
      new Request("http://localhost/api/auth/google/callback?code=abc&state=match-state")
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost/connect-google-photos?auth=ok"
    );
    expect(exchangeCodeForTokenMock).toHaveBeenCalledWith("abc");
    expect(response.cookies.get("google_access_token")).toMatchObject({
      value: "test-access-token",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 3600,
    });
    expect(response.cookies.get("google_oauth_state")?.value).toBe("");
  });

});
