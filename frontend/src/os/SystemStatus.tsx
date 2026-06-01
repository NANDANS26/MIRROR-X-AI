interface Props {
  status: string;

  patterns: number;
}

export default function SystemStatus({
  status,
  patterns,
}: Props) {
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-[#0B1220] p-5">
      <div className="text-cyan-400 text-xs tracking-[0.3em]">
        MIRROR X ONLINE
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div>
          STATUS:
          <span className="ml-2 text-cyan-300">
            {status}
          </span>
        </div>

        <div>
          PATTERNS FOUND:
          <span className="ml-2 text-cyan-300">
            {patterns}
          </span>
        </div>

        <div>
          SESSION:
          <span className="ml-2 text-green-400">
            ACTIVE
          </span>
        </div>
      </div>
    </div>
  );
}