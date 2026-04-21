import { useState } from "react";
import axios from "axios";
import { ensureDesktopBackend, getApiBaseUrl } from "@/lib/sage-api";

export function useArxivSearch() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPapers = async (
    keyword: string,
    maxResults = 5,
    maxLength = 500,
  ) => {
    if (!keyword.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await ensureDesktopBackend();

      const response = await axios.post(
        `${getApiBaseUrl()}/api/keyword/summarize`,
        {
          keyword,
          max_results: maxResults,
          max_length: maxLength,
        },
      );

      setResults(response.data.posts);
      return response.data.posts;
    } catch (err) {
      console.error("Error searching papers:", err);

      // More specific error messages based on error type
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 404) {
          setError(
            "The API endpoint could not be found. Is the backend server running?",
          );
        } else if (err.response?.status === 500) {
          setError("The server encountered an error. Please try again later.");
        } else if (err.code === "ECONNABORTED") {
          setError("Request timed out. The server might be overloaded.");
        } else if (!err.response) {
          setError(
            "Cannot connect to the server. Please check your internet connection.",
          );
        } else {
          setError(
            `Error: ${err.response.data.detail || "Unknown error occurred"}`,
          );
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }

      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return { results, isLoading, error, searchPapers };
}
