import type {
    DetectedPattern,
} from "../types/analysis";

interface Props {
  imageUrl: string;

  patterns: DetectedPattern[];
}

const getColor = (
  confidence:
    | "Low"
    | "Medium"
    | "High"
) => {
  if (confidence === "High") {
    return "#EF4444";
  }

  if (confidence === "Medium") {
    return "#F59E0B";
  }

  return "#EAB308";
};

export default function OverlayCanvas({
  imageUrl,
  patterns,
}: Props) {
  return (
    <div className="relative w-fit">
      <img
        src={imageUrl}
        alt="analysis"
        className="max-w-full rounded-xl"
      />

      {patterns.map(
        (pattern, index) => {
          if (
            !pattern.bounding_box
          ) {
            return null;
          }

          return (
            <div
              key={index}
              className="absolute"
              style={{
                left:
                  pattern.bounding_box.x,

                top:
                  pattern.bounding_box.y,

                width:
                  pattern.bounding_box.width,

                height:
                  pattern.bounding_box.height,

                border: `2px solid ${getColor(
                  pattern.confidence_level
                )}`,

                pointerEvents:
                  "none",
              }}
            />
          );
        }
      )}
    </div>
  );
}