import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

export async function convertWebpToPdf(buffer: Buffer): Promise<Buffer> {
  // Convert WEBP → PNG
  const pngBuffer = await sharp(buffer).png().toBuffer();

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const image = await pdfDoc.embedPng(pngBuffer);

  const page = pdfDoc.addPage([image.width, image.height]);

  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });

  return Buffer.from(await pdfDoc.save());
}
