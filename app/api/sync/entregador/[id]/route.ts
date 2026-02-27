import { NextRequest, NextResponse } from "next/server";
import { verificarApiKey, respostaForbidden } from "@/lib/api-auth";
import { deletarEntregador } from "@/lib/db-server";
import { broadcast } from "@/lib/sse-bus";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verificarApiKey(req)) return respostaForbidden();

  const { id } = await params;
  const numId = parseInt(id, 10);
  deletarEntregador(numId);
  broadcast({ tipo: "deleted", tabela: "entregadores", payload: { id: numId } });

  return NextResponse.json({ ok: true });
}
