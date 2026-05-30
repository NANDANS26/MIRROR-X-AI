import {
  CheckCircle2,
  Loader2,
  Circle,
} from "lucide-react";

import { motion }
  from "framer-motion";

interface Props {
  title: string;

  status:
    | "pending"
    | "running"
    | "completed";
}

export default function InvestigationStatus({
  title,
  status,
}: Props) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 10,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className="flex items-center gap-3"
    >
      {status === "pending" && (
        <Circle size={16} />
      )}

      {status === "running" && (
        <Loader2
          size={16}
          className="animate-spin"
        />
      )}

      {status === "completed" && (
        <CheckCircle2
          size={16}
          className="text-green-400"
        />
      )}

      <span>{title}</span>
    </motion.div>
  );
}