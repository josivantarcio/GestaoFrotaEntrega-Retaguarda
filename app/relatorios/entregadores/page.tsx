"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Users, Package, RotateCcw, AlertTriangle, TrendingUp,
  ChevronDown, ChevronUp, Download, Search, Award, Target,
} from "lucide-react";
import { NavBar } from "@/components/layout/NavBar";
import { LABELS_OCORRENCIA } from "@/lib/types";
import type { TipoOcorrencia } from "@/lib/types";
import type { DesempenhoEntregador } from "@/app/api/relatorios/entregadores/route";

// ── Helpers ──────────────────────────────────────────────────
function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function inicioDeMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function dataBR(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
function corTaxa(taxa: number): string {
  if (taxa >= 95) return "text-green-700";
  if (taxa >= 80) return "text-amber-700";
  return "text-red-700";
}
function bgTaxa(taxa: number): string {
  if (taxa >= 95) return "bg-green-100";
  if (taxa >= 80) return "bg-amber-100";
  return "bg-red-100";
}
function barraCorTaxa(taxa: number): string {
  if (taxa >= 95) return "#16a34a";
  if (taxa >= 80) return "#d97706";
  return "#dc2626";
}

// ── CSV ──────────────────────────────────────────────────────
function gerarCSV(dados: DesempenhoEntregador[], inicio: string, fim: string): string {
  const linhas: string[][] = [
    ["Entregador", "Rotas", "Cidades", "Volumes Saída", "Volumes Entregues", "Devoluções", "Taxa Entrega (%)", "Ocorrências"],
  ];
  for (const d of dados) {
    linhas.push([
      d.entregadorNome,
      String(d.totalRotas),
      String(d.totalCidades),
      String(d.volumesSaida),
      String(d.volumesEntregues),
      String(d.volumesDevolvidos),
      String(d.taxaEntrega),
      String(d.totalOcorrencias),
    ]);
  }
  return linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}

function baixarCSV(conteudo: string, nome: string) {
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}

// ── Card de entregador ────────────────────────────────────────
function CardEntregador({ dados, posicao }: { dados: DesempenhoEntregador; posicao: number }) {
  const [aberto, setAberto] = useState(false);
  const ocTipos = Object.entries(dados.ocorrenciasPorTipo) as [TipoOcorrencia, number][];

  const medalha = posicao === 1 ? "🥇" : posicao === 2 ? "🥈" : posicao === 3 ? "🥉" : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full text-left p-5 hover:bg-gray-50/50 transition-colors"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              {medalha
                ? <span className="text-lg">{medalha}</span>
                : <Users size={18} className="text-blue-600" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-base truncate">{dados.entregadorNome}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {dados.totalRotas} rota{dados.totalRotas !== 1 ? "s" : ""} · {dados.totalCidades} cidade{dados.totalCidades !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className={`px-3 py-2 rounded-xl flex-shrink-0 ${bgTaxa(dados.taxaEntrega)} text-right`}>
            <p className={`text-xl font-black ${corTaxa(dados.taxaEntrega)}`}>{dados.taxaEntrega}%</p>
            <p className={`text-xs font-semibold ${corTaxa(dados.taxaEntrega)} opacity-70`}>entrega</p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(dados.taxaEntrega, 100)}%`, backgroundColor: barraCorTaxa(dados.taxaEntrega) }}
          />
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "volumes", valor: dados.volumesSaida, cor: "text-blue-700", bg: "bg-blue-50" },
            { label: "entregues", valor: dados.volumesEntregues, cor: "text-green-700", bg: "bg-green-50" },
            { label: "devoluções", valor: dados.volumesDevolvidos, cor: dados.volumesDevolvidos > 0 ? "text-amber-700" : "text-gray-500", bg: dados.volumesDevolvidos > 0 ? "bg-amber-50" : "bg-gray-50" },
            { label: "ocorrências", valor: dados.totalOcorrencias, cor: dados.totalOcorrencias > 0 ? "text-red-700" : "text-gray-500", bg: dados.totalOcorrencias > 0 ? "bg-red-50" : "bg-gray-50" },
          ].map((m) => (
            <div key={m.label} className={`${m.bg} rounded-xl p-2.5 text-center`}>
              <p className={`text-lg font-black ${m.cor}`}>{m.valor}</p>
              <p className="text-xs text-gray-400 leading-tight">{m.label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-1 mt-3">
          <span className="text-xs text-gray-400">{aberto ? "Fechar detalhes" : "Ver ocorrências"}</span>
          {aberto ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
        </div>
      </button>

      {/* Detalhes expandidos */}
      {aberto && (
        <div className="border-t border-gray-100 p-5 space-y-4">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Ocorrências por tipo</p>
            {ocTipos.length === 0 ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl p-3">
                <Target size={16} />
                <p className="text-sm font-semibold">Nenhuma ocorrência no período</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ocTipos.sort((a, b) => b[1] - a[1]).map(([tipo, qtd]) => {
                  const max = Math.max(...ocTipos.map((o) => o[1]));
                  return (
                    <div key={tipo} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 flex-1 truncate">{LABELS_OCORRENCIA[tipo] ?? tipo}</span>
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(qtd / max) * 100}%` }} />
                      </div>
                      <span className="text-xs font-bold text-red-600 w-4 text-right">{qtd}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Volumes detalhados</p>
            <div className="space-y-2">
              {[
                { label: "Saíram para entrega", valor: dados.volumesSaida, cor: "text-gray-800" },
                { label: "Entregues ao cliente", valor: dados.volumesEntregues, cor: "text-green-700" },
                { label: "Devolvidos", valor: dados.volumesDevolvidos, cor: dados.volumesDevolvidos > 0 ? "text-amber-700" : "text-gray-400" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{row.label}</span>
                  <span className={`text-sm font-bold ${row.cor}`}>{row.valor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function RelatorioEntregadoresPage() {
  const [inicio, setInicio] = useState(inicioDeMes());
  const [fim, setFim] = useState(hoje());
  const [dados, setDados] = useState<DesempenhoEntregador[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [buscado, setBuscado] = useState(false);

  const buscar = useCallback(async () => {
    if (!inicio || !fim) return;
    setCarregando(true);
    try {
      const res = await fetch(`/api/relatorios/entregadores?inicio=${inicio}&fim=${fim}`);
      if (res.ok) setDados(await res.json());
    } finally {
      setCarregando(false);
      setBuscado(true);
    }
  }, [inicio, fim]);

  const totalVolumes = dados.reduce((s, d) => s + d.volumesSaida, 0);
  const totalOcs = dados.reduce((s, d) => s + d.totalOcorrencias, 0);
  const mediaEntrega = dados.length > 0
    ? Math.round(dados.reduce((s, d) => s + d.taxaEntrega, 0) / dados.length)
    : 0;
  const melhor = dados[0] ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <NavBar />

      <main className="flex-1 px-5 py-6 max-w-4xl mx-auto w-full space-y-5">

        {/* Filtro */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Período de análise</p>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">De</label>
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Até</label>
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <button onClick={buscar} disabled={carregando}
              className="flex items-center gap-2 bg-[#0d47a1] hover:bg-blue-800 text-white rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-60">
              {carregando
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Search size={14} />}
              Buscar
            </button>
            {dados.length > 0 && (
              <button
                onClick={() => baixarCSV(gerarCSV(dados, inicio, fim), `entregadores_${inicio}_${fim}.csv`)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              >
                <Download size={14} /> CSV
              </button>
            )}
          </div>
        </div>

        {/* KPIs */}
        {buscado && dados.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Taxa Média</p>
              <p className={`text-3xl font-black ${corTaxa(mediaEntrega)}`}>{mediaEntrega}%</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Entregadores</p>
              <p className="text-3xl font-black text-gray-900">{dados.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Volumes</p>
              <p className="text-3xl font-black text-blue-700">{totalVolumes}</p>
            </div>
            <div className={`bg-white rounded-2xl border shadow-sm p-4 text-center ${totalOcs > 0 ? "border-amber-200" : "border-gray-100"}`}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Ocorrências</p>
              <p className={`text-3xl font-black ${totalOcs > 0 ? "text-amber-600" : "text-gray-900"}`}>{totalOcs}</p>
            </div>
          </div>
        )}

        {/* Destaque — melhor entregador */}
        {melhor && melhor.taxaEntrega >= 90 && (
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="text-4xl">🏆</div>
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Melhor desempenho no período</p>
              <p className="text-lg font-black text-amber-900">{melhor.entregadorNome}</p>
              <p className="text-sm text-amber-700">{melhor.taxaEntrega}% de taxa de entrega · {melhor.volumesEntregues} volumes entregues</p>
            </div>
          </div>
        )}

        {/* Lista de entregadores */}
        {carregando ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#0d47a1] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : buscado && dados.length === 0 ? (
          <div className="text-center py-16">
            <Users size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Nenhum dado no período</p>
            <p className="text-gray-300 text-sm mt-1">Ajuste o filtro e clique em Buscar</p>
          </div>
        ) : !buscado ? (
          <div className="text-center py-16">
            <TrendingUp size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Selecione o período e clique em Buscar</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {dados.length} entregador{dados.length !== 1 ? "es" : ""} · {dataBR(inicio)} a {dataBR(fim)}
            </p>
            {dados.map((d, idx) => (
              <CardEntregador key={d.entregadorId} dados={d} posicao={idx + 1} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
