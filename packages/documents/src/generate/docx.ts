import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { Block } from "./blocks.js";

function blockToParagraph(block: Block): Paragraph {
  switch (block.type) {
    case "title":
      return new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: block.text, bold: true })] });
    case "subtitle":
      return new Paragraph({ children: [new TextRun({ text: block.text, italics: true })] });
    case "heading":
      return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: block.text, bold: true })] });
    case "bullet":
      return new Paragraph({ text: block.text, bullet: { level: 0 } });
    case "text":
      return new Paragraph({ text: block.text });
  }
}

/**
 * Render blocks to a .docx file's bytes. Single-column, standard headings, plain
 * bullets — deliberately ATS-friendly (DESIGN.md §8). Returns a plain Uint8Array.
 */
export async function blocksToDocx(blocks: Block[]): Promise<Uint8Array> {
  const doc = new Document({ sections: [{ children: blocks.map(blockToParagraph) }] });
  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
