import { loadEnvFile } from "node:process";
import neo4j from "neo4j-driver";

import { getConfig } from "../src/infrastructure/config/env";
import { seedData } from "../src/infrastructure/demo/seed-data";

try {
  loadEnvFile(".env.local");
} catch {
  // CI and hosted environments usually inject variables instead of using a file.
}

const config = getConfig({ ...process.env, DATA_SOURCE: "cognodb" });
if (config.dataSource !== "cognodb") throw new Error("CognoDB configuration is required to seed data.");
const database = config.database;

const driver = neo4j.driver(
  config.uri,
  neo4j.auth.basic(config.username, config.password),
  {
    connectionTimeout: 8_000,
    maxTransactionRetryTime: 8_000,
    disableLosslessIntegers: true,
  },
);

const facilityQueries = {
  supplier: `
    UNWIND $rows AS row
    CREATE (facility:Facility:Supplier:Continuum {
      id: row.id, name: row.name, kind: row.kind, city: row.city,
      region: row.region, country: row.country, capacity: row.capacity,
      subtitle: row.subtitle
    })
  `,
  manufacturer: `
    UNWIND $rows AS row
    CREATE (facility:Facility:Manufacturer:Continuum {
      id: row.id, name: row.name, kind: row.kind, city: row.city,
      region: row.region, country: row.country, capacity: row.capacity,
      subtitle: row.subtitle
    })
  `,
  hub: `
    UNWIND $rows AS row
    CREATE (facility:Facility:Hub:Continuum {
      id: row.id, name: row.name, kind: row.kind, city: row.city,
      region: row.region, country: row.country, capacity: row.capacity,
      subtitle: row.subtitle
    })
  `,
  clinic: `
    UNWIND $rows AS row
    CREATE (facility:Facility:Clinic:Continuum {
      id: row.id, name: row.name, kind: row.kind, city: row.city,
      region: row.region, country: row.country, capacity: row.capacity,
      subtitle: row.subtitle
    })
  `,
} as const;

const writeQueries = {
  clear: `MATCH (node:Continuum) DETACH DELETE node`,
  medicines: `
    UNWIND $rows AS row
    CREATE (medicine:Medicine:Continuum {
      id: row.id, name: row.name, category: row.category, coldChain: row.coldChain
    })
  `,
  regions: `
    UNWIND $rows AS row
    CREATE (region:Region:Continuum {id: row.id, name: row.name, country: row.country})
  `,
  locations: `
    UNWIND $rows AS row
    MATCH (facility:Facility:Continuum {id: row.facilityId})
    MATCH (region:Region:Continuum {id: row.regionId})
    CREATE (facility)-[:LOCATED_IN]->(region)
  `,
  production: `
    UNWIND $rows AS row
    MATCH (facility:Facility:Continuum {id: row.facilityId})
    MATCH (medicine:Medicine:Continuum {id: row.medicineId})
    CREATE (facility)-[:MAKES {monthlyCapacity: row.monthlyCapacity}]->(medicine)
  `,
  needs: `
    UNWIND $rows AS row
    MATCH (clinic:Clinic:Continuum {id: row.clinicId})
    MATCH (medicine:Medicine:Continuum {id: row.medicineId})
    CREATE (clinic)-[:NEEDS {
      weeklyUnits: row.weeklyUnits, criticality: row.criticality
    }]->(medicine)
  `,
  routes: `
    UNWIND $rows AS row
    MATCH (origin:Facility:Continuum {id: row.from})
    MATCH (destination:Facility:Continuum {id: row.to})
    CREATE (origin)-[:ROUTES_TO {
      id: row.id, leadTimeHours: row.leadTimeHours,
      reliability: row.reliability, mode: row.mode
    }]->(destination)
  `,
  counts: `
    MATCH (node:Continuum)
    WITH count(node) AS nodes
    MATCH (:Continuum)-[relationship]->(:Continuum)
    RETURN nodes, count(relationship) AS relationships
  `,
} as const;

const constraints = [
  `CREATE CONSTRAINT FOR (facility:Facility) REQUIRE facility.id IS UNIQUE`,
  `CREATE CONSTRAINT FOR (medicine:Medicine) REQUIRE medicine.id IS UNIQUE`,
  `CREATE CONSTRAINT FOR (region:Region) REQUIRE region.id IS UNIQUE`,
];

async function main() {
  console.log("Connecting to CognoDB…");
  await driver.verifyConnectivity({ database });
  const session = driver.session({ database });

  try {
    for (const statement of constraints) {
      try {
        await session.run(statement);
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (!message.includes("already") && !message.includes("equivalent")) throw error;
      }
    }

    const regions = [...new Map(
      seedData.facilities.map((facility) => [
        `${facility.region.toLowerCase()}-${facility.country.toLowerCase()}`,
        {
          id: `${facility.region.toLowerCase()}-${facility.country.toLowerCase()}`.replaceAll(" ", "-"),
          name: facility.region,
          country: facility.country,
        },
      ]),
    ).values()];

    await session.executeWrite(async (tx) => {
      await tx.run(writeQueries.clear);
      for (const kind of ["supplier", "manufacturer", "hub", "clinic"] as const) {
        await tx.run(facilityQueries[kind], {
          rows: seedData.facilities.filter((facility) => facility.kind === kind),
        });
      }
      await tx.run(writeQueries.medicines, { rows: seedData.medicines });
      await tx.run(writeQueries.regions, { rows: regions });
      await tx.run(writeQueries.locations, {
        rows: seedData.facilities.map((facility) => ({
          facilityId: facility.id,
          regionId: `${facility.region.toLowerCase()}-${facility.country.toLowerCase()}`.replaceAll(" ", "-"),
        })),
      });
      await tx.run(writeQueries.production, { rows: seedData.production });
      await tx.run(writeQueries.needs, { rows: seedData.needs });
      await tx.run(writeQueries.routes, { rows: seedData.routes });
    });

    const result = await session.run(writeQueries.counts);
    const row = result.records[0];
    console.log(`Seed complete: ${row.get("nodes")} nodes, ${row.get("relationships")} relationships.`);
  } finally {
    await session.close();
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await driver.close();
  });
