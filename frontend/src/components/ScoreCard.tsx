interface Props {
  scores: {
    manipulation_score: number;

    trust_score: number;

    friction_score: number;

    ux_fairness_index: string;
  };
}

export default function ScoreCard({
  scores,
}: Props) {
  return (
    <div className="bg-slate-900 p-6 rounded-xl mt-10">
      <h2 className="text-3xl font-bold mb-6">
        Risk Intelligence
      </h2>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-800 p-4 rounded-lg">
          <h3 className="text-lg">
            Manipulation Score
          </h3>

          <p className="text-4xl font-bold text-red-500">
            {
              scores.manipulation_score
            }
          </p>
        </div>

        <div className="bg-slate-800 p-4 rounded-lg">
          <h3 className="text-lg">
            Trust Score
          </h3>

          <p className="text-4xl font-bold text-green-500">
            {
              scores.trust_score
            }
          </p>
        </div>

        <div className="bg-slate-800 p-4 rounded-lg">
          <h3 className="text-lg">
            Friction Score
          </h3>

          <p className="text-4xl font-bold text-yellow-500">
            {
              scores.friction_score
            }
          </p>
        </div>

        <div className="bg-slate-800 p-4 rounded-lg">
          <h3 className="text-lg">
            UX Fairness
          </h3>

          <p className="text-2xl font-bold">
            {
              scores.ux_fairness_index
            }
          </p>
        </div>
      </div>
    </div>
  );
}