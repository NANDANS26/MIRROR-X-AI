interface Props {
  status: string;
  patterns: number;
}

export default function SystemStatus({
  status,
  patterns,
}: Props) {
  return (
    <div className="flex flex-col text-xs gap-1">

      <div className="text-cyan-400 tracking-[0.3em]">
        MIRROR X ONLINE
      </div>

      <div className="text-gray-300">
        STATUS:
        <span className="ml-2 text-cyan-300">
          {status}
        </span>
      </div>

      <div className="text-gray-300">
        PATTERNS:
        <span className="ml-2 text-cyan-300">
          {patterns}
        </span>
      </div>

      <div className="text-gray-300">
        SESSION:
        <span className="ml-2 text-green-400">
          ACTIVE
        </span>
      </div>

    </div>
  );
}