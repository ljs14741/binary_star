"use client";
// 예전처럼 ?key= 로 들어오면 로그인 쿠키를 심고 주소창에서 키를 지움 (다음부턴 /admin 만으로 열림)
import { useEffect } from "react";
import { api } from "@/lib/client";

export default function AdminRemember({ adminKey }: { adminKey: string }) {
    useEffect(() => {
        api("/api/admin/login", { method: "POST", json: { key: adminKey } }).then((r) => {
            if (r.ok) window.history.replaceState(null, "", window.location.pathname);
        });
    }, [adminKey]);
    return null;
}
