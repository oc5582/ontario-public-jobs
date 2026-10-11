import { englishList } from "./format";

/** Employers named in the homepage sentence, in display order. */
export const FEATURED_EMPLOYERS = [
  { name: "City of Toronto", label: "the City of Toronto" },
  { name: "Toronto Transit Commission", label: "TTC" },
  { name: "Metrolinx", label: "Metrolinx" },
  { name: "Toronto Hydro Corporation", label: "Toronto Hydro" },
  { name: "Ontario Lottery and Gaming Corporation (OLG)", label: "OLG" },
] as const;

export const HOME_TITLE = "Government Jobs in Toronto & the GTA – Updated Daily | PublicJobs.ca";
export const H1 = "Government jobs in Toronto and the GTA";

function otherEmployers(count: number): string {
  if (count === 1) return "1 other GTA public employer";
  return `${count} other GTA public employers`;
}

/** Homepage description and subhead. The count is the number of employers in the data. */
export function homeCopy(employerCount: number, names: string[]): { description: string; subhead: string } {
  const present = new Set(names);
  const labels = FEATURED_EMPLOYERS.filter((item) => present.has(item.name)).map((item) => item.label);
  const others = Math.max(0, employerCount - labels.length);
  let series = "";
  if (labels.length && others > 0) series = `${labels.join(", ")} and ${otherEmployers(others)}`;
  else if (labels.length) series = englishList([...labels]);
  else if (others > 0) series = otherEmployers(others);
  else series = "GTA public employers";
  const subhead = `${series.charAt(0).toUpperCase()}${series.slice(1)}.`;
  return {
    description: `Current openings at ${series}, collected every weekday. Apply free on each employer's site.`,
    subhead,
  };
}
