import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, exchangeCodeForTokenMock, getGoogleOwnerIdMock, createGoogleSessionMock, deleteGoogleSessionMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  exchangeCodeForTokenMock: vi.fn(),
  getGoogleOwnerIdMock: vi.fn(),
  createGoogleSessionMock: vi.fn(),
  deleteGoogleSessionMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/google-auth", () => ({
  exchangeCodeForToken: exchangeCodeForTokenMock,
  getGoogleOwnerId: getGoogleOwnerIdMock,
}));

vi.mock("@/lib/google-session", () => ({
  createGoogleSession: createGoogleSessionMock,
  deleteGoogleSession: deleteGoogleSessionMock,
  GOOGLE_SESSION_COOKIE: "google_session_id",
  GOOGLE_SESSION_MAX_AGE_SECONDS: 7776000,
}));

import { GET } from "@/app/api/auth/google/callback/route";

describe("GET /api/auth/google/callback", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    getGoogleOwnerIdMock.mockResolvedValue("google-owner-1");
    createGoogleSessionMock.mockResolvedValue({ id: "session-id", expires: new Date("2027-01-01T00:00:00Z") });
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
      refresh_token: "test-refresh-token",
    });
    const response = await GET(
      new Request("http://localhost/api/auth/google/callback?code=abc&state=match-state")
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost/connect-google-photos?auth=ok"
    );
    expect(exchangeCodeForTokenMock).toHaveBeenCalledWith("abc");
    expect(getGoogleOwnerIdMock).toHaveBeenCalledWith("test-access-token");
    expect(createGoogleSessionMock).toHaveBeenCalledWith({
      ownerId: "google-owner-1",
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      expiresIn: 3600,
    });
    expect(response.cookies.get("google_session_id")).toMatchObject({
      value: "session-id",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7776000,
    });
    expect(response.cookies.get("google_oauth_state")?.value).toBe("");
  });

  it("uses the configured public origin instead of the container request origin", async () => {
    vi.stubEnv(
      "GOOGLE_REDIRECT_URI",
      "https://one-pic-diary.example.run.app/api/auth/google/callback"
    );
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "match-state" })),
    });
    exchangeCodeForTokenMock.mockResolvedValue({
      access_token: "test-access-token",
      expires_in: 3600,
      refresh_token: "test-refresh-token",
    });

    const response = await GET(
      new Request("http://0.0.0.0:8080/api/auth/google/callback?code=abc&state=match-state")
    );

    expect(response.headers.get("location")).toBe(
      "https://one-pic-diary.example.run.app/connect-google-photos?auth=ok"
    );
  });

  it("does not create a non-persistent session when Google omits the refresh token", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn(() => ({ value: "match-state" })) });
    exchangeCodeForTokenMock.mockResolvedValue({ access_token: "access", expires_in: 3600 });
    const response = await GET(new Request(
      "http://localhost/api/auth/google/callback?code=abc&state=match-state"
    ));
    expect(response.headers.get("location")).toBe(
      "http://localhost/connect-google-photos?auth=token_error"
    );
    expect(createGoogleSessionMock).not.toHaveBeenCalled();
  });

});
