import { createHash, randomBytes } from "crypto";

const SECRET = process.env.STAR_SECRET || "star-dev-secret";

// 소금 섞은 sha256 (hex 64자)
export function hashWithSecret(...parts: string[]): string {
    return createHash("sha256").update([SECRET, ...parts].join("|")).digest("hex");
}

// owner_token: 32바이트 → url 에 넣기 좋은 base64url
export function newOwnerToken(): string {
    return randomBytes(32).toString("base64url");
}

export function hashOwnerToken(token: string): string {
    return hashWithSecret("owner", token);
}

export function newVisitorId(): string {
    return randomBytes(16).toString("base64url");
}
