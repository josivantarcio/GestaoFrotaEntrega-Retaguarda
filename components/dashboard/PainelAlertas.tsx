"use client";

import { useMemo } from "react";
import { AlertTriangle, Clock, WifiOff, Zap } from "lucide-react";
import type { Rota } from "@/lib/types";

// Minutos desde uma string ISO
function minutosDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

// Minutos desde hora HH:MM no dia de hoje
function minutosDesdeHora(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  const agora = new Date();
  const ref = new Date(agora);
  ref.setHours(h, m, 0, 0);
  return Math.floor((agora.getTime() - ref.getTime()) / 60_000);
}

type Severidade = "critico" | "aviso";

interface Alerta {
  id: string;
  severidade: Severidade;
  titulo: string;
  descricao: string;
  rotaId?: number;
}

function gerarAlertas(rotas: Rota[]): Alerta[] {
  const alertas: Alerta[] = [];
  const emAndamento = rotas.filter((r) => r.status === "em_andamento");

  for (const rota of emAndamento) {
    // 1. Sem atualização há mais de 1h
    const minSemAtu = minutosDesde(rota.atualizado_em);
    if (minSemAtu >= 60) {
      alertas.push({
        id: `sem-atu-${rota.id}`,
        severidade: minSemAtu >= 120 ? "critico" : "aviso",
        titulo: "Sem atualização",
        descricao: `${rota.motorista} (${rota.veiculo_placa}) — sem sincronização há ${minSemAtu >= 60 ? `${Math.floor(minSemAtu / 60)}h ${minSemAtu % 60}min` : `${minSemAtu}min`}. Verifique se o app está aberto.`,
        rotaId: rota.id,
      });
    }

    // 2. Jornada muito longa (mais de 8h em rota)
    if (rota.hora_saida) {
      const minEmRota = minutosDesdeHora(rota.hora_saida);
      if (minEmRota >= 480) {
        const h = Math.floor(minEmRota / 60);
        const m = minEmRota % 60;
        alertas.push({
          id: `jornada-longa-${rota.id}`,
          severidade: minEmRota >= 600 ? "critico" : "aviso",
          titulo: "Jornada prolongada",
          descricao: `${rota.motorista} (${rota.veiculo_placa}) — em rota há ${h}h${m > 0 ? ` ${m}min` : ""}. Saída: ${rota.hora_saida}.`,
          rotaId: rota.id,
        });
      }
    }

    // 3. Rota com muitas ocorrências (mais de 3)
    const totalOcs = rota.itens.reduce((s, i) => s + (i.ocorrencias?.length ?? 0), 0);
    if (totalOcs >= 3) {
      alertas.push({
        id: `muitas-ocs-${rota.id}`,
        severidade: totalOcs >= 5 ? "critico" : "aviso",
        titulo: "Muitas ocorrências",
        descricao: `${rota.motorista} (${rota.veiculo_placa}) — ${totalOcs} ocorrência${totalOcs !== 1 ? "s" : ""} registrada${totalOcs !== 1 ? "s" : ""} nesta rota.`,
        rotaId: rota.id,
      });
    }
  }

  // Ordena: críticos primeiro
  return alertas.sort((a, b) => (a.severidade === "critico" ? -1 : 1) - (b.severidade === "critico" ? -1 : 1));
}

export function PainelAlertas({ rotas }: { rotas: Rota[] }) {
  const alertas = useMemo(() => gerarAlertas(rotas), [rotas]);

  if (alertas.length === 0) return null;

  const criticos = alertas.filter((a) => a.severidade === "critico").length;
  const avisos = alertas.filter((a) => a.severidade === "aviso").length;

  return (
    <section className="px-5 pt-1 pb-2 max-w-4xl mx-auto w-full">
      {/* Cabeçalho do painel */}
      <div className="flex items-center gap-2 mb-2">
        <Zap size={13} className="text-red-500" />
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Alertas
        </h2>
        <div className="flex items-center gap-1.5 ml-1">
          {criticos > 0 && (
            <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
              {criticos} crítico{criticos !== 1 ? "s" : ""}
            </span>
          )}
          {avisos > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
              {avisos} aviso{avisos !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {alertas.map((alerta) => (
          <AlertaCard key={alerta.id} alerta={alerta} />
        ))}
      </div>
    </section>
  );
}

function AlertaCard({ alerta }: { alerta: Alerta }) {
  const critico = alerta.severidade === "critico";

  const Icone = alerta.titulo === "Sem atualização"
    ? WifiOff
    : alerta.titulo === "Jornada prolongada"
    ? Clock
    : AlertTriangle;

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
      critico
        ? "bg-red-50 border-red-200"
        : "bg-amber-50 border-amber-200"
    }`}>
      <div className={`mt-0.5 rounded-lg p-1.5 flex-shrink-0 ${
        critico ? "bg-red-100" : "bg-amber-100"
      }`}>
        <Icone size={14} className={critico ? "text-red-600" : "text-amber-600"} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold ${critico ? "text-red-800" : "text-amber-800"}`}>
            {alerta.titulo}
          </p>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
            critico ? "bg-red-200 text-red-700" : "bg-amber-200 text-amber-700"
          }`}>
            {critico ? "CRÍTICO" : "AVISO"}
          </span>
        </div>
        <p className={`text-xs mt-0.5 leading-relaxed ${critico ? "text-red-700" : "text-amber-700"}`}>
          {alerta.descricao}
        </p>
      </div>
    </div>
  );
}
