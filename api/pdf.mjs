import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"POST only" });
  try {
    const { title = "Weavers Nest Transcript", transcript = [], pkg = "" } = req.body || {};
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 40;
    let x = margin, y = page.getHeight() - margin;
    const lineHeight = 14;

    function drawText(text, isBold=false) {
      const chunks = splitText(text, 70);
      for (const ch of chunks) {
        if (y < margin + 60) { // new page
          const p = pdfDoc.addPage([595.28, 841.89]);
          y = p.getHeight() - margin;
          x = margin;
          p.setFont(isBold ? fontBold : font);
          p.setFontSize(11);
          drawLine(p);
          pageRef = p;
        }
        page.drawText(ch, { x, y, size: 11, font: isBold ? fontBold : font, color: rgb(1,1,1) });
        y -= lineHeight;
      }
    }

    function drawLine(p) {
      p.drawLine({ start: { x: margin, y: y }, end: { x: p.getWidth()-margin, y: y }, thickness: 1, color: rgb(0.2,0.2,0.2) });
      y -= 10;
    }

    function splitText(t, maxChars) {
      const words = (t||"").split(/\s+/);
      const lines = [];
      let cur = "";
      for (const w of words) {
        if ((cur + " " + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; }
        else cur = (cur ? cur + " " : "") + w;
      }
      if (cur) lines.push(cur);
      return lines;
    }

    // Title
    page.drawText(title, { x, y, size: 16, font: fontBold, color: rgb(1,1,1) });
    y -= 22;
    drawLine(page);

    // Package
    if (pkg) {
      drawText("Custom Package", true);
      y -= 6;
      drawText(pkg);
      y -= 6;
      drawLine(page);
    }

    // Transcript
    drawText("Transcript", true);
    y -= 6;
    for (const item of transcript) {
      drawText(`[${item.ts}] ${item.role.toUpperCase()}: ${item.text}`);
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="weavers-nest-transcript.pdf"`);
    res.status(200).send(Buffer.from(pdfBytes));
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"Failed to build PDF" });
  }
}
