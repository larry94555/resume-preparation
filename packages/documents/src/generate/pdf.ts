import { type PDFFont, PDFDocument, StandardFonts } from "pdf-lib";
import type { Block } from "./blocks.js";

const PAGE: [number, number] = [612, 792]; // US Letter
const MARGIN = 54;
const MAX_WIDTH = PAGE[0] - MARGIN * 2;

/**
 * Map text to characters the standard (WinAnsi) PDF fonts can encode, so a stray
 * Unicode glyph in a resume never crashes generation. Common typography is
 * transliterated to ASCII; anything still unencodable becomes "?".
 */
function toPdfSafe(text: string): string {
  const mapped = text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/[•●·]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ");
  let out = "";
  for (const ch of mapped) {
    const c = ch.codePointAt(0) ?? 0;
    out += (c >= 0x20 && c <= 0x7e) || (c >= 0xa1 && c <= 0xff) ? ch : "?";
  }
  return out;
}

/** Render blocks to a single-column PDF's bytes with basic word wrapping. */
export async function blocksToPdf(blocks: Block[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage(PAGE);
  let y = PAGE[1] - MARGIN;

  const drawLine = (text: string, f: PDFFont, size: number, indent: number) => {
    if (y - size < MARGIN) {
      page = pdf.addPage(PAGE);
      y = PAGE[1] - MARGIN;
    }
    page.drawText(text, { x: MARGIN + indent, y: y - size, size, font: f });
    y -= size + 4;
  };

  const wrap = (text: string, f: PDFFont, size: number, indent: number) => {
    const words = toPdfSafe(text).split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (line && f.widthOfTextAtSize(trial, size) > MAX_WIDTH - indent) {
        drawLine(line, f, size, indent);
        line = w;
      } else {
        line = trial;
      }
    }
    if (line) drawLine(line, f, size, indent);
  };

  for (const b of blocks) {
    if (b.type === "title") wrap(b.text, bold, 18, 0);
    else if (b.type === "subtitle") wrap(b.text, font, 10, 0);
    else if (b.type === "heading") {
      y -= 6;
      wrap(b.text, bold, 13, 0);
    } else if (b.type === "bullet") wrap(`- ${b.text}`, font, 11, 14);
    else wrap(b.text, font, 11, 0);
  }

  return pdf.save();
}
