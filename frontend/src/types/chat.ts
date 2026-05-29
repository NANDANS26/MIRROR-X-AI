export type MessageRole =
  | "user"
  | "assistant"
  | "system";

export type MessageType =
  | "text"
  | "investigation"
  | "evidence"
  | "score"
  | "report";

export interface ChatMessage {
  id: string;

  role: MessageRole;

  type: MessageType;

  content: string;

  timestamp: string;
}

export interface ChatSession {
  id: string;

  title: string;

  createdAt: string;

  messages: ChatMessage[];
}