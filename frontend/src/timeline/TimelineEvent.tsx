interface Props {
  timestamp: string;

  message: string;
}

export default function TimelineEvent({
  timestamp,
  message,
}: Props) {
  return (
    <div className="flex gap-4 text-sm">
      <span className="text-cyan-500 min-w-[80px]">
        {timestamp}
      </span>

      <span className="text-gray-300">
        {message}
      </span>
    </div>
  );
}