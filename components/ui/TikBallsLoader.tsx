"use client";
import React from "react";

type Props = {
  size?: number;  // px
  gap?: number;   // px
  c1?: string;    // first & third ball
  c2?: string;    // middle ball
  bg?: string;    // optional background (e.g., overlay)
  ariaLabel?: string;
};

export default function BouncingBallLoader({
  size = 12,
  gap = 2,
  c1 = "#C79257", // EKARI gold
  c2 = "#233F39", // EKARI forest
  bg,
  ariaLabel = "Loading",
}: Props) {
  return (
    <div
      className="ezy-bouncing-ball-loader"
      role="status"
      aria-label={ariaLabel}
      style={
        {
          // css vars for easy theming
          ["--size" as any]: `${size}px`,
          ["--gap" as any]: `${gap}px`,
          ["--c1" as any]: c1,
          ["--c2" as any]: c2,
          background: bg,
        } as React.CSSProperties
      }
    >
      <div></div>
      <div></div>
      <div></div>

      <style jsx>{`
        .ezy-bouncing-ball-loader {
          display: inline-flex;
          align-items: flex-end;
          gap: var(--gap);
          padding: 6px;
          border-radius: 999px;
          line-height: 0;
        }
        .ezy-bouncing-ball-loader > div {
          width: var(--size);
          height: var(--size);
          border-radius: 999px;
          background: var(--c1);
          animation: ezy-bounce 850ms ease-in-out infinite;
          will-change: transform;
        }
        .ezy-bouncing-ball-loader > div:nth-child(2) {
          background: var(--c2);
          animation-delay: 120ms;
        }
        .ezy-bouncing-ball-loader > div:nth-child(3) {
          animation-delay: 240ms;
        }
        @keyframes ezy-bounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(calc(var(--size) * -0.9)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ezy-bouncing-ball-loader > div { animation: none; }
        }
      `}</style>
    </div>
  );
}
