import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSubjectAccountMock } = vi.hoisted(() => ({
  getSubjectAccountMock: vi.fn(),
}));

vi.mock("@/lib/subject-account", async (original) => ({
  ...await original<typeof import("@/lib/subject-account")>(),
  getSubjectAccount: getSubjectAccountMock,
}));

import { DELETE } from "@/app/api/subjects/[id]/route";

const subjectId = "00000000-0000-4000-8000-000000000001";

function deleteQuery(result: { data: unknown; error: unknown }) {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.delete.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
}

function request(origin = "http://localhost") {
  return new Request(`http://localhost/api/subjects/${subjectId}`, {
    method: "DELETE",
    headers: { origin },
  });
}

beforeEach(() => vi.clearAllMocks());

describe("DELETE /api/subjects/[id]", () => {
  it("deletes only a subject owned by the connected Google account", async () => {
    const query = deleteQuery({ data: { id: subjectId }, error: null });
    getSubjectAccountMock.mockResolvedValue({
      ownerId: "google-owner",
      supabase: { from: vi.fn().mockReturnValue(query) },
    });

    const response = await DELETE(request(), { params: Promise.resolve({ id: subjectId }) });

    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith("id", subjectId);
    expect(query.eq).toHaveBeenCalledWith("google_owner_id", "google-owner");
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("returns 404 when the subject is not owned by the account", async () => {
    const query = deleteQuery({ data: null, error: null });
    getSubjectAccountMock.mockResolvedValue({
      ownerId: "another-owner",
      supabase: { from: vi.fn().mockReturnValue(query) },
    });

    const response = await DELETE(request(), { params: Promise.resolve({ id: subjectId }) });

    expect(response.status).toBe(404);
  });

  it("rejects a cross-site deletion before loading the account", async () => {
    const response = await DELETE(request("https://attacker.example"), {
      params: Promise.resolve({ id: subjectId }),
    });

    expect(response.status).toBe(403);
    expect(getSubjectAccountMock).not.toHaveBeenCalled();
  });
});
