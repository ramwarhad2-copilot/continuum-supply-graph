# 90-second demo script

## 0:00–0:15 — Frame the problem

“Continuum helps a healthcare operator answer: if a medicine supplier or distribution hub goes offline, which clinics are affected, and what safe alternatives remain?”

Show the overview metrics and the source → distribution → point-of-care topology.

## 0:15–0:45 — Run the user workflow

1. Click **Sahyadri Health Hub** on the graph.
2. Point out the animated red routes and affected clinic nodes.
3. Read the resilience score and patient throughput at risk.
4. Open the top critical clinic to show its complete multi-hop path and exposed medicines.
5. Point to the green alternate paths and their reliability/lead-time ranking.

## 0:45–1:02 — Show another scenario

Press `Ctrl/Cmd + K` and choose **Medigen Biologics**. Explain that a source failure scopes exposure to medicines that source makes, while a hub failure exposes all demand flowing through it.

## 1:02–1:20 — Prove the graph implementation

Open `src/infrastructure/graph/queries.ts` and show:

- the `$facilityId` parameter;
- `ROUTES_TO*1..4` for the blast radius;
- the clinic → medicine ← alternate supplier pattern;
- `nodes(path)` and `relationships(path)` returned as provenance.

Open the README data-model diagram and the transactional `scripts/seed.ts` loader.

## 1:20–1:30 — Close on engineering quality

Briefly show the dedicated unreachable-database state (a screenshot is enough), then say:

“The domain is independent of Next.js and CognoDB, every query is parameterized, live failures are never hidden by demo data, and lint, strict types, tests, and the production build all pass.”
