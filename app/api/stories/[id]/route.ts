import { getCtx, err, json, readJson, sameOrigin } from "@/lib/api";
import { deleteStory, editStory, setWithdrawn } from "@/lib/stories";

// PATCH /api/stories/:id  { action: "edit", body } | { action: "withdraw" } | { action: "restore" }   (x-star-owner 헤더 필요)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const id = parseInt((await params).id, 10);
    if (!Number.isFinite(id)) return err("bad_request");
    const data = await readJson<{ action?: string; body?: string; lang?: string }>(req);
    const ctx = await getCtx(data?.lang);
    if (!ctx.ownerTokenHash) return err("forbidden", 403);
    let r;
    if (data?.action === "edit" && typeof data.body === "string") r = await editStory(id, ctx.ownerTokenHash, data.body, ctx.lang);
    else if (data?.action === "withdraw") r = await setWithdrawn(id, ctx.ownerTokenHash, true, ctx.lang);
    else if (data?.action === "restore") r = await setWithdrawn(id, ctx.ownerTokenHash, false, ctx.lang);
    else return err("bad_request");
    if (!r.ok) return err(r.error, r.error === "not_found" ? 404 : r.error === "forbidden" ? 403 : 400);
    return json({ ok: true, story: r.story });
}

// DELETE /api/stories/:id  (올린 뒤 10분 안에만)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!sameOrigin(req)) return err("forbidden", 403);
    const id = parseInt((await params).id, 10);
    if (!Number.isFinite(id)) return err("bad_request");
    const ctx = await getCtx();
    if (!ctx.ownerTokenHash) return err("forbidden", 403);
    const r = await deleteStory(id, ctx.ownerTokenHash);
    if (!r.ok) return err(r.error, r.error === "not_found" ? 404 : r.error === "forbidden" ? 403 : 400);
    return json({ ok: true });
}
