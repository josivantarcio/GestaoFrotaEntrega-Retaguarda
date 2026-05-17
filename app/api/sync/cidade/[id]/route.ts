import { NextRequest, NextResponse } from "next/server";
import { verificarApiKey, respostaForbidden } from "@/lib/api-auth";
import { deletarCidade } from "@/lib/db-server";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verificarApiKey(req)) return respostaForbidden();

  const { id } = await params;
  await deletarCidade(parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
