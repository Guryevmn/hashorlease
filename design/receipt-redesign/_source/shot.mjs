// Screenshots of the receipt sheet and History via chrome-headless-shell + CDP (no Playwright package needed).
// Usage: [Q="?receipt=b"] node shot.mjs <baseUrl> <outDir> <prefix> [scenario ...]  (Q picks a design variant)
// Scenarios: receipt-402, receipt-1280, pause-402, pause-1280, chips-402, chips-1280.
// Runs against a local copy of the app without a wallet key: nothing is bought.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [base, outDir, prefix, ...only] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const root = join(homedir(), "Library/Caches/ms-playwright");
const shellDir = readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell")).sort().pop();
const sub = readdirSync(join(root, shellDir)).find((d) => d.startsWith("chrome-headless-shell"));
const bin = join(root, shellDir, sub, "chrome-headless-shell");

const port = 9334 + Math.floor(Math.random() * 200);
const chrome = spawn(bin, [`--remote-debugging-port=${port}`, "--no-first-run", "--hide-scrollbars", `--user-data-dir=${process.env.TMPDIR}/hol-rcpt-${port}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 50; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = list.find((t) => t.type === "page");
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch {}
  await sleep(200);
}
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (process.env.DEBUG && m.method === "Runtime.exceptionThrown") console.error("PAGE EXC", JSON.stringify(m.params.exceptionDetails).slice(0, 600));
  if (process.env.DEBUG && m.method === "Runtime.consoleAPICalled" && m.params.type === "error") console.error("PAGE ERR", JSON.stringify(m.params.args).slice(0, 600));
  if (process.env.DEBUG && m.method === "Network.loadingFailed") console.error("NET FAIL", JSON.stringify(m.params).slice(0, 300));
});
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable");
if (process.env.DEBUG) await send("Network.enable");
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result?.result?.value;
};
const waitFor = async (expr, ms = 15000) => {
  for (let t = 0; t < ms; t += 250) { if (await ev(expr)) return true; await sleep(250); }
  throw new Error("timeout: " + expr);
};

async function open(path, w, h) {
  const mobile = w <= 640;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile });
  await send("Page.navigate", { url: base + path + (process.env.Q ?? "") });
  await sleep(1500);
}
async function shoot(name, clip) {
  await sleep(500);
  const shot = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  const file = join(outDir, `${prefix}-${name}.png`);
  writeFileSync(file, Buffer.from(shot.result.data, "base64"));
  console.log(file);
}

// Opens the receipt of the BTC price (CRYPTO_PRICE_USD) on the Leipzig Hub page.
async function openReceipt() {
  await waitFor(`document.querySelectorAll('button.rcpt.verified').length > 0`);
  const ok = await ev(`(async () => {
    const btns = [...document.querySelectorAll('button.rcpt.verified')];
    for (const b of btns) {
      b.scrollIntoView({ block: 'center' });
      b.click();
      await new Promise((r) => setTimeout(r, 250));
      const p = document.querySelector('.receipt-panel');
      if (p && p.textContent.includes('CRYPTO_PRICE_USD')) return true;
      if (p) { b.click(); await new Promise((r) => setTimeout(r, 150)); }
    }
    return false;
  })()`);
  if (!ok) throw new Error("BTC receipt not found");
  // A real tap leaves no focus ring; the scripted click would.
  await ev(`document.activeElement && document.activeElement.blur(), true`);
}

const setSelect = (sel, value) => ev(`(() => {
  const s = document.querySelector(${JSON.stringify(sel)});
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  set.call(s, ${JSON.stringify(value)});
  s.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
const clickText = (sel, text) => ev(`(() => {
  const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.textContent.trim().startsWith(${JSON.stringify(text)}));
  if (!b) return false; b.click(); return true;
})()`);

const SCEN = {
  async "receipt-402"() {
    await open("/sites/leipzig", 402, 874);
    await openReceipt();
    await shoot("receipt-402");
  },
  async "receipt-1280"() {
    await open("/sites/leipzig", 1280, 860);
    await openReceipt();
    // Keep the opened popover fully in view: scroll so it sits in the middle.
    await ev(`(() => { const p = document.querySelector('.receipt-panel'); const r = p.getBoundingClientRect(); window.scrollBy(0, r.top - 260); return true; })()`);
    await shoot("receipt-1280");
  },
  async "pause-402"() { await pause(402, 874); },
  async "pause-1280"() { await pause(1280, 860); },
  async "chips-402"() { await chips(402, 874); },
  async "chips-1280"() { await chips(1280, 860); },
};

async function pause(w, h) {
  await open("/feed", w, h);
  await waitFor(`document.querySelectorAll('.seg button').length === 3`);
  await clickText(".seg button", "7");
  await waitFor(`document.querySelectorAll('.hour').length > 10`);
  for (let i = 0; i < 6; i++) {
    if (await ev(`!!document.querySelector('.hour.paused, .pause-block, [data-paused]')`)) break;
    await clickText(".btn", "Show more");
    await sleep(500);
  }
  await waitFor(`!!document.querySelector('.hour.paused, .pause-block, [data-paused]')`);
  // The last decision before the first paused hour is the "back to decisions" moment (newest first): put it near the top.
  await ev(`(() => {
    const p = document.querySelector('.hour.paused, .pause-block, [data-paused]');
    let prev = p.previousElementSibling;
    const anchor = prev || p;
    const r = anchor.getBoundingClientRect();
    window.scrollBy(0, r.top - ${w <= 640 ? 150 : 180});
    return true;
  })()`);
  await shoot(`pause-${w}`);
}

async function chips(w, h) {
  await open("/feed", w, h);
  await waitFor(`!!document.querySelector('#site-filter option[value="silesia"]')`);
  await setSelect("#site-filter", "silesia");
  await sleep(600);
  await clickText(".seg button", "7");
  await sleep(600);
  await waitFor(`!!document.querySelector('.switch')`);
  await ev(`document.querySelector('.switch').click(), true`);
  await sleep(600);
  // Open the 13:00 change row so the mark buttons (Followed / Other / Skip) are in the frame too.
  await ev(`(() => { const b = document.querySelector('.hour-head'); if (b) b.click(); return true; })()`);
  await sleep(300);
  await ev(`(() => { const b = [...document.querySelectorAll('.mark-btn')].find((x) => x.textContent.trim() === 'Followed'); if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); return true; })()`);
  await shoot(`chips-${w}`);
}

for (const [name, fn] of Object.entries(SCEN)) {
  if (only.length && !only.includes(name)) continue;
  try { await fn(); } catch (e) {
    console.error(name, "FAILED", e.message);
    console.error(String(await ev(`location.href + ' | ' + document.body.innerText.slice(0, 600)`)));
    await shoot(`FAIL-${name}`);
  }
}
ws.close();
chrome.kill();
