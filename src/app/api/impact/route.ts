import { NextResponse } from "next/server";
import { z } from "zod";

import { SupplyNetworkService } from "@/application/supply-network-service";
import { getSupplyNetworkRepository } from "@/infrastructure/repositories";
import { toPublicError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const inputSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const parsed = inputSchema.safeParse(new URL(request.url).searchParams.get("facilityId"));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: { code: "INVALID_INPUT", message: "Choose a valid facility to continue." },
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  try {
    const service = new SupplyNetworkService(getSupplyNetworkRepository());
    return NextResponse.json(
      { data: await service.analyzeDisruption(parsed.data), meta: { requestId } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("impact_request_failed", { requestId, facilityId: parsed.data, error });
    const publicError = toPublicError(error);
    return NextResponse.json(
      { ...publicError.body, meta: { requestId } },
      { status: publicError.status },
    );
  }
}
