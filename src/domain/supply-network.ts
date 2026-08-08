export type FacilityKind = "supplier" | "manufacturer" | "hub" | "clinic";

export type RiskLevel = "critical" | "high" | "moderate" | "low";

export interface Facility {
  id: string;
  name: string;
  kind: FacilityKind;
  city: string;
  region: string;
  country: string;
  capacity: number;
  subtitle: string;
}

export interface Medicine {
  id: string;
  name: string;
  category: string;
  coldChain: boolean;
}

export interface Route {
  id: string;
  from: string;
  to: string;
  leadTimeHours: number;
  reliability: number;
  mode: "road" | "air" | "rail";
}

export interface Production {
  facilityId: string;
  medicineId: string;
  monthlyCapacity: number;
}

export interface Need {
  clinicId: string;
  medicineId: string;
  weeklyUnits: number;
  criticality: "essential" | "important";
}

export interface NetworkStats {
  facilities: number;
  clinics: number;
  medicines: number;
  routes: number;
  patientsCovered: number;
}

export interface NetworkOverview {
  facilities: Facility[];
  medicines: Medicine[];
  routes: Route[];
  stats: NetworkStats;
  lastUpdated: string;
  source: "demo" | "cognodb";
}

export interface MedicineExposure {
  id: string;
  name: string;
  criticality: "essential" | "important";
  weeklyUnits: number;
}

export interface ImpactedClinic {
  clinic: Facility;
  path: Facility[];
  pathRouteIds: string[];
  leadTimeHours: number;
  medicines: MedicineExposure[];
  risk: RiskLevel;
  alternateCount: number;
}

export interface AlternateRoute {
  clinicId: string;
  clinicName: string;
  medicineId: string;
  medicineName: string;
  supplierName: string;
  path: Facility[];
  leadTimeHours: number;
  reliability: number;
}

export interface ImpactSummary {
  affectedClinics: number;
  patientsAtRisk: number;
  essentialMedicines: number;
  routesAtRisk: number;
  resilienceScore: number;
}

export interface ImpactAnalysis {
  disruptedFacility: Facility;
  summary: ImpactSummary;
  clinics: ImpactedClinic[];
  alternatives: AlternateRoute[];
  generatedAt: string;
}

export interface HealthStatus {
  status: "available" | "unavailable";
  source: "demo" | "cognodb";
  latencyMs: number;
}
