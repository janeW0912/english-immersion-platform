import mammoth from "mammoth";

function normalizeWhitespace(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

export async function parseDocxToPlain(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return normalizeWhitespace(value || "");
}

export async function parsePdfToPlain(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default as unknown as (
    dataBuffer: Buffer,
  ) => Promise<{ text: string }>;
  const data = await pdfParse(buffer);
  return normalizeWhitespace(data.text || "");
}
