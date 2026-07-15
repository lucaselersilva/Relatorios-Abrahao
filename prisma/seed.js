import "dotenv/config";
import { supabase } from "../lib/supabase.js";

async function main() {
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;
  const name = process.env.SEED_USER_NAME || null;

  if (!email || !password) {
    throw new Error("Defina SEED_USER_EMAIL e SEED_USER_PASSWORD antes de rodar o seed.");
  }

  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === email);

  if (found) {
    const { data, error } = await supabase.auth.admin.updateUserById(found.id, {
      password,
      user_metadata: { name },
    });
    if (error) throw error;
    console.log(`Usuário atualizado: ${data.user.email}`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  console.log(`Usuário criado: ${data.user.email}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
