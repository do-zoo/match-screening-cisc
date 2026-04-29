import { describe, expect, test } from "vitest";
import { retry } from "@/lib/uploads/retry";

describe("uploads: retry", () => {
  test("retries until success", async () => {
    let attempts = 0;
    const result = await retry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("fail");
        return "ok";
      },
      { maxAttempts: 3 },
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  test("throws last error after max attempts", async () => {
    let attempts = 0;
    await expect(
      retry(
        async () => {
          attempts++;
          throw new Error("nope");
        },
        { maxAttempts: 2 },
      ),
    ).rejects.toThrow("nope");
    expect(attempts).toBe(2);
  });
});
