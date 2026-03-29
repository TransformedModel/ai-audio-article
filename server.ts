import express from "express";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import fetch from "node-fetch";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route to fetch and extract article content
  app.post("/api/extract", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"macOS"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1"
        }
      }).finally(() => clearTimeout(timeout));

      if (response.status === 403) {
        throw new Error("Access Forbidden: This website blocks automated access.");
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText} (${response.status})`);
      }
      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove non-content elements
      $("script, style, nav, footer, header, aside, .ads, .sidebar, .menu, .nav, .footer").remove();

      // Targeted extraction for common article structures
      let content = "";
      
      // Order of preference for content containers
      const selectors = [
        "article",
        '[itemprop="articleBody"]',
        ".article-content",
        ".post-content",
        ".entry-content",
        "main",
        "#main-content",
        ".main-content"
      ];

      for (const selector of selectors) {
        const element = $(selector);
        if (element.length > 0) {
          // Get text from paragraphs to avoid junk
          const paragraphs = element.find("p");
          if (paragraphs.length > 0) {
            content = paragraphs.map((_, el) => $(el).text()).get().join("\n\n");
          } else {
            content = element.text();
          }
          if (content.trim().length > 200) break;
        }
      }

      // Fallback to body if no specific container found or content too short
      if (!content || content.trim().length < 200) {
        content = $("body").find("p").map((_, el) => $(el).text()).get().join("\n\n");
      }
      
      // Clean up whitespace
      content = content.replace(/\s+/g, " ").trim();

      if (!content || content.length < 100) {
        throw new Error("Could not extract meaningful content from this page.");
      }

      // Limit content length for TTS
      if (content.length > 8000) {
        content = content.substring(0, 8000) + "...";
      }

      res.json({ text: content });
    } catch (error: any) {
      console.error("Extraction error:", error);
      
      let status = 500;
      let message = error.message;

      if (error.name === 'AbortError') {
        status = 408;
        message = "Request timed out. The website is taking too long to respond.";
      } else if (error.message.includes('(') && error.message.includes(')')) {
        // Extract status code from our custom error message if present
        const match = error.message.match(/\((\d+)\)/);
        if (match) {
          status = parseInt(match[1]);
        }
      }

      res.status(status).json({ error: message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
