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
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.google.com/",
          "DNT": "1",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1"
        }
      });

      if (response.status === 403) {
        throw new Error("Access Forbidden: This website blocks automated access. Try a different article or source.");
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText} (${response.status})`);
      }
      const html = await response.text();
      const $ = cheerio.load(html);

      // Basic article extraction logic
      // Remove scripts, styles, nav, footer
      $("script, style, nav, footer, header, aside").remove();

      // Try to find the main content
      let content = $("article").text() || $("main").text() || $("body").text();
      
      // Clean up whitespace
      content = content.replace(/\s+/g, " ").trim();

      // Limit content length for TTS (Gemini TTS has limits, let's keep it reasonable)
      // If it's too long, we'll just take the first 5000 characters for now
      if (content.length > 5000) {
        content = content.substring(0, 5000) + "...";
      }

      res.json({ text: content });
    } catch (error: any) {
      console.error("Extraction error:", error);
      res.status(500).json({ error: error.message });
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
