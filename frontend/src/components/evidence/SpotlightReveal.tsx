import { motion } from "framer-motion";

interface Props {
  image: string;

  explanation: string;
}

export default function SpotlightReveal({
  image,
  explanation,
}: Props) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.95,
      }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      className="overflow-hidden rounded-2xl border border-purple-500/20 bg-[#111827]"
    >
      <div className="relative">
        <img
          src={image}
          alt="evidence"
          className="w-full"
        />
      </div>

      <div className="p-5">
        <div className="text-purple-300 text-sm">
          AI Evidence Explanation
        </div>

        <div className="mt-2 text-gray-300">
          {explanation}
        </div>
      </div>
    </motion.div>
  );
}