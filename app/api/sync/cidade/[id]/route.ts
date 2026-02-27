import { NextRequest, NextResponse } from "next/server";
import { verificarApiKey, respostaForbidden } from "@/lib/api-auth";
import { deletarCidade } from "@/lib/db-server";
import { broadcast } from "@/lib/sse-bus";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verificarApiKey(req)) return respostaForbidden();

  const { id } = await params;
  const numId = parseInt(id, 10);
  deletarCidade(numId);
  broadcast({ tipo: "deleted", tabela: "cidades", payload: { id: numId } });

  return NextResponse.json({ ok: true });
}
