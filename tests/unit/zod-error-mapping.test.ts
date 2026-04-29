import { describe, expect, test } from "vitest";
import { z } from "zod";
import { zodToFieldErrors } from "@/lib/forms/zod";

describe("forms: zodToFieldErrors", () => {
  test("maps nested zod issues to dot-path keys", () => {
    const S = z.object({
      contact: z.object({
        name: z.string().min(1, "Required"),
      }),
    });

    const res = S.safeParse({ contact: { name: "" } });
    if (res.success) throw new Error("expected failure");

    expect(zodToFieldErrors(res.error)).toEqual({
      "contact.name": "Required",
    });
  });
});
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { zodToFieldErrors } from "@/lib/forms/zod";

describe("forms: zodToFieldErrors", () => {
  test("maps nested zod issues to dot-path keys", () => {
    const S = z.object({
      contact: z.object({
        name: z.string().min(1, "Required"),
      }),
    });

    const res = S.safeParse({ contact: { name: "" } });
    if (res.success) throw new Error("expected failure");

    expect(zodToFieldErrors(res.error)).toEqual({
      "contact.name": "Required",
    });
  });
});

