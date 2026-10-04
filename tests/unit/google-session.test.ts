import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  refresh: vi.fn(),
  getClient: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/google-auth", () => ({ refreshGoogleAccessToken: mocks.refresh }));
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: mocks.getClient }));

import { getGoogleSession } from "@/lib/google-session";
import { encryptGoogleToken } from "@/lib/token-crypto";

function databaseFor(row: Record<string, unknown>) {
  const selectQuery = {
    select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  };
  selectQuery.select.mockReturnValue(selectQuery);
  selectQuery.eq.mockReturnValue(selectQuery);
  const updateQuery = { update: vi.fn(), eq: vi.fn().mockResolvedValue({ error: null }) };
  updateQuery.update.mockReturnValue(updateQuery);
  const deleteQuery = { delete: vi.fn(), eq: vi.fn().mockResolvedValue({ error: null }) };
  deleteQuery.delete.mockReturnValue(deleteQuery);
  return {
    selectQuery, updateQuery,
    client: { from: vi.fn().mockReturnValueOnce(selectQuery).mockReturnValueOnce(updateQuery).mockReturnValue(deleteQuery) },
  };
}

describe("persistent Google session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "session-1" }) });
  });

  it("returns the encrypted access token without refreshing while it is valid", async () => {
    const db = databaseFor({
      id: "session-1", google_owner_id: "owner-1",
      access_token_ciphertext: encryptGoogleToken("access-1", "session-1:access"),
      refresh_token_ciphertext: encryptGoogleToken("refresh-1", "session-1:refresh"),
      access_token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      session_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    mocks.getClient.mockReturnValue(db.client);
    await expect(getGoogleSession()).resolves.toMatchObject({ accessToken: "access-1", ownerId: "owner-1" });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("uses the refresh token and stores a new encrypted access token after expiry", async () => {
    const db = databaseFor({
      id: "session-1", google_owner_id: "owner-1",
      access_token_ciphertext: encryptGoogleToken("expired-access", "session-1:access"),
      refresh_token_ciphertext: encryptGoogleToken("refresh-1", "session-1:refresh"),
      access_token_expires_at: new Date(Date.now() - 1_000).toISOString(),
      session_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    mocks.getClient.mockReturnValue(db.client);
    mocks.refresh.mockResolvedValue({ access_token: "access-2", expires_in: 3600 });
    await expect(getGoogleSession()).resolves.toMatchObject({ accessToken: "access-2", ownerId: "owner-1" });
    expect(mocks.refresh).toHaveBeenCalledWith("refresh-1");
    expect(db.updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      access_token_ciphertext: expect.not.stringContaining("access-2"),
      access_token_expires_at: expect.any(String),
      last_used_at: expect.any(String),
    }));
  });
});
