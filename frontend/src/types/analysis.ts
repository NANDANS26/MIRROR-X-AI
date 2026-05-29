export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedPattern {
  category: string;

  element_identifier: string;

  confidence_level:
    | "Low"
    | "Medium"
    | "High";

  explanation: string;

  bounding_box?: BoundingBox;
}