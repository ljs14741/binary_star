import Link from "next/link";

export default function RootNotFound() {
    return (
        <div className="phone px-6 py-20 text-center">
            <p className="text-4xl">✦</p>
            <h1 className="mt-3 text-xl font-semibold">Not found · 찾을 수 없어요</h1>
            <Link href="/" className="btn-star mt-6 inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold">
                Home
            </Link>
        </div>
    );
}
