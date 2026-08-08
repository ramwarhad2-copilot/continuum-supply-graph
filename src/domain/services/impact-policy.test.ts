import { describe, expect, it } from "vitest";

import { assessRisk, resilienceScore } from "@/domain/services/impact-policy";

describe("impact policy", () => {
  it("marks an essential medicine with no alternative as critical", () => {
    expect(
      assessRisk(
        [{ id: "insulin", name: "Insulin", criticality: "essential", weeklyUnits: 100 }],
        0,
      ),
    ).toBe("critical");
  });

  it("calculates resilience from protected demand pairs", () => {
    expect(
      resilienceScore(
        new Set(["clinic-a:insulin", "clinic-a:ors", "clinic-b:insulin"]),
        new Set(["clinic-a:insulin", "clinic-b:insulin"]),
      ),
    ).toBe(67);
  });
});
