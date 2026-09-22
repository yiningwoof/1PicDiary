import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { POST } from "@/app/api/save-diary/route";

describe("POST /api/save-diary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when google token cookie is missing", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn(() => undefined) });

    const response = await POST(new Request("http://localhost/api/save-diary", { method: "POST" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain("Google OAuth required");
  });

  it("returns 400 when photo field is missing", async () => {
    cookiesMock.mockResolvedValue({ get: vi.fn(() => ({ value: "token" })) });

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
