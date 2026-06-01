import { motion } from "framer-motion";

interface Props {
  state:
    | "idle"
    | "thinking"
    | "investigating"
    | "warning"
    | "explaining";
}

export default function InvestigationOrb({
  state,
}: Props) {
  const scale =
    state === "investigating"
      ? 1.15
      : state === "thinking"
      ? 1.08
      : 1;

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        animate={{
          scale,
          rotate: 360,
        }}
        transition={{
          rotate: {
            repeat: Infinity,
            duration: 20,
            ease: "linear",
          },
          scale: {
            duration: 0.4,
          },
        }}
        className="absolute h-48 w-48 rounded-full border border-cyan-400/30"
      />

      <motion.div
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: 3,
        }}
        className="absolute h-36 w-36 rounded-full border border-cyan-500/40"
      />

      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.4, 0.9, 0.4],
        }}
        transition={{
          repeat: Infinity,
          duration: 2,
        }}
        className="h-24 w-24 rounded-full bg-cyan-400 blur-xl"
      />

      <motion.div
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: 2,
        }}
        className="absolute h-16 w-16 rounded-full bg-cyan-300"
      />
    </div>
  );
}