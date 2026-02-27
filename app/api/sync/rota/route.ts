import { NextRequest, NextResponse } from "next/server";
import { verificarApiKey, respostaForbidden } from "@/lib/api-auth";
import { upsertRota } from "@/lib/db-server";
import { broadcast } from "@/lib/sse-bus";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) return respostaForbidden();

  const body = await req.json();
  const rota = upsertRota(body);
  broadcast({ tipo: "rota_upserted", tabela: "rotas", payload: rota });

  return NextResponse.json({ ok: true });
}
