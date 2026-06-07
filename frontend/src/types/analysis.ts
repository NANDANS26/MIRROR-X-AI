export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface DetectedPattern {
  category: string
  element_identifier: string
  confidence_level: 'Low' | 'Medium' | 'High'
  explanation: string
  bounding_box?: BoundingBox | null
}

export interface AnalysisScores {
  manipulation_score: number
  trust_score: number
  friction_score?: number
  ux_fairness_index: string
}

export interface SimulationResult {
  persona: string
  behavioral_summary: string
  [key: string]: any
}

export interface AnalysisResult {
  detected_patterns: DetectedPattern[]
  scores: AnalysisScores
  simulation_results?: SimulationResult[]
  ai_analysis: string
  original_image?: string
}
