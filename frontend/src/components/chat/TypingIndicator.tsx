import { motion } from "framer-motion";

export default function TypingIndicator() {
  return (
    <div className="flex gap-2 px-4 py-3">
      {[0, 1, 2].map((dot) => (
        <motion.div
          key={dot}
          className="w-2 h-2 rounded-full bg-purple-400"
          animate={{
            y: [0, -6, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 0.8,
            delay: dot * 0.15,
          }}
        />
      ))}
    </div>
  );
}