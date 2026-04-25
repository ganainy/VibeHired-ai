import { motion } from "framer-motion";
import { cn } from "../lib/utils";

interface VibeHiredLogoProps {
  className?: string;
  size?: number;
}

export function VibeHiredLogo({ className, size = 64 }: VibeHiredLogoProps) {
  const word1 = Array.from("Vibe");
  const word2 = Array.from("Hired");

  const letterVariants = {
    hidden: { y: 20, opacity: 0, rotate: -5 },
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      rotate: 0,
      transition: {
        type: "spring" as const,
        damping: 12,
        stiffness: 200,
        delay: i * 0.08,
      },
    }),
    hover: {
      y: -6,
      scale: 1.05,
      color: "var(--accent)",
      transition: { type: "spring" as const, stiffness: 300, damping: 10 },
    },
  };

  return (
    <div
      className={cn(
        "flex items-center justify-start cursor-default",
        className
      )}
      style={{ minHeight: size }}
    >
      <motion.div
        className="flex items-baseline font-bold tracking-tight"
        style={{
          fontSize: size * 0.8,
          fontFamily: "Inter, sans-serif",
        }}
        initial="hidden"
        animate="visible"
      >
        {/* "Vibe" */}
        <div className="flex mr-[0.05em]">
          {word1.map((letter, i) => (
            <motion.span
              key={i}
              custom={i}
              variants={letterVariants}
              whileHover="hover"
              style={{ color: "var(--text-secondary)" }}
              className="inline-block origin-bottom transition-colors duration-300"
            >
              {letter}
            </motion.span>
          ))}
        </div>

        {/* "Hired" */}
        <div className="flex relative">
          {word2.map((letter, i) => (
            <motion.span
              key={i + word1.length}
              custom={i + word1.length}
              variants={letterVariants}
              whileHover="hover"
              className="inline-block origin-bottom transition-colors duration-300 relative z-10"
              style={{ color: "var(--text-primary)" }}
            >
              {letter}
            </motion.span>
          ))}

          {/* Gold spark ✦ */}
          <motion.div
            className="absolute -right-[0.5em] -top-[0.2em]"
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: [0, 1.1, 1], rotate: [0, 15, 0] }}
            transition={{
              delay: (word1.length + word2.length) * 0.08 + 0.2,
              type: "spring",
              stiffness: 200,
            }}
            style={{
              fontSize: size * 0.4,
              color: "var(--amber)",
            }}
          >
            ✦
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
