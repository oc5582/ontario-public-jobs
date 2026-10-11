import { descriptionParagraphs, formatDescription } from "../web/lib/description.ts";
import { readFileSync } from "fs";

const texts = JSON.parse(readFileSync(0, "utf8")) as string[];
const formatted = texts.map((text) => ({
  html: formatDescription(text || ""),
  paragraphs: descriptionParagraphs(text || ""),
}));
process.stdout.write(JSON.stringify(formatted));
