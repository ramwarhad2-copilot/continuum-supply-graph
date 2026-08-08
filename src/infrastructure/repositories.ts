import type { SupplyNetworkRepository } from "@/domain/ports/supply-network-repository";
import { getConfig } from "@/infrastructure/config/env";
import { DemoSupplyNetworkRepository } from "@/infrastructure/demo/demo-supply-network-repository";
import { getDriver } from "@/infrastructure/graph/driver";
import { Neo4jSupplyNetworkRepository } from "@/infrastructure/graph/neo4j-supply-network-repository";

let repository: SupplyNetworkRepository | undefined;

export function getSupplyNetworkRepository(): SupplyNetworkRepository {
  if (repository) return repository;

  const config = getConfig();
  repository =
    config.dataSource === "cognodb"
      ? new Neo4jSupplyNetworkRepository(getDriver(config), config)
      : new DemoSupplyNetworkRepository();
  return repository;
}
