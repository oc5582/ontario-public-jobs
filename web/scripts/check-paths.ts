import { spawnSync } from "child_process";
import path from "path";
import { loadJsonJobs } from "../lib/jobs";

const jobs = loadJsonJobs();
if (!jobs) {
  console.error("listings.json not found");
  process.exit(1);
}
const ours = new Set(jobs.map((job) => job.path));
const root = path.resolve(process.cwd(), "..");
const py = spawnSync(
  "python3",
  [
    "-c",
    `
import json, sys
sys.path.insert(0, "scripts")
import build_pages as bp
raw = json.load(open("data/listings.json"))
raw = [job for job in raw if not bp.is_excluded_job(job)]
jobs = bp.sort_jobs(raw)
bp.assign_paths(jobs)
print("\\n".join(job["_path"] for job in jobs))
`,
  ],
  { cwd: root, encoding: "utf8" },
);
if (py.status !== 0) {
  console.error(py.stderr);
  process.exit(py.status ?? 1);
}
const expected = py.stdout.trim().split("\n").filter(Boolean);
const missing = expected.filter((item) => !ours.has(item));
const extra = [...ours].filter((item) => !expected.includes(item));
console.log(`expected ${expected.length} ours ${ours.size} missing ${missing.length} extra ${extra.length}`);
if (missing.length || extra.length) {
  console.log("missing", missing.slice(0, 8));
  console.log("extra", extra.slice(0, 8));
  process.exit(1);
}
console.log("paths match build_pages.py");
