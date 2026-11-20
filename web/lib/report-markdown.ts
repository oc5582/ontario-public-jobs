export type ReportBlock =
  | { type: "heading"; level: 2 | 3; text: string; id: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][]; captionId: string }
  | { type: "downloads" }
  | { type: "faq"; lead: string };

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "section";
}

function headingText(line: string): { level: number; text: string } | null {
  const match = /^(#{1,3})\s+(.*)$/.exec(line.trim());
  if (!match) return null;
  return { level: match[1].length, text: match[2].trim() };
}

function isQuestions(text: string): boolean {
  return text.toLowerCase() === "questions and answers";
}

function isMethodology(text: string): boolean {
  return text.toLowerCase().startsWith("methodology");
}

function isDownloads(text: string): boolean {
  return text.toLowerCase() === "downloads";
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}/.test(line.trim()) && !/[a-z0-9]/i.test(line);
}

function parseTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  const rows = lines.filter((line) => !isSeparator(line)).map(splitRow);
  if (rows.length < 2) return null;
  const headers = rows[0];
  const body = rows.slice(1).filter((row) => row.some(Boolean));
  return { headers, rows: body };
}

/** First paragraph under the markdown Q&A heading, before the questions. */
export function faqLeadFromMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let inFaq = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const heading = headingText(trimmed);
    if (heading?.level === 2 && isQuestions(heading.text)) {
      inFaq = true;
      continue;
    }
    if (inFaq && heading?.level === 2) break;
    if (!inFaq || !trimmed || trimmed.startsWith("#")) continue;
    const parts = [trimmed];
    i += 1;
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("#")) {
      parts.push(lines[i].trim());
      i += 1;
    }
    return parts.join(" ");
  }
  return "";
}

/**
 * Turns the report markdown into blocks.
 * The questions section is not taken from the markdown: the page renders it
 * from the snapshot `faq` array, and this inserts that block before methodology.
 */
export function parseReportMarkdown(markdown: string, options: { hasFaq: boolean }): ReportBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReportBlock[] = [];
  const usedIds = new Set<string>();
  const lead = options.hasFaq ? faqLeadFromMarkdown(markdown) : "";
  let started = false;
  let insertedFaq = false;
  let lastHeadingId = "";
  let i = 0;

  function nextId(text: string): string {
    const base = slugify(text);
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    usedIds.add(id);
    return id;
  }

  function pushFaq() {
    if (!options.hasFaq || insertedFaq) return;
    blocks.push({ type: "faq", lead });
    insertedFaq = true;
  }

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i += 1;
      continue;
    }
    const heading = headingText(trimmed);
    if (heading) {
      if (heading.level === 1) {
        i += 1;
        continue;
      }
      started = true;
      if (isQuestions(heading.text)) {
        i += 1;
        while (i < lines.length && !/^##\s+/.test(lines[i].trim())) i += 1;
        continue;
      }
      if (isDownloads(heading.text)) {
        pushFaq();
        blocks.push({ type: "downloads" });
        i += 1;
        while (i < lines.length && !/^##\s+/.test(lines[i].trim())) i += 1;
        continue;
      }
      if (isMethodology(heading.text)) pushFaq();
      const id = nextId(heading.text);
      lastHeadingId = id;
      blocks.push({ type: "heading", level: heading.level === 3 ? 3 : 2, text: heading.text, id });
      i += 1;
      continue;
    }
    if (!started) {
      i += 1;
      continue;
    }
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i += 1;
      }
      const table = parseTable(tableLines);
      if (table) blocks.push({ type: "table", ...table, captionId: lastHeadingId });
      continue;
    }
    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2).trim());
        i += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }
    const parts: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith("- ") &&
      !headingText(lines[i].trim())
    ) {
      parts.push(lines[i].trim());
      i += 1;
    }
    const text = parts.join(" ");
    if (/^license:/i.test(text) || /^source:/i.test(text)) continue;
    blocks.push({ type: "paragraph", text });
  }
  pushFaq();
  return blocks;
}
