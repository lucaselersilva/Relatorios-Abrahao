import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados (.env)");
}

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "relatorios";

// Client com a service role key: uso exclusivo do servidor (nunca expor ao
// frontend). Usado para validar tokens de sessão, gerenciar usuários e
// acessar o Storage.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
