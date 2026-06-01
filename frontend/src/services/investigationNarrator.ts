import type { ChatMessage } from "../types/chat";

export const createNarrativeMessages =
  (analysis: any): ChatMessage[] => {
    const messages: ChatMessage[] = [];

    messages.push({
      id: crypto.randomUUID(),

      role: "assistant",

      type: "message",

      content:
        "Investigation complete. I identified several behavioral signals worth examining.",

      timestamp:
        new Date().toISOString(),
    });

    const patterns =
      analysis.detected_patterns || [];

    for (const pattern of patterns) {
      messages.push({
        id:
          crypto.randomUUID(),

        role:
          "assistant",

        type:
          "spotlight",

        content: "",

        timestamp:
          new Date()
            .toISOString(),

        metadata: {
          image:
            analysis.original_image ||
            "",

          explanation:
            pattern.explanation,
        },
      });
      messages.push({
        id:
          crypto.randomUUID(),

        role:
          "assistant",

        type:
          "evidence",

        content:
          `I found a **${pattern.category}** signal.\n\n${pattern.explanation}`,

        timestamp:
          new Date()
            .toISOString(),

        metadata:
          pattern,
      });
    }

    if (analysis.scores) {
      messages.push({
        id:
          crypto.randomUUID(),

        role:
          "assistant",

        type:
          "score",

        content:
          `I assigned a manipulation score of **${analysis.scores.manipulation_score}** and a trust score of **${analysis.scores.trust_score}**.`,

        timestamp:
          new Date()
            .toISOString(),

        metadata:
          analysis.scores,
      });
    }

    messages.push({
      id:
        crypto.randomUUID(),

      role:
        "assistant",

      type:
        "message",

      content:
        analysis.ai_analysis,

      timestamp:
        new Date()
          .toISOString(),
    });

    messages.push({
      id:
        crypto.randomUUID(),

      role:
        "assistant",

      type:
        "message",

      content:
        "You can ask me to explain a finding, highlight suspicious regions, compare patterns, or prepare a forensic report.",

      timestamp:
        new Date()
          .toISOString(),
    });

    return messages;
  };