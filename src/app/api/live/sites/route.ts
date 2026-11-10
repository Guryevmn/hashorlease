import { addSite, readSites } from "@/lib/live/sites";
import { sanitizeSiteInput } from "@/lib/siteForm";

export const dynamic = "force-dynamic";

const fail = (e: unknown) => Response.json({ ok: false, error: "server", message: e instanceof Error ? e.message : "failed" }, { status: 500 });

export async function GET() {
  try {
    return Response.json(readSites());
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  const input = sanitizeSiteInput(await req.json().catch(() => null));
  if (!input) return Response.json({ ok: false, error: "invalid", message: "Send a site: kind must be \"grid\" or \"tariff\"." }, { status: 400 });
  let res;
  try {
    res = addSite(input);
  } catch (e) {
    return fail(e);
  }
  return Response.json(res, { status: res.ok ? 201 : res.error === "invalid" ? 400 : 422 });
}
