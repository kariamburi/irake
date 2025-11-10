import Link from "next/link";
import { EKARI } from "../constants/constants";
import Image from "next/image";
export function Topbar() {
    return (
        <header
            className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:backdrop-blur bg-white/85 border-b"
            style={{ borderColor: EKARI.hair }}
        >
            <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <Image src="/ekarihub-logo.png" alt="EkariHub" width={120} height={34} priority />
                </Link>
                <nav className="hidden md:flex items-center gap-5 text-sm font-semibold">
                    <Link href="/" className="hover:underline" style={{ color: EKARI.text }}>
                        Home
                    </Link>
                    <Link href="/about" className="hover:underline" style={{ color: EKARI.text }}>
                        About
                    </Link>
                    <Link href="/terms" className="hover:underline" style={{ color: EKARI.text }}>
                        Terms
                    </Link>
                    <Link
                        href="/privacy"
                        className="hover:underline"
                        style={{ color: EKARI.text }}
                    >
                        Privacy
                    </Link>
                    <Link
                        href="/support"
                        className="hover:underline"
                        style={{ color: EKARI.text }}
                    >
                        Support
                    </Link>
                </nav>
            </div>
        </header>
    );
}
