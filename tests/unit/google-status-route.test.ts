import { beforeEach, describe, expect, it, vi } from "vitest";

const { getGoogleSessionMock, deleteGoogleSessionMock, getGoogleOwnerIdMock } = vi.hoisted(() => ({
  getGoogleSessionMock: vi.fn(),
  deleteGoogleSessionMock: vi.fn(),
  getGoogleOwnerIdMock: vi.fn(),
}));

vi.mock("@/lib/google-session", async (original) => ({
  ...await original<typeof import("@/lib/google-session")>(),
  getGoogleSession: getGoogleSessionMock,
  deleteGoogleSession: deleteGoogleSessionMock,
}));

vi.mock("@/lib/google-auth", () => ({ getGoogleOwnerId: getGoogleOwnerIdMock }));

import { GET } from "@/app/api/auth/google/status/route";
import { GoogleSessionError } from "@/lib/google-session";

describe("GET /api/auth/google/status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks the access token with Google", async () => {
    getGoogleSessionMock.mockResolvedValue({ accessToken: "access", ownerId: "owner" });
    getGoogleOwnerIdMock.mockResolvedValue("owner");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: true });
    expect(getGoogleOwnerIdMock).toHaveBeenCalledWith("access");
  });

  it("requires reconnect and clears the cookie for an invalid session", async () => {
    getGoogleSessionMock.mockRejectedValue(new GoogleSessionError("expired"));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.reconnectRequired).toBe(true);
    expect(deleteGoogleSessionMock).toHaveBeenCalled();
    expect(response.cookies.get("google_session_id")?.value).toBe("");
  });

  it("reports a temporary failure without discarding the session", async () => {
    getGoogleSessionMock.mockResolvedValue({ accessToken: "access", ownerId: "owner" });
    getGoogleOwnerIdMock.mockRejectedValue(new Error("Google identity lookup failed: 500"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(deleteGoogleSessionMock).not.toHaveBeenCalled();
  });
});
