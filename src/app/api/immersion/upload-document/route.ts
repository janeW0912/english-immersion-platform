import { immersionRssBodyMaxChars } from "@/lib/immersion-body-limits";
import {
  pickFocusLine,
  truncate,
  truncateWithNewlines,
} from "@/lib/immersion-text";
import { parseDocxToPlain, parsePdfToPlain } from "@/lib/immersion-upload-parse";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function extFromFilename(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function truncatedPlain(text: string, max: number): string {
  const t = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  return truncateWithNewlines(t, max);
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file required" }, { status: 400 });
  }

  const name = file.name || "document";
  const ext = extFromFilename(name);

  if (!["pdf", "docx"].includes(ext)) {
    return Response.json(
      {
        error:
          "仅支持 .pdf 与 .docx。旧版 Word .doc 请在本地「另存为」docx 后再上传。",
      },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return Response.json({ error: "Empty file" }, { status: 400 });
  }
  if (buf.length > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: `文件过大（上限 ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB）` },
      { status: 400 },
    );
  }

  const maxChars = immersionRssBodyMaxChars();

  try {
    let plain =
      ext === "docx" ? await parseDocxToPlain(buf) : await parsePdfToPlain(buf);

    plain = plain.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
    if (!plain) {
      return Response.json(
        { error: "未能从文件中提取文字（可能是扫描版 PDF，需 OCR）" },
        { status: 422 },
      );
    }

    const title =
      name.replace(/\.(pdf|docx)$/i, "").slice(0, 180) || "Uploaded document";
    const body = truncatedPlain(plain, maxChars);
    const excerpt = truncate(body, 560);

    return Response.json({
      title,
      text: body,
      excerpt,
      focusLine: pickFocusLine(body),
      byteLength: buf.length,
      charCount: body.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "parse failed";
    return Response.json({ error: msg }, { status: 502 });
  }
}
