import { buildApp } from "./app";
import { env } from "./utils/env";

const app = buildApp();

app.listen(env.port, () => {
  console.log(`[server] Rodando na porta ${env.port}`);
});

