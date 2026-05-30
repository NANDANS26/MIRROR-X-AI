interface Props {
  score: number;

  trust: number;

  fairness: string;
}

export default function ScoreNarrative({
  score,
  trust,
  fairness,
}: Props) {
  return (
    <div className="mt-3 rounded-xl border border-purple-500/20 bg-[#111827] p-4">
      <div className="text-sm text-purple-300">
        Manipulation Score
      </div>

      <div className="text-4xl font-bold mt-1">
        {score}
      </div>

      <div className="mt-3 text-sm text-gray-300">
        Trust Score: {trust}
      </div>

      <div className="mt-2 text-sm">
        UX Fairness: {fairness}
      </div>
    </div>
  );
}