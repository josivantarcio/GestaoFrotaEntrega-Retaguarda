import { NextRequest, NextResponse } from "next/server";
import { verificarApiKey, respostaForbidden } from "@/lib/api-auth";
import { upsertDescarga } from "@/lib/db-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) return respostaForbidden();

  const body = await req.json();
  await upsertDescarga({
    ...body,
    motoristas_ids: body.motoristas_ids ?? [],
  });
  return NextResponse.json({ ok: true });
}
