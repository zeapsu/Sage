import { useState } from "react";
import axios from "axios";
import { ensureDesktopBackend, getApiBaseUrl } from "@/lib/sage-api";

interface SearchProps {
  onResultsReceived: (results: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function KeywordSearch({
  onResultsReceived,
  isLoading,
  setIsLoading,
}: SearchProps) {
  const [keyword, setKeyword] = useState<string>("");
  const endpoint = `${getApiBaseUrl()}/api/keyword/summarize`;

  const handleSearch = async () => {
    if (!keyword.trim()) return;

    try {
      setIsLoading(true);
      await ensureDesktopBackend();

      // Call the endpoint created in the FastAPI backend
      const response = await axios.post(endpoint, {
        keyword: keyword,
        max_results: 2, // Adjust as needed
        max_length: 500,
      });

      // Pass the results to the parent component
      onResultsReceived(response.data.posts);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex items-center border-2 rounded-lg overflow-hidden">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Enter a research topic..."
          className="w-full px-4 py-2 focus:outline-none"
          disabled={isLoading}
        />
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 disabled:bg-blue-300"
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Searching...
            </span>
          ) : (
            "Search"
          )}
        </button>
      </div>
    </div>
  );
}
