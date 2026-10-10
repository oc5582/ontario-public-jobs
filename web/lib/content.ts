import fs from "fs";
import path from "path";

export function readContent(name: string): string {
  return fs.readFileSync(path.join(process.cwd(), "content", name), "utf8");
}
