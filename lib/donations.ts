// 후원 내역: 관리자가 직접 넣고(카카오페이 API 없음), 화면엔 이름 가운데를 가려 보여 줌
import { prisma } from "./prisma";
import { memo, memoClear } from "./cache";
import { hasBannedWord } from "./moderation";

import { maskDonorName, type AdminDonation, type PublicDonation } from "./donations-shared";
export { maskDonorName, type AdminDonation, type PublicDonation };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function listPublicDonations(): Promise<{ count: number; items: PublicDonation[] }> {
    return memo("donations:public", 60_000, async () => {
        const rows = await prisma.donation.findMany({ orderBy: [{ donated_at: "desc" }, { id: "desc" }], take: 200 });
        return { count: rows.length, items: rows.map((r) => ({ id: r.id, name: maskDonorName(r.donor_name), amount: r.amount, date: ymd(r.donated_at) })) };
    });
}

export async function listAdminDonations(): Promise<AdminDonation[]> {
    const rows = await prisma.donation.findMany({ orderBy: [{ donated_at: "desc" }, { id: "desc" }], take: 500 });
    return rows.map((r) => ({ id: r.id, donor_name: r.donor_name, amount: r.amount, date: ymd(r.donated_at) }));
}

export async function addDonation(input: { name: string; amount: number; date: string }): Promise<{ ok: true } | { ok: false; error: string }> {
    const name = (input.name ?? "").replace(/\s+/g, " ").trim();
    if (!name || Array.from(name).length > 20) return { ok: false, error: "이름은 1~20자" };
    if (hasBannedWord(name)) return { ok: false, error: "이름에 쓸 수 없는 표현" };
    const amount = Math.round(Number(input.amount));
    if (!Number.isFinite(amount) || amount < 1 || amount > 10_000_000) return { ok: false, error: "금액은 1원~1천만 원" };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "날짜 형식" };
    const d = new Date(`${input.date}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 2 * 86400_000) return { ok: false, error: "날짜가 이상해요" };
    await prisma.donation.create({ data: { donor_name: name, amount, donated_at: d } });
    memoClear("donations:");
    return { ok: true };
}

export async function deleteDonation(id: number): Promise<boolean> {
    const r = await prisma.donation.deleteMany({ where: { id } });
    memoClear("donations:");
    return r.count > 0;
}
