export interface InvestigationPattern {
  category: string;
  explanation: string;
  confidence?: number;
}

export interface InvestigationScores {
  manipulation_score: number;
  trust_score: number;
  ux_fairness_index: string;
}

export interface InvestigationSession {
  image?: string;

  analysis?: any;

  patterns: InvestigationPattern[];

  scores?: InvestigationScores;

  report?: string;

  createdAt: string;
}