// Telegraph escrow rail: pay from a balance deposited once into the Telegraph contract, signed per request with
// personal_sign (EIP-191). No facilitator and no per-request on-chain transaction: the node bills the balance at
// the end of the epoch. Docs: https://anjoman.ai/docs/using/escrow-inference
// Why: on 17.11.2026 the x402 facilitator stopped settling Sepolia payments for everyone (402 "settlement failed"),
// while escrow kept working. Pure helpers here; the network part lives in telegraph.ts.

/** The `escrow` entry of the 402 challenge body (`accepts[]`). */
export interface EscrowOffer {
  scheme: "escrow";
  network: string;
  payTo: string;
  extra: { message: string; resource?: string };
}

export interface EscrowAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

/** Telegraph receipt (X-PAYMENT-RESPONSE on escrow, X-TELEGRAPH-RECEIPT on x402). */
export interface TelegraphReceipt {
  receipt_hash?: string;
  rail?: string;
  epoch_id?: number;
  amount_uusdc?: string;
  tx_hash?: string;
}

/** Finds the escrow offer in a 402 challenge body; null if the node does not offer escrow. */
export function findEscrowOffer(challenge: unknown): EscrowOffer | null {
  const accepts = (challenge as { accepts?: unknown })?.accepts;
  if (!Array.isArray(accepts)) return null;
  const e = accepts.find((a) => (a as { scheme?: string })?.scheme === "escrow") as EscrowOffer | undefined;
  if (!e || typeof e.payTo !== "string" || typeof e.network !== "string" || typeof e.extra?.message !== "string") return null;
  return e;
}

/** Amount in μUSDC from the `Amount:` line of the template (the only place present in every challenge form). */
export function escrowAmount(offer: EscrowOffer): string | null {
  return offer.extra.message.match(/Amount:\s*(\d+)\s*uUSDC/)?.[1] ?? null;
}

/**
 * Builds the signed escrow payment for the X-PAYMENT header.
 * Rules from the docs: sign the template verbatim, lowercase `from`, window ≤ 2 minutes, fresh nonce every attempt.
 */
export async function buildEscrowPayment(
  offer: EscrowOffer,
  address: string,
  signMessage: (message: string) => Promise<string>,
  opts: { nowSec?: number; nonce?: string } = {},
): Promise<{ header: string; authorization: EscrowAuthorization; message: string }> {
  const value = escrowAmount(offer);
  if (!value) throw new Error("escrow challenge has no Amount line");
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const authorization: EscrowAuthorization = {
    from: address.toLowerCase(),
    to: offer.payTo,
    value,
    validAfter: String(now - 5),
    validBefore: String(now + 100),
    nonce: opts.nonce ?? crypto.randomUUID(),
  };
  const message = offer.extra.message
    .replace("{from}", authorization.from)
    .replace("{nonce}", authorization.nonce)
    .replace("{validAfter}", authorization.validAfter)
    .replace("{validBefore}", authorization.validBefore);
  const signature = await signMessage(message);
  const envelope = { x402Version: 2, scheme: "escrow", network: offer.network, payload: { signature, authorization } };
  return { header: Buffer.from(JSON.stringify(envelope)).toString("base64"), authorization, message };
}

/** Escrow refusals that mean "no money on the balance": fall back to x402 instead of failing. */
export function isUnfundedEscrow(reason: string | null | undefined): boolean {
  return !!reason && /insufficient escrow|outstanding debt|delivery suspended/i.test(reason);
}

/** Decodes a base64 JSON receipt header; null if missing or malformed. */
export function decodeReceipt(header: string | null | undefined): TelegraphReceipt | null {
  if (!header) return null;
  try {
    const r = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as TelegraphReceipt;
    return r && typeof r === "object" ? r : null;
  } catch {
    return null;
  }
}
