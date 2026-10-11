/** A Place from jobs.location_places, as stored by the importer. */
type PostalPlace = {
  address?: {
    addressLocality?: unknown;
    addressRegion?: unknown;
  };
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asPlaces(value: unknown): PostalPlace[] {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is PostalPlace => !!item && typeof item === "object");
}

/**
 * "City, ON" from location_places. Several places are joined with "; ".
 * An empty or unparseable list falls back to the raw location string.
 */
export function displayLocation(raw: string, places: unknown): string {
  const labels: string[] = [];
  for (const place of asPlaces(places)) {
    const locality = text(place.address?.addressLocality);
    const region = text(place.address?.addressRegion);
    const label = [locality, region].filter(Boolean).join(", ");
    if (label && !labels.includes(label)) labels.push(label);
  }
  if (labels.length === 0) return raw || "";
  return labels.join("; ");
}
