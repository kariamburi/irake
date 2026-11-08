// app/leadership/LeadershipClientPage.tsx
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { EKARI } from "../constants/constants";
import { EXECUTIVES } from "../components/executives";
import { Footer } from "../components/Footer";
import { Topbar } from "../components/Topbar";

const fadeUp = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
};

export default function LeadershipClientPage() {
    const router = useRouter();

    // Get the CEO information from the executives data
    const ceo = EXECUTIVES.find(
        (e) => e.slug === "stephen-ndulah"
    );

    return (
        <div className="min-h-screen bg-white">

            <Topbar />

            {/* HERO SECTION */}
            <header
                className="px-6 py-10 md:py-16"
                style={{ borderColor: EKARI.hair }}
            >

                <div
                    className="
            max-w-6xl
            mx-auto
            grid
            grid-cols-1
            md:grid-cols-2
            gap-10
            md:gap-12
            items-center
          "
                >

                    {/* LEFT SIDE - LEADERSHIP CONTENT */}
                    <motion.div
                        {...fadeUp}
                        transition={{ duration: 0.7 }}
                        className="space-y-5"
                    >

                        <h1
                            className="
                text-4xl
                md:text-5xl
                font-black
                leading-tight
              "
                            style={{ color: EKARI.forest }}
                        >
                            Meet Our Leadership
                        </h1>

                        <p
                            className="text-lg md:text-xl leading-relaxed"
                            style={{ color: EKARI.dim }}
                        >
                            At ekarihub, our leaders are more than visionaries -
                            they are architects of the next agribusiness revolution.
                            Guided by data, powered by artificial intelligence,
                            and inspired by mixed reality and social media,
                            they are transforming how the world connects,
                            trades, and grows within the agribusiness ecosystem.
                        </p>

                        <p
                            className="text-lg md:text-xl leading-relaxed"
                            style={{ color: EKARI.dim }}
                        >
                            Together, they’re redefining sustainability,
                            scalability, and social impact - creating an
                            intelligent, immersive, and borderless network
                            that empowers every player in the value chain,
                            from smallholder farmers to global exporters
                            and consumers.
                        </p>

                        {/* LEADERSHIP BUTTON */}
                        <button
                            onClick={() =>
                                router.push("/leadership/executives")
                            }
                            className="
                mt-3
                inline-flex
                items-center
                gap-2
                rounded-full
                px-6
                py-3
                font-extrabold
                text-white
                transition
                hover:opacity-90
              "
                            style={{
                                backgroundColor: EKARI.gold,
                            }}
                        >
                            Get to know our leadership

                            <ChevronRight size={18} />
                        </button>

                    </motion.div>

                    {/* RIGHT SIDE - CEO PHOTO */}
                    <motion.div
                        {...fadeUp}
                        transition={{
                            duration: 0.7,
                            delay: 0.05,
                        }}
                        className="
              relative
              w-full
              h-[420px]
              sm:h-[520px]
              md:h-[600px]
              lg:h-[650px]
              rounded-3xl
              overflow-hidden
              bg-gray-50
            "
                    >

                        <Image
                            src={ceo?.photo || "/executives/ceo.jpeg"}
                            alt={
                                ceo
                                    ? `${ceo.name} - ${ceo.title}`
                                    : "ekarihub leadership"
                            }
                            fill
                            priority
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="
                object-contain
                object-center
              "
                        />

                    </motion.div>

                </div>

            </header>

            {/* FOOTER */}
            <Footer />

        </div>
    );
}