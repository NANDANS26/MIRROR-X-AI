import { useState } from "react";

import OverlayCanvas from "../overlay/OverlayCanvas";

import {
  api,
} from "../services/api";
import ChatPanel from "../components/ChatPanel";

export default function HomePage() {
  const [image, setImage] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState("");

  const [patterns, setPatterns] =
    useState<any[]>([]);

  const [sessionId, setSessionId] =
    useState("");

  const handleUpload =
    async () => {
      if (!image) return;

      const token =
        localStorage.getItem(
          "token"
        );

      const formData =
        new FormData();

      formData.append(
        "file",
        image
      );

      const response =
        await api.post(
          "/analysis/upload",
          formData,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      setPatterns(
        response.data.analysis
          .detected_patterns
      );
    };

  return (
    <div className="min-h-screen p-10">
      <h1 className="text-4xl font-bold mb-8">
        MIRROR X AI
      </h1>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file =
            e.target.files?.[0];

          if (!file) return;

          setImage(file);

          setPreview(
            URL.createObjectURL(
              file
            )
          );
        }}
      />

      <button
        onClick={handleUpload}
        className="bg-blue-600 px-6 py-3 rounded-lg ml-4"
      >
        Analyze
      </button>

      <div className="mt-10">
        {preview && (
          <OverlayCanvas
            imageUrl={preview}
            patterns={patterns}
          />
        )}
      </div>
    </div>
  );
}