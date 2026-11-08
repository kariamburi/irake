"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

import { EKARI } from "@/app/constants/constants";
import { EXECUTIVES } from "@/app/components/executives";
import { Footer } from "@/app/components/Footer";
import { Topbar } from "@/app/components/Topbar";

export default function ExecutivesPage() {
  const router = useRouter();

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">

      <Topbar />

      {/* PAGE TITLE */}
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-2xl md:text-3xl font-black mt-4 mb-8"
        style={{ color: EKARI.text }}
      >
        Executives
      </motion.h2>

      {/* EXECUTIVES GRID */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {
            opacity: 0,
          },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.08,
            },
          },
        }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
      >

        {EXECUTIVES.map((e) => (

          <motion.button
            key={e.slug}
            type="button"
            variants={{
              hidden: {
                opacity: 0,
                y: 15,
              },
              show: {
                opacity: 1,
                y: 0,
              },
            }}
            whileHover={{
              y: -4,
            }}
            onClick={() =>
              router.push(`/leadership/executives/${e.slug}`)
            }
            className="
              group
              text-left
              rounded-2xl
              overflow-hidden
              border
              bg-white
              shadow-sm
              hover:shadow-xl
              transition-shadow
              duration-300
              flex
              flex-col
            "
            style={{
              borderColor: EKARI.hair,
            }}
          >

            {/* EXECUTIVE PHOTO */}
            <div
              className="
                relative
                w-full
                h-[420px]
                sm:h-[440px]
                lg:h-[460px]
                overflow-hidden
                bg-gray-50
              "
            >

              <Image
                src={e.photo || e.passport}
                alt={`${e.name} - ${e.title}`}
                fill
                priority={e.slug === EXECUTIVES[0]?.slug}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="
                  object-contain
                  object-center
                  transition-transform
                  duration-500
                  group-hover:scale-[1.02]
                "
              />

            </div>

            {/* EXECUTIVE DETAILS */}
            <div className="p-5 flex flex-col flex-1">

              <h3
                className="font-black text-lg leading-snug"
                style={{
                  color: EKARI.text,
                }}
              >
                {e.name}
              </h3>

              <p
                className="text-sm mt-2 leading-relaxed"
                style={{
                  color: EKARI.dim,
                }}
              >
                {e.title}
              </p>

              {e.short && (
                <p
                  className="text-sm mt-3 leading-relaxed"
                  style={{
                    color: EKARI.dim,
                  }}
                >
                  {e.short}
                </p>
              )}

              <div
                className="
                  mt-auto
                  pt-5
                  text-sm
                  font-semibold
                  group-hover:underline
                "
                style={{
                  color: EKARI.text,
                }}
              >
                View Profile →
              </div>

            </div>

          </motion.button>

        ))}

      </motion.div>

      {/* FOOTER */}
      <div className="mt-16">
        <Footer />
      </div>

    </main>
  );
}