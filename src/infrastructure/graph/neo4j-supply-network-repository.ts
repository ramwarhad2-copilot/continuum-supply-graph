import type { Node, Record as Neo4jRecord, Relationship } from "neo4j-driver";
import neo4j, { type Driver } from "neo4j-driver";

import type { SupplyNetworkRepository } from "@/domain/ports/supply-network-repository";
import { assessRisk, resilienceScore, riskRank } from "@/domain/services/impact-policy";
import type {
  AlternateRoute,
  Facility,
  FacilityKind,
  HealthStatus,
  ImpactAnalysis,
  ImpactedClinic,
  Medicine,
  MedicineExposure,
  NetworkOverview,
  Route,
} from "@/domain/supply-network";
import type { AppConfig } from "@/infrastructure/config/env";
import { DatabaseUnavailableError } from "@/lib/errors";
import { queries } from "@/infrastructure/graph/queries";

type CognoConfig = Extract<AppConfig, { dataSource: "cognodb" }>;

interface PathRecord {
  clinicId: string;
  path: Facility[];
  pathRouteIds: string[];
  leadTimeHours: number;
}

export class Neo4jSupplyNetworkRepository implements SupplyNetworkRepository {
  constructor(
    private readonly driver: Driver,
    private readonly config: CognoConfig,
  ) {}

  async getOverview(closeDriver = true): Promise<NetworkOverview> {
    try {
      const session = this.driver.session({
        database: this.config.database,
        defaultAccessMode: neo4j.session.READ,
      });

      try {
        const result = await session.executeRead(async (tx) => {
          const facilityResult = await tx.run(queries.facilities);
          const medicineResult = await tx.run(queries.medicines);
          const routeResult = await tx.run(queries.routes);
          return {
            facilities: facilityResult.records.map((record) => facilityFromNode(record.get("facility"))),
            medicines: medicineResult.records.map((record) => medicineFromNode(record.get("medicine"))),
            routes: routeResult.records.map(routeFromRecord),
          };
        });

        const clinics = result.facilities.filter((facility) => facility.kind === "clinic");
        return {
          ...result,
          stats: {
            facilities: result.facilities.length,
            clinics: clinics.length,
            medicines: result.medicines.length,
            routes: result.routes.length,
            patientsCovered: clinics.reduce((total, clinic) => total + clinic.capacity, 0),
          },
          lastUpdated: new Date().toISOString(),
          source: "cognodb",
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      throw new DatabaseUnavailableError({ cause: error });
    } finally {
      if (closeDriver) await this.driver.close();
    }
  }

  async analyzeDisruption(facilityId: string): Promise<ImpactAnalysis | null> {
    try {
      const overview = await this.getOverview(false);
      const disruptedFacility = overview.facilities.find((facility) => facility.id === facilityId);
      if (!disruptedFacility || disruptedFacility.kind === "clinic") return null;

      const session = this.driver.session({
        database: this.config.database,
        defaultAccessMode: neo4j.session.READ,
      });

      try {
        const queryData = await session.executeRead(async (tx) => {
          const pathResult = await tx.run(queries.impactPaths, { facilityId });
          const paths = shortestPaths(pathResult.records);
          const clinicIds = [...paths.keys()];
          if (!clinicIds.length) {
            return { paths, producedIds: new Set<string>(), needs: [], alternativeRecords: [] };
          }

          const productionResult = await tx.run(queries.producedMedicines, { facilityId });
          const needResult = await tx.run(queries.clinicNeeds, { clinicIds });
          const alternativeResult = await tx.run(queries.alternativePaths, {
            clinicIds,
            facilityId,
          });
          return {
            paths,
            producedIds: new Set<string>(
              productionResult.records.map((record) => String(record.get("medicineId"))),
            ),
            needs: needResult.records,
            alternativeRecords: alternativeResult.records,
          };
        });

        return buildImpactAnalysis(
          disruptedFacility,
          queryData.paths,
          queryData.producedIds,
          queryData.needs,
          queryData.alternativeRecords,
        );
      } finally {
        await session.close();
      }
    } catch (error) {
      if (error instanceof DatabaseUnavailableError) throw error;
      throw new DatabaseUnavailableError({ cause: error });
    } finally {
      await this.driver.close();
    }
  }

  async getHealth(): Promise<HealthStatus> {
    const startedAt = performance.now();
    try {
      await this.driver.verifyConnectivity({ database: this.config.database });
      return {
        status: "available",
        source: "cognodb",
        latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
      };
    } catch (error) {
      logDatabaseFailure("verifyConnectivity", error);
      throw new DatabaseUnavailableError({ cause: error });
    } finally {
      await this.driver.close();
    }
  }
}

function logDatabaseFailure(operation: string, error: unknown): void {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined;

  console.error("database_operation_failed", {
    operation,
    code,
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : "Non-error database failure",
  });
}

function shortestPaths(records: Neo4jRecord[]): Map<string, PathRecord> {
  const paths = new Map<string, PathRecord>();
  for (const record of records) {
    const clinicId = String(record.get("clinicId"));
    const candidate: PathRecord = {
      clinicId,
      path: (record.get("pathNodes") as Node[]).map(facilityFromNode),
      pathRouteIds: (record.get("pathRelationships") as Relationship[]).map((relationship) =>
        String(relationship.properties.id),
      ),
      leadTimeHours: asNumber(record.get("leadTimeHours")),
    };
    const current = paths.get(clinicId);
    if (!current || candidate.leadTimeHours < current.leadTimeHours) paths.set(clinicId, candidate);
  }
  return paths;
}

function buildImpactAnalysis(
  disruptedFacility: Facility,
  paths: Map<string, PathRecord>,
  producedIds: Set<string>,
  needRecords: Neo4jRecord[],
  alternativeRecords: Neo4jRecord[],
): ImpactAnalysis {
  const needsByClinic = new Map<string, MedicineExposure[]>();
  for (const record of needRecords) {
    const clinicId = String(record.get("clinicId"));
    const medicineId = String(record.get("medicineId"));
    if (producedIds.size && !producedIds.has(medicineId)) continue;
    const needs = needsByClinic.get(clinicId) ?? [];
    needs.push({
      id: medicineId,
      name: String(record.get("medicineName")),
      criticality: String(record.get("criticality")) as MedicineExposure["criticality"],
      weeklyUnits: asNumber(record.get("weeklyUnits")),
    });
    needsByClinic.set(clinicId, needs);
  }

  const exposedPairs = new Set(
    [...needsByClinic.entries()].flatMap(([clinicId, medicines]) =>
      medicines.map((medicine) => `${clinicId}:${medicine.id}`),
    ),
  );
  const alternatives = uniqueAlternatives(
    alternativeRecords
      .map(alternativeFromRecord)
      .filter(
        (item) =>
          exposedPairs.has(`${item.clinicId}:${item.medicineId}`) &&
          !item.path.some((facility) => facility.id === disruptedFacility.id),
      ),
  );

  const clinics: ImpactedClinic[] = [...paths.values()].map((path) => {
    const clinic = path.path.at(-1)!;
    const medicines = needsByClinic.get(clinic.id) ?? [];
    const alternateCount = new Set(
      alternatives
        .filter((item) => item.clinicId === clinic.id)
        .map((item) => `${item.medicineId}:${item.supplierName}`),
    ).size;
    return {
      clinic,
      path: path.path,
      pathRouteIds: path.pathRouteIds,
      leadTimeHours: path.leadTimeHours,
      medicines,
      alternateCount,
      risk: assessRisk(medicines, alternateCount),
    };
  });
  clinics.sort((a, b) => riskRank(a.risk) - riskRank(b.risk) || b.clinic.capacity - a.clinic.capacity);

  const coveredPairs = new Set(alternatives.map((item) => `${item.clinicId}:${item.medicineId}`));
  const essentialIds = new Set(
    clinics.flatMap((clinic) =>
      clinic.medicines
        .filter((medicine) => medicine.criticality === "essential")
        .map((medicine) => medicine.id),
    ),
  );

  return {
    disruptedFacility,
    summary: {
      affectedClinics: clinics.length,
      patientsAtRisk: clinics.reduce((total, item) => total + item.clinic.capacity, 0),
      essentialMedicines: essentialIds.size,
      routesAtRisk: new Set(clinics.flatMap((clinic) => clinic.pathRouteIds)).size,
      resilienceScore: resilienceScore(exposedPairs, coveredPairs),
    },
    clinics,
    alternatives,
    generatedAt: new Date().toISOString(),
  };
}

function uniqueAlternatives(items: AlternateRoute[]): AlternateRoute[] {
  const unique = new Map<string, AlternateRoute>();
  for (const item of items.sort(
    (a, b) => b.reliability - a.reliability || a.leadTimeHours - b.leadTimeHours,
  )) {
    const key = `${item.clinicId}:${item.medicineId}:${item.supplierName}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()];
}

function alternativeFromRecord(record: Neo4jRecord): AlternateRoute {
  return {
    clinicId: String(record.get("clinicId")),
    clinicName: String(record.get("clinicName")),
    medicineId: String(record.get("medicineId")),
    medicineName: String(record.get("medicineName")),
    supplierName: String(record.get("supplierName")),
    path: (record.get("pathNodes") as Node[]).map(facilityFromNode),
    leadTimeHours: asNumber(record.get("leadTimeHours")),
    reliability: asNumber(record.get("reliability")),
  };
}

function facilityFromNode(node: Node): Facility {
  const properties = node.properties;
  return {
    id: String(properties.id),
    name: String(properties.name),
    kind: String(properties.kind) as FacilityKind,
    city: String(properties.city),
    region: String(properties.region),
    country: String(properties.country),
    capacity: asNumber(properties.capacity),
    subtitle: String(properties.subtitle),
  };
}

function medicineFromNode(node: Node): Medicine {
  const properties = node.properties;
  return {
    id: String(properties.id),
    name: String(properties.name),
    category: String(properties.category),
    coldChain: Boolean(properties.coldChain),
  };
}

function routeFromRecord(record: Neo4jRecord): Route {
  const route = record.get("route") as Relationship;
  return {
    id: String(route.properties.id),
    from: String(record.get("originId")),
    to: String(record.get("destinationId")),
    leadTimeHours: asNumber(route.properties.leadTimeHours),
    reliability: asNumber(route.properties.reliability),
    mode: String(route.properties.mode) as Route["mode"],
  };
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (neo4j.isInt(value)) return value.toNumber();
  return Number(value);
}
