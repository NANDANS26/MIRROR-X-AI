export interface UploadedFile {
  name: string;

  preview: string;
}

export interface ChatMessage {
  id: string;

  role: "user" | "assistant";

  content: string;

  timestamp: string;

  file?: UploadedFile;

  type?:
    | "message"
    | "status"
    | "evidence"
    | "analysis";
}