import { describe, expect, it } from "vitest";

import { isAllowedEventDescriptionImageSrc } from "@/lib/public/event-description-image-src";
import { sanitizePublicEventDescriptionHtml } from "@/lib/public/sanitize-event-description";

describe("isAllowedEventDescriptionImageSrc", () => {
  it("menerima URL Blob Vercel publik HTTPS", () => {
    expect(
      isAllowedEventDescriptionImageSrc(
        "https://abc123.public.blob.vercel-storage.com/events/x/description/y.webp",
      ),
    ).toBe(true);
  });

  it("menolak host non-Blob", () => {
    expect(isAllowedEventDescriptionImageSrc("https://evil.com/x.png")).toBe(
      false,
    );
  });

  it("menolak http", () => {
    expect(
      isAllowedEventDescriptionImageSrc(
        "http://abc.public.blob.vercel-storage.com/x.webp",
      ),
    ).toBe(false);
  });
});

describe("sanitizePublicEventDescriptionHtml", () => {
  it("mempertahankan img dengan src Blob yang diizinkan", () => {
    const src =
      "https://abc123.public.blob.vercel-storage.com/events/e/d/1.webp";
    const out = sanitizePublicEventDescriptionHtml(
      `<p><img src="${src}" alt="x" /></p>`,
    );
    expect(out).toContain(src);
    expect(out).toContain("<img");
  });

  it("menghapus img dengan src berbahaya", () => {
    const out = sanitizePublicEventDescriptionHtml(
      `<p><img src="https://evil.com/x.png" alt="x" /></p>`,
    );
    expect(out).not.toContain("evil.com");
  });

  it("mengizinkan hr", () => {
    const out = sanitizePublicEventDescriptionHtml("<p>a</p><hr /><p>b</p>");
    expect(out).toContain("<hr");
  });
});
