import { Tool, ToolDefinition, ToolResult } from "../index.js";

// ==========================================
// WebSearch Tool
// ==========================================

export class WebSearchTool extends Tool {
  readonly definition: ToolDefinition = {
    name: "websearch",
    description: "Search the web using a search engine. Returns relevant search results with titles, URLs, and snippets.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query.",
        },
        numResults: {
          type: "number",
          description: "Number of results to return (default: 5, max: 10).",
        },
        type: {
          type: "string",
          description: "Search type: 'auto' (balanced), 'fast' (quick results), 'deep' (comprehensive).",
          enum: ["auto", "fast", "deep"],
        },
      },
      required: ["query"],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const query = args.query as string;
    const numResults = Math.min((args.numResults as number) || 5, 10);
    const type = (args.type as string) || "auto";

    try {
      // Use DuckDuckGo Lite as a free, no-API-key search option
      const results = await this.searchDuckDuckGo(query, numResults);

      if (results.length === 0) {
        return { output: `No results found for: ${query}` };
      }

      const output = results
        .map((r, i) => {
          return `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`;
        })
        .join("\n\n");

      return {
        output: `Search results for: "${query}"\n\n${output}`,
      };
    } catch (error) {
      return {
        output: "",
        error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async searchDuckDuckGo(
    query: string,
    numResults: number
  ): Promise<Array<{ title: string; url: string; snippet: string }>> {
    const results: Array<{ title: string; url: string; snippet: string }> = [];

    try {
      // DuckDuckGo Lite HTML version
      const params = new URLSearchParams({
        q: query,
        kl: "us-en",
      });

      const response = await fetch(`https://lite.duckduckgo.com/lite/?${params}`, {
        headers: {
          "User-Agent": "Deepcode/0.1.0 (Termux CLI)",
        },
      });

      if (!response.ok) {
        throw new Error(`Search engine returned ${response.status}`);
      }

      const html = await response.text();

      // Parse results from DuckDuckGo Lite HTML
      // Format: <a rel="nofollow" class="result-link" href="URL">TITLE</a>
      //         <td class="result-snippet">SNIPPET</td>
      const linkRegex = /<a[^>]*class="result-link"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
      const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

      const links: Array<{ url: string; title: string }> = [];
      const snippets: string[] = [];

      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        links.push({
          url: match[1],
          title: this.decodeHtmlEntities(match[2].replace(/<[^>]+>/g, "").trim()),
        });
      }

      while ((match = snippetRegex.exec(html)) !== null) {
        snippets.push(this.decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "").trim()));
      }

      for (let i = 0; i < Math.min(links.length, numResults); i++) {
        results.push({
          title: links[i].title,
          url: links[i].url,
          snippet: snippets[i] || "No description available",
        });
      }
    } catch (error) {
      // Fallback: return a helpful message
      results.push({
        title: "Search Error",
        url: "",
        snippet: `Could not perform web search: ${error instanceof Error ? error.message : String(error)}. Try using webfetch to access specific URLs directly.`,
      });
    }

    return results;
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  }
}
