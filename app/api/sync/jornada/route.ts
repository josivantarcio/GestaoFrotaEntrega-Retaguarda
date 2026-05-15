import { NextRequest, NextResponse } from "next/server";
import { verificarApiKey, respostaForbidden } from "@/lib/api-auth";
import { upsertJornada } from "@/lib/db-server";
import { broadcast } from "@/lib/sse-bus";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) return respostaForbidden();

  const body = await req.json();
  upsertJornada(body);
  broadcast({ tipo: "jornada_upserted", tabela: "jornadas", payload: body });

  return NextResponse.json({ ok: true });
}
