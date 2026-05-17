import { NextRequest, NextResponse } from "next/server";
import { verificarApiKey, respostaForbidden } from "@/lib/api-auth";
import { upsertVeiculo } from "@/lib/db-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) return respostaForbidden();

  const body = await req.json();
  await upsertVeiculo(body);
  return NextResponse.json({ ok: true });
}
