import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Não lançamos erro aqui: um throw no carregamento do módulo acontece antes do
// React montar e resulta em tela totalmente branca, sem diagnóstico. Em vez
// disso, expomos a mensagem para o main.jsx renderizar uma tela de erro clara.
export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão configuradas.\n\nNo deploy (Vercel): Project Settings → Environment Variables, adicione as duas (em Production e Preview) e faça um novo deploy. Localmente: preencha o arquivo .env."
    : null;

export const supabase = supabaseConfigError ? null : createClient(supabaseUrl, supabaseAnonKey);
