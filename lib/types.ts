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
  criado_em: string;
  atualizado_em: string;
}

// Tipos de evento para notificações
export type EventoNotificacao =
  | { tipo: "rota_iniciada"; rota: Rota }
  | { tipo: "cidade_concluida"; rota: Rota; cidade: ItemRota }
  | { tipo: "rota_encerrada"; rota: Rota }
  | { tipo: "ocorrencia_registrada"; rota: Rota; cidade: ItemRota; ocorrencia: Ocorrencia };
