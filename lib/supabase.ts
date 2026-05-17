import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!_client) {
    _client = createClient(url, anonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return _client;
}

// Para Server Components e API routes (usa service role key para bypass RLS)
export function getSupabaseServer() {
  return createClient(url, serviceKey || anonKey);
}
