import "dotenv/config";
import { prisma } from "../lib/db.js";
import { hashPassword } from "../lib/auth.js";

async function main() {
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;
  const name = process.env.SEED_USER_NAME || null;

  if (!email || !password) {
    throw new Error("Defina SEED_USER_EMAIL e SEED_USER_PASSWORD antes de rodar o seed.");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  console.log(`Usuário pronto: ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
