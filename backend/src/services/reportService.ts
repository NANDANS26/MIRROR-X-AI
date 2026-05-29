import axios from "axios";

import { ENV } from "../configs/env";

export const generateReport =
  async (
    sessionId: string,
    analysisResult: any
  ) => {
    const response =
      await axios.post(
        `${ENV.AI_SERVICE_URL}/report/generate`,
        {
          session_id: sessionId,

          analysis_result:
            analysisResult,
        }
      );

    return response.data;
  };