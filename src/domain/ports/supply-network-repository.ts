import type {
  HealthStatus,
  ImpactAnalysis,
  NetworkOverview,
} from "@/domain/supply-network";

export interface SupplyNetworkRepository {
  getOverview(): Promise<NetworkOverview>;
  analyzeDisruption(facilityId: string): Promise<ImpactAnalysis | null>;
  getHealth(): Promise<HealthStatus>;
}
