"use client";
import { useState } from "react";
import {
  ChevronDown, ChevronUp, Truck, Clock, Package,
  AlertTriangle, CheckCircle2, MapPin, Flag,
} from "lucide-react";
import { LABELS_OCORRENCIA, type Rota, type ItemRota } from "@/lib/types";

interface Props {
  rota: Rota;
  concluida?: boolean;
}

export function RotaCard({ rota, concluida = false }: Props) {
  const [expandido, setExpandido] = useState(!concluida);

  const totalParadas = rota.itens.length;
  const paradasConcluidas = rota.itens.filter((i) => i.concluido).length;
  const totalVolumes = rota.itens.reduce((s, i) => s + i.volumesSaida, 0);
  const totalEntregues = rota.itens.reduce(
    (s, i) => s + (i.volumesEntregues ?? i.volumesSaida - (i.volumesDevolvidos ?? 0)),
    0
  );
  const totalOcorrencias = rota.itens.reduce((s, i) => s + (i.ocorrencias?.length ?? 0), 0);
  const progresso = totalParadas > 0 ? (paradasConcluidas / totalParadas) * 100 : 0;
  const kmRodados = rota.km_chegada ? rota.km_chegada - rota.km_saida : null;

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-opacity ${
        concluida ? "border-green-200 opacity-75" : "border-gray-100"
      }`}
    >
      {/* Cabeçalho clicável */}
      <button className="w-full text-left px-5 py-4" onClick={() => setExpandido(!expandido)}>
        <div className="flex items-start justify-between gap-4">
          {/* Ícone + info principal */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={`rounded-xl p-2.5 flex-shrink-0 ${concluida ? "bg-green-100" : "bg-red-100"}`}>
              {concluida ? (
                <Flag size={18} className="text-green-600" />
              ) : (
                <Truck size={18} className="text-red-600" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-base truncate">{rota.motorista}</p>
              <p className="text-sm text-gray-500">{rota.veiculo_placa}</p>
            </div>
          </div>

          {/* Métricas rápidas */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {totalOcorrencias > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle size={11} />
                {totalOcorrencias}
              </span>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400">Paradas</p>
              <p className="text-sm font-bold text-gray-700">{paradasConcluidas}/{totalParadas}</p>
            </div>
            {expandido ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${concluida ? "bg-green-500" : "bg-[#ee4d2d]"}`}
            style={{ width: `${progresso}%` }}
          />
        </div>

        {/* Linha de meta */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            Saiu {rota.hora_saida}
            {rota.hora_chegada && ` · Chegou ${rota.hora_chegada}`}
          </span>
          <span className="flex items-center gap-1">
            <Package size={11} />
            {totalEntregues}/{totalVolumes} vol.
          </span>
          {kmRodados !== null && (
            <span>{kmRodados.toFixed(0)} km rodados</span>
          )}
        </div>
      </button>

      {/* Detalhe das paradas */}
      {expandido && (
        <div className="border-t border-gray-50">
          {rota.itens.map((item, idx) => (
            <ParadaItem key={idx} item={item} ultimo={idx === rota.itens.length - 1} />
          ))}

          {/* Rodapé de encerramento */}
          {rota.status === "concluida" && (
            <div className="px-5 py-3 bg-green-50 flex items-center gap-2 text-xs text-green-700 font-semibold">
              <CheckCircle2 size={14} />
              Rota encerrada
              {rota.hora_chegada && ` às ${rota.hora_chegada}`}
              {kmRodados !== null && ` · ${kmRodados.toFixed(0)} km`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ParadaItem({ item, ultimo }: { item: ItemRota; ultimo: boolean }) {
  const temOcorrencias = (item.ocorrencias?.length ?? 0) > 0;
  const entregues = item.volumesEntregues ?? item.volumesSaida - (item.volumesDevolvidos ?? 0);

  return (
    <div className={`px-5 py-3 flex items-start gap-3 ${!ultimo ? "border-b border-gray-50" : ""} ${item.concluido ? "bg-green-50/40" : ""}`}>
      {/* Status indicator */}
      <div className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
        item.concluido ? "bg-green-500 text-white" : "bg-gray-200"
      }`}>
        {item.concluido && <span className="text-xs font-bold">✓</span>}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin size={12} className={item.concluido ? "text-green-500" : "text-gray-400"} />
            <p className={`text-sm font-semibold truncate ${item.concluido ? "text-gray-500" : "text-gray-900"}`}>
              {item.cidadeNome}
            </p>
          </div>
          {item.horaConclusao && (
            <span className="text-xs text-gray-400 flex-shrink-0 flex items-center gap-1">
              <Clock size={10} />
              {item.horaConclusao}
            </span>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-0.5">
          {item.entregadorNome}
          {" · "}
          {item.concluido
            ? `${entregues}/${item.volumesSaida} entregues`
            : `${item.volumesSaida} volumes`}
          {(item.volumesDevolvidos ?? 0) > 0 && ` · ${item.volumesDevolvidos} dev.`}
        </p>

        {/* Ocorrências */}
        {temOcorrencias && (
          <div className="mt-1.5 space-y-1">
            {item.ocorrencias.map((oco) => (
              <div key={oco.id} className="flex items-start gap-1.5 bg-amber-50 rounded-lg px-2.5 py-1.5">
                <AlertTriangle size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-amber-700">
                    {LABELS_OCORRENCIA[oco.tipo] ?? oco.tipo}
                    {oco.quantidade > 1 && ` (${oco.quantidade}x)`}
                  </span>
                  {oco.descricao && (
                    <p className="text-xs text-amber-600 mt-0.5 truncate">{oco.descricao}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
