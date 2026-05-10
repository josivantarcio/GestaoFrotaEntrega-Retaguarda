"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Cidade { id: number; nome: string; uf: string | null; }
interface RotaItem { cidadeNome: string; concluido?: boolean; }
interface Rota { id: number; status: string; itens: RotaItem[]; motorista: string; }

function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function IconeTruck({ size = 48, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
      <rect x="9" y="11" width="14" height="10" rx="2"/>
      <circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    </svg>
  );
}

function IconeSearch({ color = "#94a3b8" }: { color?: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function IconeCheck({ size = 14, color = "#22c55e" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

type Estado =
  | { tipo: "selecionando" }
  | { tipo: "buscando"; cidade: Cidade }
  | { tipo: "encontrada"; cidade: Cidade; rota: Rota }
  | { tipo: "nao_encontrada"; cidade: Cidade }
  | { tipo: "encerrada"; cidade: Cidade; rota: Rota };

export default function AcompanharPage() {
  const router = useRouter();
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "selecionando" });
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const cidadesFiltradas = cidades.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (c.uf ?? "").toLowerCase().includes(busca.toLowerCase())
  );

  useEffect(() => {
    supabase.from("cidades").select("id, nome, uf").order("nome").then(({ data }) => {
      if (data) setCidades(data);
    });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  async function selecionarCidade(cidade: Cidade) {
    setEstado({ tipo: "buscando", cidade });

    const { data: rotas } = await supabase
      .from("rotas")
      .select("id, status, itens, motorista")
      .eq("data", hoje())
      .eq("status", "em_andamento");

    const rota = rotas?.find((r: Rota) =>
      r.itens?.some((item: RotaItem) =>
        item.cidadeNome?.toLowerCase() === cidade.nome.toLowerCase()
      )
    );

    if (!rota) {
      // Verificar se já foi concluída hoje
      const { data: concluidas } = await supabase
        .from("rotas")
        .select("id, status, itens, motorista")
        .eq("data", hoje())
        .eq("status", "concluida");

      const rotaConcluida = concluidas?.find((r: Rota) =>
        r.itens?.some((item: RotaItem) =>
          item.cidadeNome?.toLowerCase() === cidade.nome.toLowerCase()
        )
      );

      if (rotaConcluida) {
        setEstado({ tipo: "encerrada", cidade, rota: rotaConcluida });
      } else {
        setEstado({ tipo: "nao_encontrada", cidade });
      }
      return;
    }

    setEstado({ tipo: "encontrada", cidade, rota });

    // Inscrever em tempo real para detectar encerramento
    const ch = supabase.channel(`acompanhar-rota-${rota.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "rotas",
        filter: `id=eq.${rota.id}`,
      }, (p) => {
        if (p.new.status === "concluida") {
          setEstado({ tipo: "encerrada", cidade, rota });
          supabase.removeChannel(ch);
        }
      })
      .subscribe();
  }

  function voltar() {
    setBusca("");
    setEstado({ tipo: "selecionando" });
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  // ── Tela: selecionando cidade ──
  if (estado.tipo === "selecionando") {
    return (
      <div style={styles.root}>
        <div style={styles.modal}>
          {/* Ícone */}
          <div style={styles.iconBox}>
            <IconeTruck size={32} color="#fff" />
          </div>

          <h1 style={styles.titulo}>Acompanhar entrega</h1>
          <p style={styles.subtitulo}>Selecione a cidade para ver a rota ao vivo</p>

          {/* Campo de busca */}
          <div style={styles.searchBox}>
            <IconeSearch />
            <input
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Buscar cidade..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          {/* Lista */}
          <div style={styles.lista}>
            {cidadesFiltradas.length === 0 ? (
              <div style={styles.vazio}>Nenhuma cidade encontrada</div>
            ) : (
              cidadesFiltradas.map(c => (
                <button key={c.id} style={styles.cidadeItem} onClick={() => selecionarCidade(c)}>
                  <div style={styles.cidadeNome}>{c.nome}</div>
                  {c.uf && <div style={styles.cidadeUf}>{c.uf}</div>}
                </button>
              ))
            )}
          </div>
        </div>
        <style>{globalCss}</style>
      </div>
    );
  }

  // ── Tela: buscando ──
  if (estado.tipo === "buscando") {
    return (
      <div style={styles.root}>
        <div style={styles.modal}>
          <div style={styles.iconBox}><IconeTruck size={32} color="#fff" /></div>
          <h1 style={styles.titulo}>{estado.cidade.nome}</h1>
          <p style={styles.subtitulo}>Buscando rota ativa...</p>
          <div style={styles.spinner} />
        </div>
        <style>{globalCss}</style>
      </div>
    );
  }

  // ── Tela: rota não encontrada ──
  if (estado.tipo === "nao_encontrada") {
    return (
      <div style={styles.root}>
        <div style={styles.modal}>
          <div style={{ ...styles.iconBox, background: "#334155" }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h1 style={styles.titulo}>{estado.cidade.nome}</h1>
          <p style={styles.subtitulo}>Nenhuma rota ativa para esta cidade hoje.</p>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>Tente novamente mais tarde</p>
          <button style={styles.btnVoltar} onClick={voltar}>← Escolher outra cidade</button>
        </div>
        <style>{globalCss}</style>
      </div>
    );
  }

  // ── Tela: rota encerrada ──
  if (estado.tipo === "encerrada") {
    return (
      <div style={styles.root}>
        <div style={styles.modal}>
          <div style={{ ...styles.iconBox, background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
            <IconeCheck size={32} color="#fff" />
          </div>
          <h1 style={styles.titulo}>Entrega concluída!</h1>
          <p style={styles.subtitulo}>A rota de {estado.cidade.nome} foi encerrada.</p>
          {estado.rota.motorista && (
            <p style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>Motorista: {estado.rota.motorista}</p>
          )}
          <button style={styles.btnVoltar} onClick={voltar}>← Acompanhar outra cidade</button>
        </div>
        <style>{globalCss}</style>
      </div>
    );
  }

  // ── Tela: rota encontrada → redireciona para rastrear ──
  if (estado.tipo === "encontrada") {
    router.push(`/rastrear/${estado.rota.id}`);
    return (
      <div style={styles.root}>
        <div style={styles.modal}>
          <div style={styles.iconBox}><IconeTruck size={32} color="#fff" /></div>
          <h1 style={styles.titulo}>{estado.cidade.nome}</h1>
          <p style={styles.subtitulo}>Rota encontrada! Abrindo rastreamento...</p>
          <div style={styles.spinner} />
        </div>
        <style>{globalCss}</style>
      </div>
    );
  }

  return null;
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    padding: 16,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  modal: {
    background: "#1e293b",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 20,
    padding: "32px 24px",
    width: "100%",
    maxWidth: 420,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    background: "linear-gradient(135deg, #0d47a1, #1565c0)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    boxShadow: "0 8px 24px rgba(13,71,161,0.4)",
  },
  titulo: {
    color: "#f1f5f9",
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    margin: 0,
  },
  subtitulo: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
    margin: 0,
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "10px 14px",
    width: "100%",
    marginTop: 12,
  },
  searchInput: {
    background: "none",
    border: "none",
    outline: "none",
    color: "#e2e8f0",
    fontSize: 14,
    flex: 1,
    width: "100%",
  },
  lista: {
    width: "100%",
    maxHeight: 320,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginTop: 4,
  },
  cidadeItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "none",
    border: "none",
    borderRadius: 10,
    padding: "11px 14px",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    transition: "background 0.15s",
  },
  cidadeNome: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: 500,
  },
  cidadeUf: {
    color: "#475569",
    fontSize: 11,
    fontWeight: 600,
    background: "rgba(255,255,255,0.05)",
    borderRadius: 6,
    padding: "2px 8px",
  },
  vazio: {
    color: "#475569",
    fontSize: 13,
    textAlign: "center",
    padding: "24px 0",
  },
  spinner: {
    width: 28,
    height: 28,
    border: "3px solid rgba(255,255,255,0.1)",
    borderTop: "3px solid #0d47a1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    marginTop: 16,
  },
  btnVoltar: {
    marginTop: 20,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    color: "#94a3b8",
    fontSize: 13,
    padding: "10px 20px",
    cursor: "pointer",
    width: "100%",
  },
};

const globalCss = `
  @keyframes spin { to { transform: rotate(360deg); } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  button:hover { background: rgba(255,255,255,0.08) !important; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
  input::placeholder { color: #475569; }
`;
