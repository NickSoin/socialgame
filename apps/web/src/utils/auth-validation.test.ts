import { describe, expect, test } from "vitest";

import { PASSWORD_MIN_LENGTH, passwordSchema } from "./auth-validation";

describe("passwordSchema", () => {
  test("requires at least eight characters", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
  });
});
