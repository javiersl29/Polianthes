import fs from "node:fs";
import path from "node:path";

export type Presentation = "10ml" | "30ml" | "60ml" | "100ml";

export type RawRow = {
  presentations: Presentation[];
  fragrance: string;
};

const PRESENTATIONS: Presentation[] = ["10ml", "30ml", "60ml", "100ml"];

function parseRow(line: string): RawRow {
  const cells = line.split(",");
  const presentations: Presentation[] = [];
  for (const cell of cells) {
    const trimmed = cell.trim();
    if (PRESENTATIONS.includes(trimmed as Presentation)) {
      presentations.push(trimmed as Presentation);
    }
  }
  const fragrance = cells[cells.length - 1]?.trim() ?? "";
  return { presentations, fragrance };
}

let cache: RawRow[] | null = null;

export function loadCatalog(): RawRow[] {
  if (cache) return cache;
  const csvPath = path.join(process.cwd(), "data", "catalog.csv");
  const text = fs.readFileSync(csvPath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const dataLines = lines.slice(1);
  cache = dataLines.map(parseRow).filter((r) => r.fragrance.length > 0);
  return cache;
}

export function splitBrand(name: string): { brand: string; name: string } {
  const idx = name.indexOf(" - ");
  if (idx === -1) return { brand: "Independiente", name };
  return { brand: name.slice(0, idx).trim(), name: name.slice(idx + 3).trim() };
}
