"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_CHILDREN = ["大宝", "二宝"];
type TextPosition = "top" | "middle" | "bottom";

export default function Home() {
  const [childName, setChildName] = useState(DEFAULT_CHILDREN[0]);
  const [diaryText, setDiaryText] = useState("");
  const [albumTitle, setAlbumTitle] = useState("1PicDiary");
  const [textPosition, setTextPosition] = useState<TextPosition>("bottom");
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const sourcePreviewUrl = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo]
  );

  useEffect(() => {
    return () => {
      if (sourcePreviewUrl) {
        URL.revokeObjectURL(sourcePreviewUrl);
      }
    };
  }, [sourcePreviewUrl]);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl]
  );

  async function generatePreview() {
    if (!photo || !diaryText.trim()) {
      setStatus("请先上传照片并输入一句日记。");
      return;
    }

    setStatus("正在生成预览...");
    const formData = new FormData();
    formData.set("photo", photo);
    formData.set("childName", childName);
    formData.set("diaryText", diaryText);
    formData.set("textPosition", textPosition);

    const response = await fetch("/api/compose", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setStatus(payload.error ?? "预览失败");
      return;
    }

    const blob = await response.blob();
    const nextPreviewUrl = URL.createObjectURL(blob);
    setPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return nextPreviewUrl;
    });
    setStatus("预览已生成。确认后可保存到 Google Photos。");
  }

  async function saveDiary() {
    if (!photo || !diaryText.trim()) {
      setStatus("请先上传照片并输入一句日记。");
      return;
    }

    setSaving(true);
    setStatus("正在保存到 Google Photos...");

    const formData = new FormData();
    formData.set("photo", photo);
    formData.set("childName", childName);
    formData.set("diaryText", diaryText);
    formData.set("textPosition", textPosition);
    formData.set("albumTitle", albumTitle);

    const response = await fetch("/api/save-diary", {
      method: "POST",
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus(payload.error ?? "保存失败");
      setSaving(false);
      return;
    }

    const warnings = payload.warnings?.length
      ? `（附加提示：${payload.warnings.join("；")}）`
      : "";
    setStatus(`保存成功，MediaItemId: ${payload.mediaItemId ?? "N/A"}${warnings}`);
    setSaving(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">1PicDiary</h1>
      <p className="text-sm text-gray-600">
        选择孩子、上传一张照片、输入一句日记、调整文字位置，预览后保存到 Google Photos App Album。
      </p>

      <div className="grid gap-3 rounded-lg border border-gray-200 p-4">
        <label className="text-sm font-medium">Google 连接</label>
        <a className="text-sm text-blue-600 underline" href="/api/auth/google/start">
          连接 Google Photos
        </a>
      </div>

      <div className="grid gap-3 rounded-lg border border-gray-200 p-4">
        <label className="text-sm font-medium">孩子</label>
        <select
          className="h-9 rounded-md border border-gray-300 px-3"
          value={childName}
          onChange={(event) => setChildName(event.target.value)}
        >
          {DEFAULT_CHILDREN.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <label className="text-sm font-medium">照片</label>
        <Input
          type="file"
          accept="image/*"
          onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
        />

        <label className="text-sm font-medium">一句日记</label>
        <Textarea
          value={diaryText}
          onChange={(event) => setDiaryText(event.target.value)}
          maxLength={80}
          placeholder="例如：今天和妹妹一起搭积木，笑得很开心。"
        />

        <label className="text-sm font-medium">文字位置</label>
        <select
          className="h-9 rounded-md border border-gray-300 px-3"
          value={textPosition}
          onChange={(event) => setTextPosition(event.target.value as TextPosition)}
        >
          <option value="top">上方</option>
          <option value="middle">中间</option>
          <option value="bottom">下方</option>
        </select>

        <label className="text-sm font-medium">Google Photos Album 标题</label>
        <Input value={albumTitle} onChange={(event) => setAlbumTitle(event.target.value)} />

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={generatePreview}>
            预览合成图
          </Button>
          <Button type="button" onClick={saveDiary} disabled={saving}>
            {saving ? "保存中..." : "保存到 Google Photos"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium">预览</h2>
        {sourcePreviewUrl ? (
          <Image
            src={sourcePreviewUrl}
            alt="原图预览"
            width={800}
            height={800}
            unoptimized
            className="max-h-96 w-auto rounded-md object-contain"
          />
        ) : (
          <p className="text-sm text-gray-500">尚未选择图片</p>
        )}
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="合成图预览"
            width={800}
            height={800}
            unoptimized
            className="max-h-96 w-auto rounded-md object-contain"
          />
        ) : (
          <p className="text-sm text-gray-500">尚未生成合成预览</p>
        )}
      </div>

      {status ? <p className="text-sm text-gray-700">{status}</p> : null}
    </main>
  );
}
