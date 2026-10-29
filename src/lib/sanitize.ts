import sanitizeHtml from "sanitize-html";

/**
 * Sanitise rich text (blog posts, legal pages, landing pages). Applied both
 * when saving and when rendering. Scripts, styles, iframes, event handlers and
 * javascript: URLs are removed.
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li",
      "blockquote", "br", "hr", "img", "code", "pre", "figure", "figcaption", "span",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height", "title"],
      span: [],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const external = /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: {
            ...attribs,
            ...(external ? { target: "_blank", rel: "noopener noreferrer" } : { rel: attribs.rel ?? "" }),
          },
        };
      },
      b: "strong",
      i: "em",
    },
  });
}

/** Plain text from HTML (for excerpts, word counts and SEO checks). */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}

export function wordCount(html: string): number {
  const text = htmlToText(html);
  return text ? text.split(" ").length : 0;
}

/** Internal links (href starting with "/") found in HTML. */
export function extractInternalLinks(html: string): string[] {
  const links = new Set<string>();
  const re = /href\s*=\s*"([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (href.startsWith("/") && !href.startsWith("//")) links.add(href.split("#")[0].split("?")[0] || "/");
  }
  return [...links];
}
