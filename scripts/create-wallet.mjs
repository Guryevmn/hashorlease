// Creates a throwaway test wallet and writes the key to the local .env. The key is never printed.
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

if (existsSync(".env") && /^TELEGRAPH_WALLET_KEY=\S+/m.test(readFileSync(".env", "utf8"))) {
  console.log("Key already in .env, not creating a new one");
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
console.log("Wallet address:", account.address);
