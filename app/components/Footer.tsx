import Link from "next/link";
import { EKARI } from "../constants/constants";
import Image from "next/image";
export function Footer() {
    return (
        <footer className="mt-14 border-t" style={{ borderColor: EKARI.hair }}>
            <div className="mx-auto max-w-6xl px-5 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="space-y-3">
                    <Image src="/ekarihub-logo.png" alt="EkariHub" width={140} height={40} />
                    <p className="text-sm" style={{ color: EKARI.dim }}>
                        Collaborate • Innovate • Cultivate
                    </p>
                </div>
                <div>
                    <div className="text-sm font-extrabold mb-3" style={{ color: EKARI.text }}>
                        Company
                    </div>
                    <ul className="space-y-2 text-sm">
                        <li><Link href="/about" className="hover:underline" style={{ color: EKARI.text }}>About</Link></li>
                        <li><Link href="/careers" className="hover:underline" style={{ color: EKARI.text }}>Careers</Link></li>
                        <li><Link href="/support" className="hover:underline" style={{ color: EKARI.text }}>Support</Link></li>
                    </ul>
                </div>
                <div>
                    <div className="text-sm font-extrabold mb-3" style={{ color: EKARI.text }}>
                        Resources
                    </div>
                    <ul className="space-y-2 text-sm">
                        <li><Link href="/policy" className="hover:underline" style={{ color: EKARI.text }}>Privacy Policy</Link></li>
                        <li><Link href="/terms" className="hover:underline" style={{ color: EKARI.text }}>Terms of Service</Link></li>

                    </ul>
                </div>
                <div>
                    <div className="text-sm font-extrabold mb-3" style={{ color: EKARI.text }}>
                        Download
                    </div>
                    <div className="flex gap-3">
                        <Link
                            href="#"
                            className="rounded-xl border px-3 py-2 text-sm font-bold hover:shadow-sm inline-flex items-center gap-2"
                            style={{ borderColor: EKARI.hair, color: EKARI.text, background: "#fff" }}
                            aria-label="Get it on Google Play"
                        >
                            {/* Google Play logo */}
                            <svg width="18" height="18" viewBox="0 0 512 512" aria-hidden="true">
                                <defs>
                                    <linearGradient id="gplay-a" x1="100%" x2="0%" y1="0%" y2="100%">
                                        <stop offset="0%" stopColor="#00A0FF" />
                                        <stop offset="50%" stopColor="#00D2FF" />
                                        <stop offset="100%" stopColor="#00E3FF" />
                                    </linearGradient>
                                    <linearGradient id="gplay-b" x1="100%" x2="0%" y1="0%" y2="100%">
                                        <stop offset="0%" stopColor="#FFE000" />
                                        <stop offset="50%" stopColor="#FFBD00" />
                                        <stop offset="100%" stopColor="#FFA200" />
                                    </linearGradient>
                                    <linearGradient id="gplay-c" x1="100%" x2="0%" y1="0%" y2="100%">
                                        <stop offset="0%" stopColor="#FF3A44" />
                                        <stop offset="100%" stopColor="#C31162" />
                                    </linearGradient>
                                    <linearGradient id="gplay-d" x1="100%" x2="0%" y1="0%" y2="100%">
                                        <stop offset="0%" stopColor="#32A071" />
                                        <stop offset="100%" stopColor="#00A86B" />
                                    </linearGradient>
                                </defs>
                                <path fill="url(#gplay-a)" d="M48 70c0-9 7-16 16-16 4 0 8 2 12 4l228 132-56 56L48 86V70z" />
                                <path fill="url(#gplay-b)" d="M304 190l62-36 58 34c14 8 14 28 0 36l-58 34-62-36 56-32z" />
                                <path fill="url(#gplay-c)" d="M304 322l62 36-228 132c-4 2-8 4-12 4-9 0-16-7-16-16v-16l194-140z" />
                                <path fill="url(#gplay-d)" d="M48 426V86l200 170L48 426z" />
                            </svg>
                            <span>Google Play</span>
                        </Link>

                        <Link
                            href="#"
                            className="rounded-xl border px-3 py-2 text-sm font-bold hover:shadow-sm inline-flex items-center gap-2"
                            style={{ borderColor: EKARI.hair, color: EKARI.text, background: "#fff" }}
                            aria-label="Download on the App Store"
                        >
                            {/* Apple logo */}
                            <svg width="16" height="16" viewBox="0 0 512 512" aria-hidden="true">
                                <path
                                    fill="currentColor"
                                    d="M349 136c-21 0-46 12-60 30-13 17-24 43-20 69 27 2 52-11 69-30 16-19 27-45 11-69zm-35 96c-38 0-54 22-80 22-27 0-47-22-80-22-63 0-135 75-113 170 18 78 81 136 126 136 24 0 39-16 74-16 35 0 48 16 75 16 46 0 102-51 121-124 4-13 7-27 7-42 0-84-69-138-130-140z"
                                />
                            </svg>
                            <span>App Store</span>
                        </Link>
                    </div>

                </div>
            </div>
            <div className="py-4 text-center text-xs" style={{ color: EKARI.dim }}>
                © {new Date().getFullYear()} EkariHub. All rights reserved.
            </div>
        </footer>
    );
}
