import axios from "axios";

import FormData from "form-data";

import fs from "fs";

import { ENV } from "../configs/env";

export const analyzeScreenshot =
  async (filePath: string) => {
    const formData = new FormData();

    formData.append(
      "file",
      fs.createReadStream(filePath)
    );

    const response = await axios.post(
      `${ENV.AI_SERVICE_URL}/analyze/upload`,
      formData,
      {
        headers: formData.getHeaders(),
      }
    );

    return response.data;
  };