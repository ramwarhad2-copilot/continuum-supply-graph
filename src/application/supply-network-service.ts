import type { SupplyNetworkRepository } from "@/domain/ports/supply-network-repository";
import type { ImpactAnalysis, NetworkOverview } from "@/domain/supply-network";
import { NotFoundError } from "@/lib/errors";

export class SupplyNetworkService {
  constructor(private readonly repository: SupplyNetworkRepository) {}

  getOverview(): Promise<NetworkOverview> {
    return this.repository.getOverview();
  }

  async analyzeDisruption(facilityId: string): Promise<ImpactAnalysis> {
    const analysis = await this.repository.analyzeDisruption(facilityId);
    if (!analysis) throw new NotFoundError("That facility cannot be used in a disruption scenario.");
    return analysis;
  }
}
