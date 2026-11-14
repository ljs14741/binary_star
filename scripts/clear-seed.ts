// 출시 전 테스트 이야기(is_seed) 한 번에 삭제. 공감·신고·번역은 cascade 로 같이 지워짐
import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";

async function main() {
    const r = await prisma.story.deleteMany({ where: { is_seed: true } });
    const p = await prisma.room_proposal.deleteMany({ where: { voter_key: { startsWith: "seed:" } } });
    const f = path.join(process.cwd(), "data/seed-owner-token.txt");
    if (fs.existsSync(f)) fs.unlinkSync(f);
    console.log(`[clear-seed] 이야기 ${r.count}개, 제안 ${p.count}개 삭제`);
}
main().finally(() => prisma.$disconnect());
