import { jsonLdScript } from "@/lib/jsonld";

export function JsonLd({ data }: { data: unknown }) {
  if (!data) return null;
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
  );
}
