import { NextRequest, NextResponse } from "next/server";
import { verificarApiKey, respostaForbidden } from "@/lib/api-auth";
import { upsertDescarga } from "@/lib/db-server";
import { broadcast } from "@/lib/sse-bus";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) return respostaForbidden();

  const body = await req.json();
  upsertDescarga({
    ...body,
    motoristas_ids: body.motoristas_ids ?? [],
  });
  broadcast({ tipo: "descarga_upserted", tabela: "descargas", payload: body });

  return NextResponse.json({ ok: true });
}
