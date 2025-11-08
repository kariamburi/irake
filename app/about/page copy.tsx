"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-800 relative">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="absolute top-6 left-6 flex items-center gap-2 text-[#2e5543] hover:text-[#b27d44] transition-all duration-200"
      >
        <ArrowLeft size={20} />
        <span className="font-medium">Back</span>
      </button>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center py-5 bg-gradient-to-b from-[#f8f9f9] to-white border-b border-gray-200"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-[#2e5543] tracking-tight">
          About the Founder
        </h1>
        <p className="text-[#b27d44] text-lg mt-3 font-medium">
          Ekarihub Leadership
        </p>
      </motion.header>

      {/* Main Content */}
      <main className="flex flex-col lg:flex-row items-center justify-center gap-12 px-6 py-5 max-w-6xl mx-auto bg-gradient-to-tr from-white via-[#f9faf9] to-[#f5f7f5] rounded-3xl shadow-inner">
        {/* Founder Image */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="flex-shrink-0 w-full lg:w-1/3 flex justify-center"
        >
          <Image
            src="/ceo.jpg"
            alt="Stephen Ndulah Wafullah"
            width={400}
            height={500}
            className="rounded-2xl shadow-lg object-cover hover:shadow-2xl transition-transform duration-300 hover:scale-105"
          />
        </motion.div>

        {/* Bio */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="lg:w-2/3 space-y-6"
        >
          <h2 className="text-2xl font-semibold text-[#2e5543]">
            Stephen Ndulah Wafullah
          </h2>
          <h3 className="text-[#b27d44] font-medium">
            Founder & Chief Executive Officer, Ekarihub
          </h3>
          <p className="leading-relaxed text-gray-700">
            Stephen Ndulah Wafullah is the visionary Founder and CEO of
            <span className="text-[#b27d44] font-semibold"> ekarihub</span>, a
            pioneering digital agribusiness ecosystem redefining how global
            agribusiness and agricultural value chains connect and thrive.
            Rooted in principles of innovation, community, wildlife
            conservation, green living, and environmental stewardship,
            ekarihub leverages social media, technology, and data to build a
            more sustainable and inclusive future for agribusiness.
          </p>
          <p className="leading-relaxed text-gray-700">
            Stephen’s transformative journey began in 2022 when his hands-on
            experience in fruit and tree farming exposed deep market
            inefficiencies. This encounter ignited his mission to design
            scalable, technology-driven solutions that empower farmers,
            agronomists, traders, buyers, and other key stakeholders to prosper
            in an increasingly interconnected world of agribusiness.
          </p>
          <p className="leading-relaxed text-gray-700">
            With over a decade of strategic leadership in customs, taxation, and
            trade systems, Stephen has played a pivotal role in strengthening
            Kenya’s revenue base—contributing more than Kshs. 7 billion in
            additional revenue through post-clearance audits and risk
            management. His unique ability to merge technical expertise with
            entrepreneurial vision positions him at the forefront of
            agribusiness transformation.
          </p>
          <p className="leading-relaxed text-gray-700">
            A graduate of Hong Kong Baptist University (MSc in Business
            Management), Stephen brings a rare blend of global insight,
            strategic foresight, and practical experience, driving a bold vision
            to reimagine agribusiness for a sustainable, prosperous, and
            connected world.
          </p>
        </motion.div>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="bg-[#f8f9f9] border-t border-gray-200 py-10 px-6 mt-12"
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <Image
            src="/ekarihub-logo.png"
            alt="Ekarihub Logo"
            width={250}
            height={100}
            className="object-contain"
          />
          <div className="text-right mt-4 md:mt-0 text-gray-700 text-sm">
            <p className="font-semibold text-[#2e5543]">
              Stephen Ndulah Wafullah
            </p>
            <p className="text-[#b27d44] font-medium">
              Chief Executive Officer
            </p>
            <p>
              Mobile: <span className="text-[#2e5543]">+254 722715672</span>
            </p>
            <p>
              Email: <span className="text-[#2e5543]">ceo@ekarihub.com</span>
            </p>
            <a
              href="https://www.ekarihub.com"
              target="_blank"
              className="text-[#b27d44] font-medium hover:underline"
            >
              www.ekarihub.com
            </a>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
