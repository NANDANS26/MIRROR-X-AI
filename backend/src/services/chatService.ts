import axios from "axios";

import { ENV } from "../configs/env";

export const askAI =
  async (
    sessionContext: any,
    userMessage: string
  ) => {
    const response =
      await axios.post(
        `${ENV.AI_SERVICE_URL}/chat/explain`,
        {
          session_context:
            sessionContext,

          user_message:
            userMessage,
        }
      );

    return response.data;
  };