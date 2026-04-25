function readTavilyApiKey(): string {
  return process.env.TAVILY_API_KEY || "";
}

export function validateSerpApiSetup(): { valid: boolean; error?: string } {
  const apiKey = readTavilyApiKey();
  if (!apiKey) {
    return { valid: false, error: "TAVILY_API_KEY environment variable is not set" };
  }
  return { valid: true };
}

export async function searchWeb(query: string, numResults: number = 5): Promise<string> {
  const apiKey = readTavilyApiKey();
  if (!apiKey) throw new Error("Tavily API key not configured");

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: numResults,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];
    const formatted = results.slice(0, numResults).map((result: any, index: number) => {
      return `${index + 1}. ${result.title}\n   ${result.url}\n   ${result.content}\n`;
    }).join('\n');

    return `Web search results for "${query}":\n\n${formatted}`;
  } catch (error) {
    console.error('Tavily search failed:', error);
    return `Unable to perform web search for "${query}".`;
  }
}