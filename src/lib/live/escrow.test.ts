import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { buildEscrowPayment, decodeReceipt, escrowAmount, findEscrowOffer, isUnfundedEscrow } from "./escrow";

// Public, well-known test key (Hardhat account #0): never holds anything real.
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// The escrow entry exactly as the devnode returned it on 17.11.2026 (body of the 402 challenge).
const challenge = {
  error: "payment required",
  accepts: [
    { scheme: "exact", price: "$0.01", network: "eip155:11155111", payTo: "0x72a70e949362670Bf8bceAd24eFC5b8f950aa08b" },
    {
      extra: {
        description: "Charged to the caller's Telegraph escrow balance in the next ledger block.",
        message:
          "Telegraph Escrow Payment\n\nWallet: {from}\nPay To: 0x72a70e949362670bf8bcead24efc5b8f950aa08b\nNetwork: eip155:11155111\nAmount: 10000 uUSDC\nResource: /v1/ask\nNonce: {nonce}\nValid After: {validAfter}\nValid Before: {validBefore}",
        resource: "/v1/ask",
        signWith: "personal_sign (EIP-191)",
      },
      network: "eip155:11155111",
      payTo: "0x72a70e949362670bf8bcead24efc5b8f950aa08b",
      price: "$0.01",
      scheme: "escrow",
    },
  ],
};

describe("escrow rail", () => {
  it("finds the escrow offer and reads the amount from the template", () => {
    const offer = findEscrowOffer(challenge)!;
    expect(offer.payTo).toBe("0x72a70e949362670bf8bcead24efc5b8f950aa08b");
    expect(escrowAmount(offer)).toBe("10000");
    expect(findEscrowOffer({ accepts: [challenge.accepts[0]] })).toBeNull();
    expect(findEscrowOffer(null)).toBeNull();
  });

  it("signs the template verbatim: lowercase wallet, window under 2 minutes, signature recovers to the wallet", async () => {
    const acc = privateKeyToAccount(TEST_KEY);
    const offer = findEscrowOffer(challenge)!;
    const { header, authorization, message } = await buildEscrowPayment(offer, acc.address, (m) => acc.signMessage({ message: m }), { nowSec: 1_795_000_000, nonce: "n-1" });
    expect(authorization.from).toBe(acc.address.toLowerCase());
    expect(authorization.to).toBe(offer.payTo);
    expect(authorization.value).toBe("10000");
    expect(Number(authorization.validBefore) - Number(authorization.validAfter)).toBeLessThanOrEqual(120);
    expect(message).toContain(`Wallet: ${acc.address.toLowerCase()}`);
    expect(message).toContain("Nonce: n-1");
    expect(message).toContain("Network: eip155:11155111");
    expect(message).not.toMatch(/\{(from|nonce|validAfter|validBefore)\}/);

    const env = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    expect(env).toMatchObject({ x402Version: 2, scheme: "escrow", network: "eip155:11155111", payload: { authorization } });
    expect(await verifyMessage({ address: acc.address, message, signature: env.payload.signature })).toBe(true);
  });

  it("a fresh nonce on every payment", async () => {
    const acc = privateKeyToAccount(TEST_KEY);
    const offer = findEscrowOffer(challenge)!;
    const sign = (m: string) => acc.signMessage({ message: m });
    const a = await buildEscrowPayment(offer, acc.address, sign);
    const b = await buildEscrowPayment(offer, acc.address, sign);
    expect(a.authorization.nonce).not.toBe(b.authorization.nonce);
  });

  it("recognises an unfunded balance (falls back to x402) but not other refusals", () => {
    expect(isUnfundedEscrow("insufficient escrow for delivery: unbilled=0 μUSDC + price=10000 μUSDC > balance=0 μUSDC")).toBe(true);
    expect(isUnfundedEscrow("delivery suspended: outstanding debt of 10000 μUSDC")).toBe(true);
    expect(isUnfundedEscrow("authorization.nonce has already been used")).toBe(false);
    expect(isUnfundedEscrow(null)).toBe(false);
  });

  it("decodes the receipt header", () => {
    const h = Buffer.from(JSON.stringify({ receipt_hash: "0xabc", rail: "escrow", epoch_id: 7 })).toString("base64");
    expect(decodeReceipt(h)).toMatchObject({ receipt_hash: "0xabc", epoch_id: 7 });
    expect(decodeReceipt("%%%")).toBeNull();
    expect(decodeReceipt(null)).toBeNull();
  });
});
