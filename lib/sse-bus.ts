export interface SseEvent {
  tipo: string;
  tabela: string;
  payload: unknown;
}

type Listener = (event: SseEvent) => void;

const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function broadcast(event: SseEvent): void {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch {
      // listener already closed — will be cleaned up on disconnect
    }
  });
}
