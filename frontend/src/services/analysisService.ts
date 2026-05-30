import axios from "axios";

const API =
  "http://localhost:3001/api";

export const uploadForAnalysis =
  async (
    file: File,
    token: string
  ) => {
    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    const response =
      await axios.post(
        `${API}/analysis/upload`,
        formData,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    return response.data;
  };