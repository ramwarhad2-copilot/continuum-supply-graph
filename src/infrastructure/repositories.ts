import type { SupplyNetworkRepository } from "@/domain/ports/supply-network-repository";
import { getConfig } from "@/infrastructure/config/env";
import { DemoSupplyNetworkRepository } from "@/infrastructure/demo/demo-supply-network-repository";
import { getDriver } from "@/infrastructure/graph/driver";
import { Neo4jSupplyNetworkRepository } from "@/infrastructure/graph/neo4j-supply-network-repository";

const demoRepository = new DemoSupplyNetworkRepository();

export function getSupplyNetworkRepository(): SupplyNetworkRepository {
  const config = getConfig();
  return config.dataSource === "cognodb"
    ? new Neo4jSupplyNetworkRepository(getDriver(config), config)
    : demoRepository;
}
