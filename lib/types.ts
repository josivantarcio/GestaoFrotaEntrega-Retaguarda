export type StatusRota = "em_andamento" | "concluida";

export type TipoOcorrencia =
  | "recusa_cliente" | "duplicidade" | "nao_localizado"
  | "cliente_ausente" | "produto_danificado" | "produto_fora_sistema"
  | "rota_errada" | "outro";

export const LABELS_OCORRENCIA: Record<TipoOcorrencia, string> = {
  recusa_cliente: "Recusa do Cliente",
  duplicidade: "Duplicidade",
  nao_localizado: "Endereço Não Localizado",
  cliente_ausente: "Cliente Ausente",
  produto_danificado: "Produto Danificado",
  produto_fora_sistema: "Fora do Sistema",
  rota_errada: "Rota Errada",
  outro: "Outro",
};

export interface Ocorrencia {
  id: string;
  tipo: TipoOcorrencia;
  descricao?: string;
  quantidade: number;
  registradoEm: string;
}

export interface ItemRota {
  cidadeId: number;
  cidadeNome: string;
  entregadorId: number;
  entregadorNome: string;
  volumesSaida: number;
  volumesEntregues?: number;
  volumesDevolvidos?: number;
  horaConclusao?: string;
  concluido: boolean;
  ocorrencias: Ocorrencia[];
}

export type TipoRefeicao = "cafe_manha" | "almoco" | "jantar" | "lanche" | "outro";
export type FormaPagamentoRefeicao = "dinheiro" | "pix" | "cartao_debito" | "cartao_credito" | "empresa" | "outro";

export const LABELS_REFEICAO: Record<TipoRefeicao, string> = {
  cafe_manha: "Café da manhã",
  almoco: "Almoço",
  jantar: "Jantar",
  lanche: "Lanche",
  outro: "Outro",
};

export interface PausaAlimentacao {
  id: string;
  tipo: TipoRefeicao;
  horaInicio: string;
  horaFim?: string;
  valorGasto?: number;
  formaPagamento?: FormaPagamentoRefeicao;
  local?: string;
  observacao?: string;
  preRota?: boolean;
}

export interface Rota {
  id: number;
  data: string;           // "YYYY-MM-DD"
  veiculo_id: number;
  veiculo_placa: string;
  motorista: string;
  km_saida: number;
  km_chegada: number | null;
  hora_saida: string;     // "HH:MM"
  hora_chegada: string | null;
  status: StatusRota;
  itens: ItemRota[];
  pausas_alimentacao: PausaAlimentacao[];
  trocas_veiculo?: unknown[];
  criado_em: string;
  atualizado_em: string;
}

export interface Jornada {
  id: number;
  data: string;
  hora_inicio: string;
  hora_fim: string | null;
  motorista: string | null;
  criado_em: string;
}

export interface Descarga {
  id: number;
  data: string;
  hora_inicio: string;
  hora_fim: string | null;
  motoristas_ids: number[];
  observacao: string | null;
  criado_em: string;
}

// Tipos de evento para notificações
export type EventoNotificacao =
  | { tipo: "rota_iniciada"; rota: Rota }
  | { tipo: "cidade_concluida"; rota: Rota; cidade: ItemRota }
  | { tipo: "rota_encerrada"; rota: Rota }
  | { tipo: "ocorrencia_registrada"; rota: Rota; cidade: ItemRota; ocorrencia: Ocorrencia };
