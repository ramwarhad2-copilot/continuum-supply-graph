import type { SupplyNetworkRepository } from "@/domain/ports/supply-network-repository";
import type {
  AlternateRoute,
  Facility,
  HealthStatus,
  ImpactAnalysis,
  ImpactedClinic,
  MedicineExposure,
  NetworkOverview,
  Route,
} from "@/domain/supply-network";
import { assessRisk, resilienceScore, riskRank } from "@/domain/services/impact-policy";
import { seedData, type SupplyNetworkSeed } from "@/infrastructure/demo/seed-data";

interface GraphPath {
  facilities: Facility[];
  routes: Route[];
}

export class DemoSupplyNetworkRepository implements SupplyNetworkRepository {
  constructor(private readonly data: SupplyNetworkSeed = seedData) {}

  async getOverview(): Promise<NetworkOverview> {
    const clinics = this.data.facilities.filter((facility) => facility.kind === "clinic");
    return {
      facilities: this.data.facilities,
      medicines: this.data.medicines,
      routes: this.data.routes,
      stats: {
        facilities: this.data.facilities.length,
        clinics: clinics.length,
        medicines: this.data.medicines.length,
        routes: this.data.routes.length,
        patientsCovered: clinics.reduce((total, clinic) => total + clinic.capacity, 0),
      },
      lastUpdated: new Date().toISOString(),
      source: "demo",
    };
  }

  async analyzeDisruption(facilityId: string): Promise<ImpactAnalysis | null> {
    const disruptedFacility = this.facility(facilityId);
    if (!disruptedFacility || disruptedFacility.kind === "clinic") return null;

    const shortestPaths = this.downstreamClinicPaths(facilityId);
    const producedMedicineIds = new Set(
      this.data.production
        .filter((item) => item.facilityId === facilityId)
        .map((item) => item.medicineId),
    );
    const alternatives: AlternateRoute[] = [];

    const clinics = [...shortestPaths.values()].map((graphPath) => {
      const clinic = graphPath.facilities.at(-1)!;
      const medicines = this.exposedMedicines(clinic.id, producedMedicineIds);

      for (const medicine of medicines) {
        alternatives.push(...this.findAlternatives(clinic, medicine, facilityId));
      }

      const clinicAlternatives = alternatives.filter((item) => item.clinicId === clinic.id);
      const alternateCount = new Set(
        clinicAlternatives.map((item) => `${item.medicineId}:${item.supplierName}`),
      ).size;

      return {
        clinic,
        path: graphPath.facilities,
        pathRouteIds: graphPath.routes.map((route) => route.id),
        leadTimeHours: sumLeadTime(graphPath.routes),
        medicines,
        alternateCount,
        risk: assessRisk(medicines, alternateCount),
      } satisfies ImpactedClinic;
    });

    clinics.sort((a, b) => riskRank(a.risk) - riskRank(b.risk) || b.clinic.capacity - a.clinic.capacity);
    alternatives.sort((a, b) => b.reliability - a.reliability || a.leadTimeHours - b.leadTimeHours);

    const coveredMedicineIds = new Set(alternatives.map((item) => `${item.clinicId}:${item.medicineId}`));
    const demandPairs = new Set(
      clinics.flatMap((clinic) => clinic.medicines.map((item) => `${clinic.clinic.id}:${item.id}`)),
    );
    const score = resilienceScore(demandPairs, coveredMedicineIds);

    return {
      disruptedFacility,
      summary: {
        affectedClinics: clinics.length,
        patientsAtRisk: clinics.reduce((total, clinic) => total + clinic.clinic.capacity, 0),
        essentialMedicines: new Set(
          clinics.flatMap((clinic) =>
            clinic.medicines
              .filter((medicine) => medicine.criticality === "essential")
              .map((medicine) => medicine.id),
          ),
        ).size,
        routesAtRisk: new Set(clinics.flatMap((clinic) => clinic.pathRouteIds)).size,
        resilienceScore: score,
      },
      clinics,
      alternatives,
      generatedAt: new Date().toISOString(),
    };
  }

  async getHealth(): Promise<HealthStatus> {
    return { status: "available", source: "demo", latencyMs: 1 };
  }

  private exposedMedicines(clinicId: string, producedMedicineIds: Set<string>): MedicineExposure[] {
    const filterByProduction = producedMedicineIds.size > 0;
    return this.data.needs
      .filter(
        (need) =>
          need.clinicId === clinicId &&
          (!filterByProduction || producedMedicineIds.has(need.medicineId)),
      )
      .map((need) => ({
        id: need.medicineId,
        name: this.data.medicines.find((medicine) => medicine.id === need.medicineId)!.name,
        criticality: need.criticality,
        weeklyUnits: need.weeklyUnits,
      }));
  }

  private findAlternatives(
    clinic: Facility,
    medicine: MedicineExposure,
    excludedFacilityId: string,
  ): AlternateRoute[] {
    return this.data.production
      .filter(
        (production) =>
          production.medicineId === medicine.id && production.facilityId !== excludedFacilityId,
      )
      .flatMap((production) => {
        const path = this.shortestPath(production.facilityId, clinic.id, excludedFacilityId);
        const supplier = this.facility(production.facilityId);
        if (!path || !supplier) return [];

        return [
          {
            clinicId: clinic.id,
            clinicName: clinic.name,
            medicineId: medicine.id,
            medicineName: medicine.name,
            supplierName: supplier.name,
            path: path.facilities,
            leadTimeHours: sumLeadTime(path.routes),
            reliability: path.routes.reduce(
              (score, route) => score * route.reliability,
              1,
            ),
          },
        ];
      });
  }

  private downstreamClinicPaths(sourceId: string): Map<string, GraphPath> {
    const paths = new Map<string, GraphPath>();
    for (const clinic of this.data.facilities.filter((item) => item.kind === "clinic")) {
      const path = this.shortestPath(sourceId, clinic.id);
      if (path) paths.set(clinic.id, path);
    }
    return paths;
  }

  private shortestPath(sourceId: string, targetId: string, excludedId?: string): GraphPath | null {
    if (sourceId === excludedId || targetId === excludedId) return null;
    const source = this.facility(sourceId);
    if (!source) return null;

    const queue: GraphPath[] = [{ facilities: [source], routes: [] }];
    const bestHopCount = new Map<string, number>([[sourceId, 0]]);
    let best: GraphPath | null = null;

    while (queue.length) {
      const current = queue.shift()!;
      const last = current.facilities.at(-1)!;
      if (current.routes.length > 4) continue;
      if (last.id === targetId) {
        if (!best || sumLeadTime(current.routes) < sumLeadTime(best.routes)) best = current;
        continue;
      }

      for (const route of this.data.routes.filter((item) => item.from === last.id)) {
        if (route.to === excludedId || current.facilities.some((item) => item.id === route.to)) continue;
        const nextFacility = this.facility(route.to);
        if (!nextFacility) continue;
        const nextHopCount = current.routes.length + 1;
        if ((bestHopCount.get(route.to) ?? Number.POSITIVE_INFINITY) < nextHopCount) continue;
        bestHopCount.set(route.to, nextHopCount);
        queue.push({
          facilities: [...current.facilities, nextFacility],
          routes: [...current.routes, route],
        });
      }
    }

    return best;
  }

  private facility(id: string): Facility | undefined {
    return this.data.facilities.find((facility) => facility.id === id);
  }
}

function sumLeadTime(routes: Route[]): number {
  return routes.reduce((total, route) => total + route.leadTimeHours, 0);
}
