"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { Rota, ItemRota, Ocorrencia, EventoNotificacao } from "@/lib/types";

interface Options {
  dataFiltro: string; // "YYYY-MM-DD"
  onEvento: (e: EventoNotificacao) => void;
}

export function useRotasRealtime({ dataFiltro, onEvento }: Options) {
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [conectado, setConectado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const rotasRef = useRef<Map<number, Rota>>(new Map());
  const onEventoRef = useRef(onEvento);
  onEventoRef.current = onEvento;

  const setRotasOrdenadas = useCallback((mapa: Map<number, Rota>) => {
    setRotas(
      [...mapa.values()].sort(
        (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
      )
    );
  }, []);

  // Carregamento inicial via Supabase
  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      try {
        const { data } = await getSupabaseClient()
          .from("rotas")
          .select("*")
          .eq("data", dataFiltro)
          .order("criado_em", { ascending: false });

        const mapa = new Map<number, Rota>();
        (data ?? []).forEach((r: any) => {
          mapa.set(r.id, {
            ...r,
            itens: typeof r.itens === "string" ? JSON.parse(r.itens) : (r.itens ?? []),
            pausas_alimentacao: typeof r.pausas_alimentacao === "string" ? JSON.parse(r.pausas_alimentacao) : (r.pausas_alimentacao ?? []),
          });
        });
        rotasRef.current = mapa;
        setRotasOrdenadas(mapa);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [dataFiltro, setRotasOrdenadas]);

  // Supabase Realtime
  useEffect(() => {
    const supabase = getSupabaseClient();

    const channel = supabase
      .channel(`rotas-${dataFiltro}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rotas", filter: `data=eq.${dataFiltro}` },
        (payload) => {
          const nova = payload.new as any;
          if (!nova?.id) return;

          const rotaNova: Rota = {
            ...nova,
            itens: typeof nova.itens === "string" ? JSON.parse(nova.itens) : (nova.itens ?? []),
            pausas_alimentacao: typeof nova.pausas_alimentacao === "string" ? JSON.parse(nova.pausas_alimentacao) : (nova.pausas_alimentacao ?? []),
          };

          const antiga = rotasRef.current.get(rotaNova.id);

          if (!antiga) {
            onEventoRef.current({ tipo: "rota_iniciada", rota: rotaNova });
          } else if (rotaNova.status === "concluida" && antiga.status !== "concluida") {
            onEventoRef.current({ tipo: "rota_encerrada", rota: rotaNova });
          } else {
            detectarMudancasItens(antiga, rotaNova, onEventoRef.current);
          }

          rotasRef.current.set(rotaNova.id, rotaNova);
          setRotasOrdenadas(rotasRef.current);
        }
      )
      .subscribe((status) => {
        setConectado(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setConectado(false);
    };
  }, [dataFiltro, setRotasOrdenadas]);

  return { rotas, conectado, carregando };
}

function detectarMudancasItens(
  antiga: Rota,
  nova: Rota,
  onEvento: (e: EventoNotificacao) => void
) {
  nova.itens.forEach((itemNovo: ItemRota, idx: number) => {
    const itemAntigo = antiga.itens[idx];
    if (!itemAntigo) return;

    if (itemNovo.concluido && !itemAntigo.concluido) {
      onEvento({ tipo: "cidade_concluida", rota: nova, cidade: itemNovo });
      return;
    }

    const ocosNovo = itemNovo.ocorrencias?.length ?? 0;
    const ocosAntigo = itemAntigo.ocorrencias?.length ?? 0;
    if (ocosNovo > ocosAntigo) {
      const novaOco = itemNovo.ocorrencias[ocosNovo - 1] as Ocorrencia;
      onEvento({ tipo: "ocorrencia_registrada", rota: nova, cidade: itemNovo, ocorrencia: novaOco });
    }
  });
}
