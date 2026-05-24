import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy endpoint for Yahoo! Shopping API
  app.get("/api/product/:janCode", async (req, res) => {
    const { janCode } = req.params;
    const appId = process.env.YAHOO_APP_ID;

    if (!appId) {
      return res.status(500).json({ error: "YAHOO_APP_ID is not configured" });
    }

    try {
      const url = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${appId}&jan_code=${janCode}`;
      const response = await fetch(url);
      const data = (await response.json()) as any;

      if (data.hits && data.hits.length > 0) {
        const item = data.hits[0];
        const rawName = item.name || "";
        
        // Find the first occurrence of a space (half-width or full-width)
        const spaceMatch = rawName.match(/[\s　]/);
        let maker = item.brand?.name || null;
        let productName = rawName;

        if (spaceMatch && spaceMatch.index !== undefined) {
          maker = rawName.substring(0, spaceMatch.index).trim();
          productName = rawName.substring(spaceMatch.index + 1).trim();
        }

        // Clean product name from multiplier expressions like "×[number][unit]" (e.g. ×24, ×24本, x12)
        const cleanProductName = (name: string): string => {
          if (!name) return "";
          let cleaned = name;
          // Match bracketed multiplier first: (×24), （×24本）, [×24], etc.
          cleaned = cleaned.replace(/[\s　]*[\[\(（][\s　]*[xX×✕✖][\s　]*[0-9０-９]+(?:[a-zA-Z本個コ袋缶つケースパックセット入り数ロール枚足組箱]*)[\]\)）]/gi, "");
          // Match standard multiplier: ×24, × 24本, x12, etc.
          cleaned = cleaned.replace(/[\s　]*[xX×✕✖][\s　]*[0-9０-９]+(?:[a-zA-Z本個コ袋缶つケースパックセット入り数ロール枚足組箱]*)/gi, "");
          return cleaned.trim();
        };

        res.json({
          productName: cleanProductName(productName),
          imageUrl: item.image?.medium,
          maker: maker,
        });
      } else {
        res.status(404).json({ error: "Product not found" });
      }
    } catch (error) {
      console.error("Yahoo API Error:", error);
      res.status(500).json({ error: "Failed to fetch product data" });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
