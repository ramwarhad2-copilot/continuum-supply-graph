import { NextResponse } from "next/server";

import { SupplyNetworkService } from "@/application/supply-network-service";
import { getSupplyNetworkRepository } from "@/infrastructure/repositories";
import { toPublicError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const service = new SupplyNetworkService(getSupplyNetworkRepository());
    return NextResponse.json(
      { data: await service.getOverview(), meta: { requestId } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("overview_request_failed", { requestId, error });
    const publicError = toPublicError(error);
    return NextResponse.json(
      { ...publicError.body, meta: { requestId } },
      { status: publicError.status },
    );
  }
}
