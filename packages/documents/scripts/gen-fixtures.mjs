// Regenerate the binary test fixtures (a small resume as .docx and .pdf) that
// the extractor integration tests read. Run from the package:
//   npm run gen-fixtures -w @resume-prep/documents
// The generated files are committed so the tests actually exercise the pdf/docx
// decoders in CI (no live model or network needed).

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "test", "fixtures");

const LINES = [
  "Jane Developer",
  "Software Engineer",
  "jane.developer@example.com",
  "Experience",
  "Senior Engineer, Acme Corp (2020 - Present)",
  "Built a distributed job scheduler in TypeScript.",
  "Skills: TypeScript, Node.js, Kubernetes",
];

async function makeDocx(path) {
  const doc = new Document({
    sections: [
      {
        children: LINES.map(
          (line) => new Paragraph({ children: [new TextRun(line)] }),
        ),
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  await writeFile(path, buffer);
}

async function makePdf(path) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let y = 740;
  for (const line of LINES) {
    page.drawText(line, { x: 50, y, size: 12, font });
    y -= 22;
  }
  const bytes = await pdf.save();
  await writeFile(path, bytes);
}

await mkdir(fixturesDir, { recursive: true });
await makeDocx(join(fixturesDir, "sample-resume.docx"));
await makePdf(join(fixturesDir, "sample-resume.pdf"));
console.log(`Wrote fixtures to ${fixturesDir}`);
