import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { requireAuth } from "./src/middleware/auth.ts";
import { getOrCreateUser } from "./src/db/users.ts";
import { db } from "./src/db/index.ts";
import { entries, users } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Define API Routes
  app.post("/api/auth/sync", requireAuth, async (req: any, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      res.json(user);
    } catch (error: any) {
      console.error("Failed to sync user:", error);
      res.status(500).json({ error: error.message || "Failed to sync user" });
    }
  });

  app.get("/api/entries", requireAuth, async (req: any, res) => {
    try {
      // Find the integer user id
      const userRecords = await db.select().from(users).where(eq(users.uid, req.user.uid));
      if (userRecords.length === 0) {
        return res.status(404).json({ error: "User not found in DB" });
      }
      
      const userEntries = await db.select().from(entries).where(eq(entries.userId, userRecords[0].id));
      res.json(userEntries);
    } catch (error: any) {
      console.error("Failed to fetch entries:", error);
      res.status(500).json({ error: error.message || "Failed to fetch entries" });
    }
  });

  const isProd = process.env.NODE_ENV === "production";

  // GitHub Asset Proxy: Server missing images directly from GitHub raw content
  // This prevents the workspace from bloating while keeping all photo assets functional
  const proxyGitHubAsset = (basePath: string) => async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Only proxy images/audio to avoid intercepting HTML or API routes
    if (!req.originalUrl.match(/\.(png|jpg|jpeg|gif|webp|mp3|wav|ogg|svg)(\?.*)?$/i)) {
      return next();
    }
    
    // Check if file exists locally first
    const fs = await import('fs');
    
    // originalUrl includes the mount path, e.g. /images/foo.png
    const cleanPath = req.originalUrl.split('?')[0];
    const localPath = path.join(__dirname, 'public', cleanPath);
    
    if (fs.existsSync(localPath)) {
      return next(); // Let Vite or express.static handle it
    }

    // Proxy to GitHub
    const https = await import('https');
    const url = `https://raw.githubusercontent.com/kentheghost777-debug/Creature-Assembler/main${basePath}${cleanPath}`;
    
    https.get(url, (githubRes) => {
      if (githubRes.statusCode !== 200) {
        return next();
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Content-Type', githubRes.headers['content-type'] || 'image/png');
      githubRes.pipe(res);
    }).on('error', () => {
      next();
    });
  };

  app.use('/images', proxyGitHubAsset('/artifacts/mockup-sandbox/public'));
  app.use('/attached_assets', proxyGitHubAsset(''));
  app.use('/audio', proxyGitHubAsset('/artifacts/mockup-sandbox/public'));

  if (!isProd) {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : undefined,
      },
      appType: "spa",
      base: process.env.BASE_PATH || "/",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  const port = 3000;
  app.listen(port, () => {
    console.log(`Server started on port ${port}`);
  });
}

startServer();
