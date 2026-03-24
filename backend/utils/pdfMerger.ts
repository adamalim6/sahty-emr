import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

export async function mergeToPDF(files: { buffer: Buffer; mimeType: string }[]): Promise<Buffer> {
    const mergedPdf = await PDFDocument.create();

    for (const file of files) {
        if (file.mimeType === 'application/pdf') {
            const pdf = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        } else if (file.mimeType.startsWith('image/')) {
            // Convert to PNG via sharp to normalize everything (WEBP, JPG, TIFF, etc)
            const pngBuffer = await sharp(file.buffer).png().toBuffer();
            const image = await mergedPdf.embedPng(pngBuffer);
            const page = mergedPdf.addPage([image.width, image.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
        } else {
            throw new Error(`Unsupported mime_type for merging: ${file.mimeType}`);
        }
    }

    const mergedBytes = await mergedPdf.save();
    return Buffer.from(mergedBytes);
}
