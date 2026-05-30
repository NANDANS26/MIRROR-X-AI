import { motion } from "framer-motion";

interface Props {
  category: string;

  explanation: string;
}

export default function EvidenceReveal({
  category,
  explanation,
}: Props) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className="mt-3 rounded-xl border border-red-500/20 bg-[#111827] p-4"
    >
      <div className="text-red-400 font-semibold">
        {category}
      </div>

      <div className="mt-2 text-gray-300 text-sm">
        {explanation}
      </div>
    </motion.div>
  );
}