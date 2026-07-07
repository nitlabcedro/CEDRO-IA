import React, { useMemo } from "react";
import { motion } from "framer-motion";

export default function LabLiquidAnimation() {
  // Generate a list of stable bubble configurations to avoid shifting unexpectedly on re-renders
  const bubbles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 28; i++) {
      const size = 3 + (i % 4) * 3; // 3px, 6px, 9px, 12px
      const left = 5 + (i * 19) % 91; // Deterministic distribution from 5% to 96%
      const duration = 7 + (i * 3.5) % 10; // 7s to 17s
      const delay = (i * 1.3) % 14; // 0s to 13s
      const isGreen = i % 3 !== 0; // Most bubbles are green, some are amber
      const opacity = i % 2 === 0 ? 0.08 : 0.16; // Soft, eye-safe opacity
      const horizontalWiggle = 15 + (i % 3) * 15; // 15px to 45px wiggle for physics-like sway

      arr.push({
        id: i,
        size,
        left: `${left}%`,
        duration,
        delay,
        color: isGreen ? "rgba(7, 86, 24, " + opacity + ")" : "rgba(242, 146, 34, " + opacity + ")",
        wiggle: horizontalWiggle,
      });
    }
    return arr;
  }, []);

  // Generate some faint drifting molecular bonds
  const molecules = useMemo(() => {
    const positions = [
      { top: "12%", left: "10%", size: 32, delay: 0.5, duration: 22 },
      { top: "28%", left: "82%", size: 44, delay: 2.5, duration: 26 },
      { top: "52%", left: "12%", size: 36, delay: 1.0, duration: 24 },
      { top: "68%", left: "78%", size: 40, delay: 4.0, duration: 28 },
      { top: "85%", left: "30%", size: 28, delay: 1.8, duration: 20 },
    ];

    return positions.map((p, idx) => ({
      ...p,
      id: idx,
      isGreen: idx % 2 === 0,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      {/* Subtle Grid Lines to anchor the scientific look */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-15" />

      {/* Lab Chemical Bubbles (Effervescence) rising up */}
      {bubbles.map((b) => (
        <motion.div
          key={`bubble-${b.id}`}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: b.left,
            bottom: "-20px",
            backgroundColor: b.color,
            boxShadow: `0 0 6px ${b.color}`,
          }}
          animate={{
            y: [0, -1000], // Rise from bottom to top
            x: [0, b.wiggle, -b.wiggle, b.wiggle / 2, 0], // Natural liquid sway/wiggle
            opacity: [0, 1, 1, 0.5, 0], // Fade in near bottom, rise, fade out near top
            scale: [0.8, 1.2, 1, 0.9, 0],
          }}
          transition={{
            duration: b.duration,
            repeat: Infinity,
            delay: b.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Faint rising molecular structures */}
      {molecules.map((m) => (
        <motion.div
          key={`mol-${m.id}`}
          className="absolute"
          style={{
            top: m.top,
            left: m.left,
            width: m.size,
            height: m.size,
            color: m.isGreen ? "rgba(7, 86, 24, 0.04)" : "rgba(242, 146, 34, 0.04)",
          }}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 360],
          }}
          transition={{
            duration: m.duration,
            repeat: Infinity,
            delay: m.delay,
            ease: "linear",
          }}
        >
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full fill-none stroke-current"
            strokeWidth="3.5"
          >
            <circle cx="50" cy="50" r="10" />
            <circle cx="20" cy="20" r="6" />
            <circle cx="80" cy="20" r="6" />
            <circle cx="50" cy="85" r="8" />
            <line x1="50" y1="40" x2="50" y2="77" />
            <line x1="43" y1="43" x2="24" y2="24" />
            <line x1="57" y1="43" x2="76" y2="24" />
          </svg>
        </motion.div>
      ))}

      {/* Condensation glow effect at the bottom */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#075618]/3 to-transparent blur-md pointer-events-none" 
      />
    </div>
  );
}
