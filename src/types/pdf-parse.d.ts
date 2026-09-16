declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
    numpages?: number;
    info?: unknown;
  }

  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}
