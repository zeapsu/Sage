import os

from openai import OpenAI


class DeepSeekService:
    def __init__(self, api_key: str | None = None):
        """
        Initialize the DeepSeek API client.

        Args:
            api_key: DeepSeek API key. If None, will try to get from environment variable.
        """
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        if not self.api_key:
            raise ValueError("DeepSeek API key is required")

        self.client = OpenAI(api_key=self.api_key, base_url="https://api.deepseek.com")

    def summarize_text(self, text: str, max_length: int = 500) -> str | None:
        """
        Summarize text using DeepSeek API.

        Args:
            text: The text to summarize
            max_length: Maximum length of the summary

        Returns:
            Summarized text
        """
        # Create a system prompt that instructs the model to create an Instagram-style summary
        system_prompt = (
            "You are an expert at creating engaging, concise summaries of academic papers. "
            "Create a summary that would be perfect for an Instagram post: informative, "
            "engaging, and accessible to a general audience. Include the key findings and "
            "why they matter. Use simple language and avoid jargon."
        )

        # Create user prompt that includes the text to summarize
        user_prompt = f"Please summarize the following academic paper in a way that would make sense for an Instagram post. Maximum length: {max_length} characters.\n\n{text}"

        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat",  # Using DeepSeek-V3
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                stream=False,
            )

            if not response.choices:
                raise ValueError("No choices returned by DeepSeek API")
            return response.choices[0].message.content

        except Exception as e:
            raise Exception(f"Error summarizing text with DeepSeek API: {str(e)}")
