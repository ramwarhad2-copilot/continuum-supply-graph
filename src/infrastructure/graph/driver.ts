import neo4j, { type Driver } from "neo4j-driver";

import type { AppConfig } from "@/infrastructure/config/env";

declare global {
  var continuumDriver: Driver | undefined;
}

export function getDriver(config: Extract<AppConfig, { dataSource: "cognodb" }>): Driver {
  if (!globalThis.continuumDriver) {
    globalThis.continuumDriver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password),
      {
        connectionTimeout: 5_000,
        connectionAcquisitionTimeout: 6_000,
        maxConnectionPoolSize: 20,
        maxTransactionRetryTime: 4_000,
        disableLosslessIntegers: true,
      },
    );
  }

  return globalThis.continuumDriver;
}
