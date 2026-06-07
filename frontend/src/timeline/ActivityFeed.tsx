import { motion } from "framer-motion";
import TimelineEvent from "./TimelineEvent";

import {
  useActivityStore,
} from "../store/activityStore";

export default function ActivityFeed() {
  const events =
    useActivityStore(
      (state) => state.events
    );

  return (
    <div className="flex flex-col gap-1 max-h-20 overflow-hidden">

      <div className="text-cyan-400 text-xs tracking-[0.3em]">
        LIVE ACTIVITY
      </div>

      {events
        .slice(0, 3)
        .map((event) => (
          <motion.div
            key={event.id}
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >
            <TimelineEvent
              timestamp={
                event.timestamp
              }
              message={
                event.message
              }
            />
          </motion.div>
        ))}
    </div>
  );
}