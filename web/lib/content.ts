import { readFileSync } from "fs";
import path from "path";

export function readContent(name: string): string {
  return readFileSync(path.join(process.cwd(), "content", name), "utf8");
}

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function faqEntities(html: string): { question: string; answer: string }[] {
  const entities: { question: string; answer: string }[] = [];
  const pattern = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
  for (const match of html.matchAll(pattern)) {
    entities.push({ question: stripTags(match[1]), answer: stripTags(match[2]) });
  }
  return entities;
}
