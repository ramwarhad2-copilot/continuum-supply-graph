# Architecture notes

## Goals

Continuum is optimized for four qualities that matter in a take-home review:

1. The graph is part of the product, not a storage detail bolted onto a CRUD interface.
2. A reviewer can run the complete experience immediately.
3. The live database path is production-minded and honest about failures.
4. The code can be explained from the outside in without jumping between framework concerns.

## Request flow

```text
browser interaction
  → GET /api/impact?facilityId=hub-sahyadri
  → Zod input validation
  → SupplyNetworkService.analyzeDisruption()
  → SupplyNetworkRepository port
  → Neo4jSupplyNetworkRepository
  → managed read transaction
      1. downstream paths (1..4 ROUTES_TO hops)
      2. medicines made by the interrupted facility
      3. needs at downstream clinics
      4. compatible alternate paths
  → domain risk and resilience policy
  → stable JSON response
  → highlighted routes, priority clinics, recommendations
```

## Decisions

### Hexagonal boundary around storage

The application depends on `SupplyNetworkRepository`, not the Neo4j driver. This gives the live CognoDB integration a narrow surface and makes the zero-setup adapter a genuine substitute rather than a collection of UI mocks.

### Demo mode is selected, never used as a fallback

If `DATA_SOURCE=cognodb` is configured and the instance is unreachable, the user sees an actionable error. Silently switching to demo data would make the hosted application look healthy while hiding a production failure.

### Managed transactions and a shared driver

The official driver is expensive and thread-safe, so one instance is cached across development reloads and server requests. Sessions are lightweight, read-only, and closed in `finally` blocks. Managed transactions allow the driver to retry transient failures.

### Central query catalog

Runtime Cypher lives in one module. This is not a generic query-builder abstraction; it is a small, auditable catalog of the product's graph questions. All external values enter through driver parameter maps.

### Domain policy remains outside Cypher

Path discovery and aggregation belong in the graph. Risk labels and the resilience score are product policy, so they remain deterministic TypeScript functions with focused tests. This prevents presentation language from becoming embedded in storage queries.

### A deterministic SVG topology

The graph contains three visually meaningful stages: sources, distribution, and care. A force simulation would move between renders and obscure this flow. The custom SVG uses stable positions, semantic color, keyboard-selectable nodes, and route states without shipping an extra visualization runtime.

## Failure taxonomy

| Failure | HTTP behavior | User experience |
| --- | --- | --- |
| Invalid facility input | `400 INVALID_INPUT` | Scenario picker remains usable |
| Unknown or clinic facility | `404 NOT_FOUND` | Scenario-level explanation |
| Missing live credentials | `500 CONFIGURATION_ERROR` | Network-level setup hint |
| Bolt/database unavailable | `503 DATABASE_UNAVAILABLE` | Retry with credentials/instance guidance |
| Unexpected server fault | `500 INTERNAL_ERROR` | Generic message; request ID retained |

Driver errors are logged on the server with a request ID but are never serialized to the browser.

## Scaling path

The take-home dataset fits comfortably on CognoDB's c0 tier. For a larger network, the next steps would be:

- paginate or spatially window the visualization response;
- materialize scenario results for repeated disruption simulations;
- include medicine IDs earlier in path pruning rather than filtering after traversal;
- add tenant IDs to node keys and every entry pattern;
- capture query summaries and latency percentiles;
- add authentication before exposing operational supply data;
- use synthetic monitoring against `/api/health` and a known scenario.

The repository boundary allows those infrastructure changes without coupling them to the UI or domain policy.
