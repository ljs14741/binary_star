import "dotenv/config";
// 테스트에서 제안 승격 기준을 낮춰 빨리 확인 (lib/site.ts 가 읽음)
process.env.PROPOSAL_THRESHOLD = process.env.PROPOSAL_THRESHOLD || "5";
