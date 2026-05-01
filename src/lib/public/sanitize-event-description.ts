import DOMPurify from "isomorphic-dompurify";

export function sanitizePublicEventDescriptionHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "a",
      "h2",
      "h3",
      "h4",
      "blockquote",
      "div",
      "span",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}
