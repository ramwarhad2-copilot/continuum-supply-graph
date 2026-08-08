import { describe, expect, it } from "vitest";

import { DemoSupplyNetworkRepository } from "@/infrastructure/demo/demo-supply-network-repository";

describe("DemoSupplyNetworkRepository", () => {
  const repository = new DemoSupplyNetworkRepository();

  it("returns a connected network overview", async () => {
    const overview = await repository.getOverview();
    expect(overview.stats.facilities).toBe(14);
    expect(overview.stats.clinics).toBe(6);
    expect(overview.routes.length).toBeGreaterThan(15);
    expect(overview.stats.patientsCovered).toBe(13_010);
  });

  it("traverses multiple hops for a hub disruption", async () => {
    const analysis = await repository.analyzeDisruption("hub-sahyadri");
    expect(analysis).not.toBeNull();
    expect(analysis!.summary.affectedClinics).toBeGreaterThanOrEqual(4);
    expect(analysis!.clinics.some((clinic) => clinic.path.length >= 3)).toBe(true);
    expect(analysis!.alternatives.length).toBeGreaterThan(0);
  });

  it("limits manufacturer exposure to medicines it makes", async () => {
    const analysis = await repository.analyzeDisruption("medigen-pune");
    const exposed = new Set(analysis!.clinics.flatMap((clinic) => clinic.medicines.map((item) => item.id)));
    expect([...exposed].every((id) => ["insulin", "adrenaline"].includes(id))).toBe(true);
  });

  it("rejects a clinic as a disruption source", async () => {
    await expect(repository.analyzeDisruption("clinic-nashik")).resolves.toBeNull();
  });
});
