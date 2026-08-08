import { NextResponse } from "next/server";

import { getSupplyNetworkRepository } from "@/infrastructure/repositories";
import { toPublicError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await getSupplyNetworkRepository().getHealth();
    return NextResponse.json({ data: health }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const publicError = toPublicError(error);
    return NextResponse.json(publicError.body, { status: publicError.status });
  }
}
