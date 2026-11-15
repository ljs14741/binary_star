"use client";
// 방문자 집계용. 브라우저 세션당 한 번만 /api/visit 호출 (관리자 통계의 "방문자")
import { useEffect } from "react";

const KEY = "star_visit_sent";

export default function VisitBeacon() {
    useEffect(() => {
        try {
            if (sessionStorage.getItem(KEY)) return;
            sessionStorage.setItem(KEY, "1");
        } catch {}
        fetch("/api/visit", { method: "POST", keepalive: true }).catch(() => {});
    }, []);
    return null;
}
