export type MessageType =
  | "message"
  | "status"
  | "image"
  | "evidence"
  | "score"
  | "report"
  | "spotlight"
  | "replay";

export interface UploadedFile {
  name: string;
  preview: string;
}

export interface ChatMessage {
  id: string;

  role: "user" | "assistant";

  type: MessageType;

  content: string;

  timestamp: string;

  file?: UploadedFile;

  metadata?: any;
}