import raw from "../data/employers.json";

export type EmployerLevel = "municipal" | "provincial" | "federal" | "agency";

const LEVELS = new Set<EmployerLevel>(["municipal", "provincial", "federal", "agency"]);

const LEVEL_LABEL: Record<EmployerLevel, string> = {
  municipal: "Municipal",
  provincial: "Provincial",
  federal: "Federal",
  agency: "Agency",
};

type Row = { level?: string; intro?: string };

const data = raw as Record<string, Row>;

export function employerProfile(slug: string): { level: EmployerLevel | ""; intro: string } {
  const row = data[slug];
  if (!row) return { level: "", intro: "" };
  const level = LEVELS.has(row.level as EmployerLevel) ? (row.level as EmployerLevel) : "";
  return { level, intro: (row.intro || "").trim() };
}

export function governmentLevelLabel(level: string): string {
  return LEVEL_LABEL[level as EmployerLevel] || "";
}
