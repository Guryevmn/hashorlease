// Создаёт одноразовый тестовый кошелёк и пишет ключ в локальный .env. Ключ в вывод не попадает.
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

if (existsSync(".env") && /^TELEGRAPH_WALLET_KEY=\S+/m.test(readFileSync(".env", "utf8"))) {
  console.log("Ключ уже есть в .env, новый не создаю");
  process.exit(0);
}
const key = generatePrivateKey();
const account = privateKeyToAccount(key);
const lines = [
  "TELEGRAPH_API_URL=https://devnode.telegraphprotocol.com/engine/v1",
  `TELEGRAPH_WALLET_KEY=${key}`,
  "DAILY_SPEND_LIMIT_USD=0.50",
  "",
];
writeFileSync(".env", lines.join("\n"), { mode: 0o600 });
console.log("Адрес кошелька:", account.address);
