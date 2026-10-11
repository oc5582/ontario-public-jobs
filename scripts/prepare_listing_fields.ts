// Normalize location and choose the posting date for one import.
// stdin: JSON array of { location, description, firstCollected, closing, fields }
// stdout: JSON array of { location, cities, employerPosted, datePosted, validThrough }
//
//   node --experimental-strip-types scripts/prepare_listing_fields.ts

import { displayPostedDate, employerPostingDate, validThrough } from "../web/lib/dates.ts";
import { locationCities, normalizeLocation } from "../web/lib/location.ts";

type Input = {
  location?: string;
  description?: string;
  firstCollected?: string;
  closing?: string;
  fields?: Record<string, string | null | undefined>;
};

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

const raw = await readStdin();
const jobs = JSON.parse(raw) as Input[];
if (!Array.isArray(jobs)) {
  console.error("expected a JSON array");
  process.exit(1);
}

const prepared = jobs.map((job) => {
  const fields = job.fields || {};
  const description = job.description || "";
  const employerPosted = employerPostingDate({ description, fields });
  return {
    location: normalizeLocation(job.location || ""),
    cities: locationCities(job.location || ""),
    employerPosted,
    datePosted: displayPostedDate({
      employerPosted,
      description,
      fields,
      firstCollected: job.firstCollected || "",
    }),
    validThrough: validThrough(job.closing || ""),
  };
});

process.stdout.write(JSON.stringify(prepared));
