import { deleteSite, updateSite } from "@/lib/live/sites";
import { sanitizeSiteInput } from "@/lib/siteForm";

export const dynamic = "force-dynamic";

const fail = (e: unknown) => Response.json({ ok: false, error: "server", message: e instanceof Error ? e.message : "failed" }, { status: 500 });

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const input = sanitizeSiteInput(await req.json().catch(() => null));
  if (!input) return Response.json({ ok: false, error: "invalid", message: "Send a site: kind must be \"grid\" or \"tariff\"." }, { status: 400 });
  let res;
  try {
    res = updateSite(id, input);
  } catch (e) {
    return fail(e);
  }
  if (!res) return Response.json({ ok: false, error: "not-found", message: "No such site." }, { status: 404 });
  return Response.json(res, { status: res.ok ? 200 : res.error === "invalid" ? 400 : 422 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    return deleteSite(id) ? new Response(null, { status: 204 }) : Response.json({ error: "not-found" }, { status: 404 });
  } catch (e) {
    return fail(e);
  }
}
