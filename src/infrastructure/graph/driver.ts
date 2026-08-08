import neo4j, { type Driver } from "neo4j-driver";

import type { AppConfig } from "@/infrastructure/config/env";

export function getDriver(config: Extract<AppConfig, { dataSource: "cognodb" }>): Driver {
  return neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password), {
    connectionTimeout: 5_000,
    connectionAcquisitionTimeout: 6_000,
    maxConnectionPoolSize: 1,
    maxTransactionRetryTime: 4_000,
    disableLosslessIntegers: true,
  });
}
