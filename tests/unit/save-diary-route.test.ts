import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSubjectAccountMock } = vi.hoisted(() => ({
  getSubjectAccountMock: vi.fn(),
}));

vi.mock("@/lib/subject-account", async (original) => ({
  ...await original<typeof import("@/lib/subject-account")>(),
  getSubjectAccount: getSubjectAccountMock,
}));

import { POST } from "@/app/api/save-diary/route";

describe("POST /api/save-diary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when google token cookie is missing", async () => {
    getSubjectAccountMock.mockRejectedValue(new (await import("@/lib/subject-account")).SubjectAccountError("Connect Google Photos", 401));

    const response = await POST(new Request("http://localhost/api/save-diary", { method: "POST" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain("Connect Google Photos");
  });

  it("returns 400 when photo field is missing", async () => {
    getSubjectAccountMock.mockResolvedValue({ accessToken: "token", ownerId: "owner", supabase: {} });

    const formData = new FormData();
    formData.set("subjectName", "大宝");
    formData.set("diaryText", "今天开心");
    formData.set("textPosition", "bottom");
    formData.set("albumTitle", "1PicDiary");

    const response = await POST(
      new Request("http://localhost/api/save-diary", {
        method: "POST",
        body: formData,
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("photo is required");
  });
});
