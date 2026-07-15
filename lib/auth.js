import { supabase } from "./supabase.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  req.userId = data.user.id;
  req.userEmail = data.user.email;
  req.userName = data.user.user_metadata?.name || null;
  next();
}
