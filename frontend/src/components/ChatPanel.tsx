import {
  useState,
} from "react";

import { api } from "../services/api";

interface Props {
  sessionId: string;
}

export default function ChatPanel({
  sessionId,
}: Props) {
  const [message, setMessage] =
    useState("");

  const [response, setResponse] =
    useState("");

  const askQuestion =
    async () => {
      const token =
        localStorage.getItem(
          "token"
        );

      const result =
        await api.post(
          `/chat/${sessionId}`,
          {
            message,
          },
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      setResponse(
        result.data.response
      );
    };

  return (
    <div className="mt-10 bg-slate-900 p-6 rounded-xl">
      <h2 className="text-2xl mb-4">
        AI Assistant
      </h2>

      <textarea
        value={message}
        onChange={(e) =>
          setMessage(
            e.target.value
          )
        }
        className="w-full h-32 bg-slate-800 p-4 rounded-lg"
        placeholder="Ask about the analysis..."
      />

      <button
        onClick={askQuestion}
        className="mt-4 bg-blue-600 px-5 py-2 rounded-lg"
      >
        Ask AI
      </button>

      {response && (
        <div className="mt-6 bg-slate-800 p-4 rounded-lg whitespace-pre-wrap">
          {response}
        </div>
      )}
    </div>
  );
}