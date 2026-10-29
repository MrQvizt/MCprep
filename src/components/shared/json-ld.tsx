import { serializeJsonLd } from "@/lib/seo/jsonld";

export function JsonLd({ data }: { data: unknown }) {
  if (!data) return null;
  const items = Array.isArray(data) ? data.filter(Boolean) : [data];
  if (items.length === 0) return null;
  return (
    <script
      type="application/ld+json"
      // Content is escaped by serializeJsonLd (no "<", ">" or "&").
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(items.length === 1 ? items[0] : items) }}
    />
  );
}
