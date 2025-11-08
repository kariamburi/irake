"use client";

import React from "react";

type DotsLoaderProps = {
    size?: number;          // dot diameter in px
    color?: string;         // dot color
    betweenSpace?: number;  // horizontal space between dots in px
    speedMs?: number;       // full grow->shrink cycle
    className?: string;     // optional wrapper class
};

export default function DotsLoader({
    size = 10,
    color = "#999999",
    betweenSpace = 8,
    speedMs = 600,
    className,
}: DotsLoaderProps) {
    // stagger each dot like your RN version (0ms, 150ms, 300ms)
    const delays = [0, speedMs / 4, speedMs / 2];

    return (
        <div
            className={className}
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: size,
            }}
            aria-label="Loading"
            role="status"
        >
            {delays.map((delay, i) => (
                <span
                    key={i}
                    className="dot"
                    style={{
                        width: size,
                        height: size,
                        margin: `0 ${betweenSpace / 2}px`,
                        backgroundColor: color,
                        borderRadius: size / 2,
                        animationDuration: `${speedMs}ms`,
                        animationDelay: `${delay}ms`,
                    }}
                />
            ))}

            {/* styled-jsx keeps it self-contained for Next.js */}
            <style jsx>{`
        .dot {
          opacity: 0.9;
          display: inline-block;
          transform: scale(0);
          animation-name: dotPulse;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          will-change: transform;
        }

        @keyframes dotPulse {
          0%   { transform: scale(0); }
          50%  { transform: scale(1); }
          100% { transform: scale(0); }
        }

        /* Respect reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .dot { animation: none; transform: scale(1); }
        }
      `}</style>
        </div>
    );
}
