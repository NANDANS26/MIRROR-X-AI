import {
  useChatStore,
} from "../store/chatStore";

import {
  uploadForAnalysis,
} from "../services/analysisService";

import {
  createNarrativeMessages,
} from "../services/investigationNarrator";

export const useInvestigation =
  () => {
    const addMessage =
      useChatStore(
        (state) =>
          state.addMessage
      );

    const setTyping =
      useChatStore(
        (state) =>
          state.setTyping
      );

    const startInvestigation =
      async (
        file: File
      ) => {
        const token =
          localStorage.getItem(
            "token"
          );

        if (!token) {
          addMessage({
            id:
              crypto.randomUUID(),

            role:
              "assistant",

            type:
              "message",

            content:
              "Authentication required.",

            timestamp:
              new Date()
                .toISOString(),
          });

          return;
        }

        try {
          setTyping(true);

          addMessage({
            id:
              crypto.randomUUID(),

            role:
              "assistant",

            type:
              "status",

            content:
              "Scanning interface structure...",

            timestamp:
              new Date()
                .toISOString(),
          });

          const result =
            await uploadForAnalysis(
              file,
              token
            );

          const narrative =
            createNarrativeMessages(
              result.analysis
            );

          narrative.forEach(
            (message, index) => {
              setTimeout(() => {
                addMessage(
                  message
                );
              }, index * 800);
            }
          );

          setTyping(false);

          return result;
        } catch (error) {
          setTyping(false);

          addMessage({
            id:
              crypto.randomUUID(),

            role:
              "assistant",

            type:
              "message",

            content:
              "Investigation failed. Please try again.",

            timestamp:
              new Date()
                .toISOString(),
          });
        }
      };

    return {
      startInvestigation,
    };
  };