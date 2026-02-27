import { NextRequest, NextResponse } from "next/server";
import { verificarApiKey, respostaForbidden } from "@/lib/api-auth";
import { upsertCidade } from "@/lib/db-server";
import { broadcast } from "@/lib/sse-bus";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) return respostaForbidden();

  const body = await req.json();
  upsertCidade(body);
  broadcast({ tipo: "cidade_upserted", tabela: "cidades", payload: body });

  return NextResponse.json({ ok: true });
}
