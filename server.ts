import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini Client using the modern @google/genai SDK
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Local in-memory cache to save lookup API calls, speed up scans, and protect quota limit
const janCache = new Map<string, { productName: string; maker: string | null; imageUrl: string | null }>();

// Helper: Query Gemini to find product by JAN code (Pure parametric lookup with Search Grounding as precise backup)
async function findProductWithGemini(janCode: string) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not configured. Cannot perform Gemini Search fallback.");
    return null;
  }

  // Attempt 1: Parametric Lookup (Uses standard text API which has massive quota limits, bypasses search grounding 429 issues)
  try {
    console.log(`[Gemini Fallback - Attempt 1] Running pure parametric model lookup for JAN code: ${janCode}...`);
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `あなたは熟練した日本の流通・EC商品データベース検索機です。
JANコード（バーコード番号）: ${janCode} に1対1で対応する実在する日本の商品情報（具体的な商品名とメーカー名・ブランド名）を、あなたのデータベース知識から推測・検索してください。
JANの事業者コード等から判断して最も確度が高い商品名を出力してください。容量や仕様の情報も加え、すべて日本語で構成してください。

レスポンスは必ず以下のJSONスキーマに従ってください：
{
  "productName": "特定した商品名（例：サントリー伊右衛門 500ml）",
  "maker": "メーカー名またはブランド名（例：サントリー）"
}
どうしても特定できないか自信がない場合のみ、両方を null にしてください。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productName: {
              type: Type.STRING,
              description: "商品名。特定できない場合は null",
            },
            maker: {
              type: Type.STRING,
              description: "メーカー名・ブランド名。特定できない場合は null",
            },
          },
          required: ["productName", "maker"]
        }
      }
    });

    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed.productName && parsed.productName !== "null") {
        console.log(`[Gemini Fallback - Attempt 1 Success]: ${parsed.productName} (${parsed.maker})`);
        return {
          productName: parsed.productName,
          maker: parsed.maker || null,
          imageUrl: null
        };
      }
    }
  } catch (fallbackErr: any) {
    console.warn("Gemini pure parametric search warning:", fallbackErr?.message || fallbackErr);
  }

  // Attempt 2: Search Grounding (Very precise backup, handles newer or highly niche products, wrapped with friendly quota warnings)
  try {
    console.log(`[Gemini Fallback - Attempt 2] Backing up with Google Search Grounding for JAN: ${janCode}...`);
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `JANコード（バーコード番号）: ${janCode} に完全に一致する、日本国内で販売されている既製品の正確な商品名とメーカー名（またはブランド名）を特定してください。
日本第一の市場に合わせて特定し、容量・パック本数などの仕様情報があれば商品名に含めてください。
実在する商品でない場合は、productNameとmakerの両方にnullを設定してください。`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productName: {
              type: Type.STRING,
              description: "商品名。特定できない場合は null",
            },
            maker: {
              type: Type.STRING,
              description: "メーカー名・ブランド名。特定できない場合は null",
            },
          },
          required: ["productName", "maker"]
        }
      }
    });

    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed.productName && parsed.productName !== "null") {
        console.log(`[Gemini Fallback - Attempt 2 Success]: ${parsed.productName} (${parsed.maker})`);
        return {
          productName: parsed.productName,
          maker: parsed.maker || null,
          imageUrl: null
        };
      }
    }
  } catch (err: any) {
    // If the search grounding tool has run out of quota (429/RESOURCE_EXHAUSTED), handle quietly
    const isQuotaExceeded = err?.message?.includes("RESOURCE_EXHAUSTED") || err?.message?.includes("429");
    if (isQuotaExceeded) {
      console.warn(`[Gemini Info] Search grounding is currently limited/exhausted. This is expected behavior on free tiers. Moving on smoothly...`);
    } else {
      console.warn("Gemini search grounding error (Attempt 2 fallback handled):", err?.message || err);
    }
  }

  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy endpoint for Yahoo! Shopping API with Gemini Search Grounding Fallback
  app.get("/api/product/:janCode", async (req, res) => {
    const { janCode } = req.params;
    const appId = process.env.YAHOO_APP_ID;
    const forceSearch = req.query.forceSearch === "true";

    // 0. Check in-memory Cache first to preserve quota and improve speed (unless forced)
    if (janCache.has(janCode) && !forceSearch) {
      const cached = janCache.get(janCode);
      console.log(`[Cache Hit] Returning cached product details for ${janCode}:`, cached);
      return res.json(cached);
    }

    // Helper to try Yahoo! Shopping API
    const tryYahooShopping = async (): Promise<any | null> => {
      const trimmedAppId = appId?.trim();
      if (!trimmedAppId || trimmedAppId === "YOUR_YAHOO_APP_ID" || trimmedAppId === "") {
        console.warn("⚠️ [Yahoo API Notice] YAHOO_APP_ID is not configured in environment variables. Scanning fallback will use Gemini context lookups. To enable official Yahoo lookup from all devices, please configure YAHOO_APP_ID in AI Studio Settings.");
        return null;
      }
      try {
        const maskedAppId = trimmedAppId.length > 8 
          ? `${trimmedAppId.substring(0, 4)}...${trimmedAppId.substring(trimmedAppId.length - 4)}` 
          : "Configured";
        console.log(`[Yahoo API Request] Searching item for JAN Code: ${janCode} using YAHOO_APP_ID: [${maskedAppId}]`);
        
        const url = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${trimmedAppId}&jan_code=${janCode}`;
        const yahooRes = await fetch(url, {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        });

        if (!yahooRes.ok) {
          const errText = await yahooRes.text().catch(() => "");
          console.error(`[Yahoo API Error] HTTP ${yahooRes.status}: ${yahooRes.statusText}. Response: ${errText}`);
          return null;
        }

        const data = (await yahooRes.json()) as any;
        console.log(`[Yahoo API Response] Successfully fetched data. Hits found: ${data.hits?.length || 0}`);

        if (data.hits && data.hits.length > 0) {
          const item = data.hits[0];
          const rawName = item.name || "";
          
          const spaceMatch = rawName.match(/[\s　]/);
          let maker = item.brand?.name || null;
          let productName = rawName;

          if (spaceMatch && spaceMatch.index !== undefined) {
            maker = rawName.substring(0, spaceMatch.index).trim();
            productName = rawName.substring(spaceMatch.index + 1).trim();
          }

          const cleanProductName = (name: string): string => {
            if (!name) return "";
            let cleaned = name;
            cleaned = cleaned.replace(/[\s　]*[\[\(（][\s　]*[xX×✕✖][\s　]*[0-9０-９]+(?:[a-zA-Z本個コ袋缶つケースパックセット入り数ロール枚足組箱]*)[\]\)）]/gi, "");
            cleaned = cleaned.replace(/[\s　]*[xX×✕✖][\s　]*[0-9０-９]+(?:[a-zA-Z本個コ袋缶つケースパックセット入り数ロール枚足組箱]*)/gi, "");
            return cleaned.trim();
          };

          return {
            productName: cleanProductName(productName),
            imageUrl: item.image?.medium || null,
            maker: maker,
          };
        }
      } catch (e) {
        console.error("Yahoo API lookup error:", e);
      }
      return null;
    };

    try {
      // 1. First, attempt to search using Yahoo! Shopping API
      let product = await tryYahooShopping();

      // 2. If not found or if Yahoo API was skipped / failed, use Gemini as fallback
      if (!product) {
        console.log(`Product not found via Yahoo API (or API skipped/disabled). Attempting Gemini Search/Parametric lookups for ${janCode}...`);
        const geminiProduct = await findProductWithGemini(janCode);
        if (geminiProduct) {
          product = geminiProduct;
        }
      }

      // 3. Save to cache and return response or 404
      if (product) {
        janCache.set(janCode, product);
        return res.json(product);
      } else {
        return res.status(404).json({ error: "Product not found across references." });
      }
    } catch (error) {
      console.error("API Route Error:", error);
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
