"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { Jornada, Descarga } from "@/lib/types";

export function useJornadasDescargasRealtime(dataFiltro: string) {
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [descargas, setDescargas] = useState<Descarga[]>([]);

  const jornadasRef = useRef<Map<number, Jornada>>(new Map());
  const descargasRef = useRef<Map<number, Descarga>>(new Map());

  // Carregamento inicial
  useEffect(() => {
    async function carregar() {
      const supabase = getSupabaseClient();
      const [{ data: rj }, { data: rd }] = await Promise.all([
        supabase.from("jornadas").select("*").eq("data", dataFiltro).order("hora_inicio"),
        supabase.from("descargas").select("*").eq("data", dataFiltro).order("hora_inicio"),
      ]);

      const mj = new Map<number, Jornada>();
      (rj ?? []).forEach((j: any) => mj.set(j.id, j));
      jornadasRef.current = mj;
      setJornadas([...mj.values()]);

      const md = new Map<number, Descarga>();
      (rd ?? []).forEach((d: any) => md.set(d.id, {
        ...d,
        motoristas_ids: typeof d.motoristas_ids === "string" ? JSON.parse(d.motoristas_ids) : (d.motoristas_ids ?? []),
      }));
      descargasRef.current = md;
      setDescargas([...md.values()]);
    }
    carregar();
  }, [dataFiltro]);

  // Supabase Realtime para jornadas e descargas
  useEffect(() => {
    const supabase = getSupabaseClient();

    const channel = supabase
      .channel(`jornadas-descargas-${dataFiltro}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jornadas", filter: `data=eq.${dataFiltro}` },
        (payload) => {
          const j = payload.new as Jornada;
          if (!j?.id) return;
          jornadasRef.current.set(j.id, j);
          setJornadas([...jornadasRef.current.values()]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "descargas", filter: `data=eq.${dataFiltro}` },
        (payload) => {
          const d = payload.new as any;
          if (!d?.id) return;
          const descarga: Descarga = {
            ...d,
            motoristas_ids: typeof d.motoristas_ids === "string" ? JSON.parse(d.motoristas_ids) : (d.motoristas_ids ?? []),
          };
          descargasRef.current.set(descarga.id, descarga);
          setDescargas([...descargasRef.current.values()]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dataFiltro]);

  return { jornadas, descargas };
}
