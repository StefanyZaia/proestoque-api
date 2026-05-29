import "dotenv/config"; // Carrega as variáveis do .env antes de iniciar a aplicação

import { app } from "./app";
import { prisma } from "./prisma/client";

const PORT = process.env.PORT || 3333;
const HOST = process.env.HOST || "0.0.0.0";

async function iniciarServidor() {
  try {
    await prisma.$connect();

    console.log("✅ Banco de dados conectado");

    app.listen(Number(PORT), HOST, () => {
      console.log(`🚀 ProEstoque API rodando em http://localhost:${PORT}`);
      console.log("📊 Prisma Studio: npx prisma studio");
    });
  } catch (error) {
    console.error("❌ Erro ao conectar ao banco:", error);
    process.exit(1);
  }
}

iniciarServidor();
