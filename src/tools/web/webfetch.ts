import { Tool, ToolDefinition, ToolResult } from "../index.js";

// ==========================================
// WebFetch Tool
// ==========================================

export class WebFetchTool extends Tool {
  readonly definition: ToolDefinition = {
    name: "webfetch",
    description: "Fetch content from a URL. Returns the page content in markdown, text, or HTML format.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch (must be a fully-formed valid URL).",
        },
        format: {
          type: "string",
          description: "Response format: 'markdown' (default), 'text', or 'html'.",
          enum: ["markdown", "text", "html"],
        },
        timeout: {
          type: "number",
          description: "Request timeout in seconds (default: 30).",
        },
      },
      required: ["url"],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const url = args.url as string;
    const format = (args.format as string) || "markdown";
    const timeout = (args.timeout as number) || 30;

    try {
      // Validate URL
      new URL(url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Deepcode/0.1.0 (Termux CLI)",
          Accept: "text/html,text/plain,*/*",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { output: "", error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const contentType = response.headers.get("content-type") || "";
      const rawText = await response.text();

      let output: string;

      if (format === "html") {
        output = rawText;
      } else if (format === "text") {
        output = this.htmlToText(rawText);
      } else {
        // Markdown - simple HTML to markdown conversion
        output = this.htmlToMarkdown(rawText);
      }

      // Truncate if too long
      const maxChars = 50000;
      if (output.length > maxChars) {
        output = output.slice(0, maxChars) + `\n\n(Truncated: ${output.length} chars total)`;
      }

      return {
        output: `URL: ${url}\nContent-Type: ${contentType}\nLength: ${output.length} chars\n\n${output}`,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { output: "", error: `Request timed out after ${timeout}s` };
      }
      return {
        output: "",
        error: `Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private htmlToMarkdown(html: string): string {
    let md = html;

    // Remove scripts and styles
    md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

    // Headers
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
    md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
    md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
    md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

    // Bold and italic
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
    md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
    md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

    // Links
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

    // Images
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, "![$2]($1)");
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "![]($1)");

    // Code blocks
    md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "```\n$1\n```\n");
    md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");

    // Lists
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
    md = md.replace(/<\/?[uo]l[^>]*>/gi, "\n");

    // Paragraphs and breaks
    md = md.replace(/<br[^>]*>/gi, "\n");
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
    md = md.replace(/<div[^>]*>(.*?)<\/div>/gi, "$1\n");

    // Blockquotes
    md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, "> $1\n");

    // Horizontal rules
    md = md.replace(/<hr[^>]*>/gi, "\n---\n");

    // Strip remaining tags
    md = md.replace(/<[^>]+>/g, "");

    // Decode HTML entities
    md = md.replace(/&amp;/g, "&");
    md = md.replace(/&lt;/g, "<");
    md = md.replace(/&gt;/g, ">");
    md = md.replace(/&quot;/g, '"');
    md = md.replace(/&#39;/g, "'");
    md = md.replace(/&nbsp;/g, " ");

    // Clean up whitespace
    md = md.replace(/\n{3,}/g, "\n\n");
    md = md.trim();

    return md;
  }
}
