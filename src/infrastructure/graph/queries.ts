// Query text is intentionally centralized: it keeps the storage adapter readable
// and makes every parameter boundary easy to audit during a code review.
export const queries = {
  facilities: `
    MATCH (facility:Facility:Continuum)
    RETURN facility
    ORDER BY facility.kind, facility.name
  `,
  medicines: `
    MATCH (medicine:Medicine:Continuum)
    RETURN medicine
    ORDER BY medicine.name
  `,
  routes: `
    MATCH (origin:Facility)-[route:ROUTES_TO]->(destination:Facility)
    WHERE origin:Continuum AND destination:Continuum
    RETURN origin.id AS originId, destination.id AS destinationId, route
    ORDER BY route.id
  `,
  impactPaths: `
    MATCH path = (disrupted:Facility:Continuum {id: $facilityId})-[:ROUTES_TO*1..4]->(clinic:Clinic)
    RETURN clinic.id AS clinicId,
           nodes(path) AS pathNodes,
           relationships(path) AS pathRelationships,
           reduce(hours = 0, route IN relationships(path) | hours + route.leadTimeHours) AS leadTimeHours
    ORDER BY clinic.id, leadTimeHours
  `,
  producedMedicines: `
    MATCH (facility:Facility:Continuum {id: $facilityId})-[:MAKES]->(medicine:Medicine)
    RETURN medicine.id AS medicineId
  `,
  clinicNeeds: `
    MATCH (clinic:Clinic)-[need:NEEDS]->(medicine:Medicine)
    WHERE clinic.id IN $clinicIds
    RETURN clinic.id AS clinicId,
           medicine.id AS medicineId,
           medicine.name AS medicineName,
           need.weeklyUnits AS weeklyUnits,
           need.criticality AS criticality
  `,
  alternativePaths: `
    MATCH (clinic:Clinic)-[need:NEEDS]->(medicine:Medicine)<-[:MAKES]-(alternative:Facility)
    MATCH path = (alternative)-[:ROUTES_TO*1..4]->(clinic)
    WHERE clinic.id IN $clinicIds AND alternative.id <> $facilityId
    RETURN clinic.id AS clinicId,
           clinic.name AS clinicName,
           medicine.id AS medicineId,
           medicine.name AS medicineName,
           alternative.name AS supplierName,
           nodes(path) AS pathNodes,
           relationships(path) AS pathRelationships,
           reduce(hours = 0, route IN relationships(path) | hours + route.leadTimeHours) AS leadTimeHours,
           reduce(score = 1.0, route IN relationships(path) | score * route.reliability) AS reliability
    ORDER BY clinic.id, medicine.id, reliability DESC, leadTimeHours ASC
  `,
} as const;
