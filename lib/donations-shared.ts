// 후원 내역 공용 (브라우저·서버). DB 접근 없음

/** 이름 가운데 글자 가림: 김민수 → 김*수, 김수 → 김*, 남궁민수 → 남**수, 한 글자는 그대로 */
export function maskDonorName(name: string): string {
    const chars = Array.from(name.trim());
    if (chars.length <= 1) return chars.join("");
    if (chars.length === 2) return `${chars[0]}*`;
    return chars[0] + "*".repeat(chars.length - 2) + chars[chars.length - 1];
}

export type PublicDonation = { id: number; name: string; amount: number; date: string };
export type AdminDonation = { id: number; donor_name: string; amount: number; date: string };
