export interface InvestigationEvent {
  id: string;

  title: string;

  status:
    | "pending"
    | "running"
    | "completed";

  timestamp: string;
}