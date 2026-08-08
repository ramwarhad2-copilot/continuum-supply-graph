import type { MedicineExposure, RiskLevel } from "@/domain/supply-network";

export function assessRisk(
  medicines: MedicineExposure[],
  alternateCount: number,
): RiskLevel {
  const hasEssential = medicines.some((medicine) => medicine.criticality === "essential");
  if (hasEssential && alternateCount === 0) return "critical";
  if (hasEssential && alternateCount <= 1) return "high";
  if (medicines.length > 1 || alternateCount === 0) return "moderate";
  return "low";
}

export function riskRank(risk: RiskLevel): number {
  return { critical: 0, high: 1, moderate: 2, low: 3 }[risk];
}

export function resilienceScore(demandPairs: Set<string>, coveredPairs: Set<string>): number {
  return demandPairs.size ? Math.round((coveredPairs.size / demandPairs.size) * 100) : 100;
}
