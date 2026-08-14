import Image from "next/image";
import Link from "next/link";
import {
    IoArrowForwardOutline,
    IoLogoApple,
    IoMailOutline,
} from "react-icons/io5";

export function Footer() {
    return (
        <footer className="mt-10 border-t border-[#DDD8CC] bg-[#FBFAF6]">
            <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-5 py-9 sm:px-6 md:grid-cols-[1.35fr_0.8fr_0.9fr_1.2fr] lg:px-8">
                <div>
                    <Link
                        href="/"
                        className="inline-flex items-center"
                        aria-label="ekarihub home"
                    >
                        <Image
                            src="/ekarihub-logo.png"
                            alt="ekarihub"
                            width={145}
                            height={42}
                            className="h-auto w-[132px]"
                        />
                    </Link>

                    <p className="mt-3 max-w-[320px] text-[11px] font-medium leading-5 text-slate-400">
                        A digital agribusiness ecosystem connecting people,
                        markets, knowledge and opportunity.
                    </p>

                    <div className="mt-4 inline-flex rounded-full bg-[#E8ECE8] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#173C2E]">
                        Collaborate · Innovate · Cultivate
                    </div>
                </div>

                <FooterColumn
                    title="Company"
                    links={[
                        { href: "/about", label: "About" },
                        { href: "/leadership", label: "Leadership" },
                        { href: "/careers", label: "Careers" },
                        { href: "/support", label: "Support" },
                    ]}
                />

                <FooterColumn
                    title="Resources"
                    links={[
                        { href: "/privacy", label: "Privacy Policy" },
                        { href: "/terms", label: "Terms of Service" },
                        { href: "/delete-account", label: "Delete Account" },
                    ]}
                />

                <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-700">
                        Download
                    </div>

                    <p className="mt-2 text-[10px] font-medium leading-5 text-slate-400">
                        Take ekarihub with you on Android and iPhone.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                            href="https://play.google.com/store/apps/details?id=com.ekarihub.app"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[#DDD8CC] bg-white px-3 text-[10px] font-black text-slate-700 transition hover:bg-[#F3F1EB]"
                            aria-label="Get it on Google Play"
                        >
                            <svg
                                width="17"
                                height="17"
                                viewBox="0 0 512 512"
                                aria-hidden="true"
                            >
                                <defs>
                                    <linearGradient
                                        id="gplay-a"
                                        x1="100%"
                                        x2="0%"
                                        y1="0%"
                                        y2="100%"
                                    >
                                        <stop offset="0%" stopColor="#00A0FF" />
                                        <stop offset="50%" stopColor="#00D2FF" />
                                        <stop offset="100%" stopColor="#00E3FF" />
                                    </linearGradient>
                                    <linearGradient
                                        id="gplay-b"
                                        x1="100%"
                                        x2="0%"
                                        y1="0%"
                                        y2="100%"
                                    >
                                        <stop offset="0%" stopColor="#FFE000" />
                                        <stop offset="50%" stopColor="#FFBD00" />
                                        <stop offset="100%" stopColor="#FFA200" />
                                    </linearGradient>
                                    <linearGradient
                                        id="gplay-c"
                                        x1="100%"
                                        x2="0%"
                                        y1="0%"
                                        y2="100%"
                                    >
                                        <stop offset="0%" stopColor="#FF3A44" />
                                        <stop offset="100%" stopColor="#C31162" />
                                    </linearGradient>
                                    <linearGradient
                                        id="gplay-d"
                                        x1="100%"
                                        x2="0%"
                                        y1="0%"
                                        y2="100%"
                                    >
                                        <stop offset="0%" stopColor="#32A071" />
                                        <stop offset="100%" stopColor="#00A86B" />
                                    </linearGradient>
                                </defs>

                                <path
                                    fill="url(#gplay-a)"
                                    d="M48 70c0-9 7-16 16-16 4 0 8 2 12 4l228 132-56 56L48 86V70z"
                                />
                                <path
                                    fill="url(#gplay-b)"
                                    d="M304 190l62-36 58 34c14 8 14 28 0 36l-58 34-62-36 56-32z"
                                />
                                <path
                                    fill="url(#gplay-c)"
                                    d="M304 322l62 36-228 132c-4 2-8 4-12 4-9 0-16-7-16-16v-16l194-140z"
                                />
                                <path
                                    fill="url(#gplay-d)"
                                    d="M48 426V86l200 170L48 426z"
                                />
                            </svg>

                            Google Play
                        </Link>

                        <Link
                            href="https://apps.apple.com/us/app/ekarihub/id6761846497"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[#DDD8CC] bg-white px-3 text-[10px] font-black text-slate-700 transition hover:bg-[#F3F1EB]"
                            aria-label="Download on the App Store"
                        >
                            <IoLogoApple size={17} />
                            App Store
                        </Link>
                    </div>

                    <a
                        href="mailto:support@ekarihub.com"
                        className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black text-[#173C2E] transition hover:text-[#F39A22]"
                    >
                        <IoMailOutline size={12} />
                        support@ekarihub.com
                    </a>
                </div>
            </div>

            <div className="border-t border-[#E5E0D6]">
                <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                    <div className="text-[10px] font-semibold text-slate-400">
                        © {new Date().getFullYear()} ekarihub. All rights reserved.
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                        Powered by{" "}
                        <Link
                            href="https://www.craftinventors.co.ke"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-black text-[#173C2E] transition hover:text-[#F39A22]"
                        >
                            Craft Inventors
                            <IoArrowForwardOutline size={10} />
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}

function FooterColumn({
    title,
    links,
}: {
    title: string;
    links: {
        href: string;
        label: string;
    }[];
}) {
    return (
        <div>
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-700">
                {title}
            </div>

            <ul className="mt-3 space-y-2.5">
                {links.map((link) => (
                    <li key={link.href}>
                        <Link
                            href={link.href}
                            className="text-[10px] font-semibold text-slate-400 transition hover:text-[#173C2E]"
                        >
                            {link.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}