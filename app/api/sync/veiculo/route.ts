import { NextRequest, NextResponse } from "next/server";
import { verificarApiKey, respostaForbidden } from "@/lib/api-auth";
import { upsertVeiculo } from "@/lib/db-server";
import { broadcast } from "@/lib/sse-bus";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) return respostaForbidden();

  const body = await req.json();
  upsertVeiculo(body);
  broadcast({ tipo: "veiculo_upserted", tabela: "veiculos", payload: body });

  return NextResponse.json({ ok: true });
}
