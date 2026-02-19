import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import session from "express-session";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("sewu_frame.db");

// Initialize database with user support and customizable settings
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE,
    email TEXT UNIQUE,
    name TEXT,
    access_token TEXT,
    refresh_token TEXT,
    settings TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT CHECK(type IN ('income', 'expense')),
    amount REAL NOT NULL,
    units INTEGER DEFAULT 1,
    unit_price REAL,
    category TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    type TEXT DEFAULT 'income',
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/auth/callback`
);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || "sewu-frame-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: true, 
      sameSite: 'none',
      httpOnly: true 
    }
  }));

  // Auth Middleware
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.session.userId) return next();
    res.status(401).json({ error: "Unauthorized" });
  };

  // Auth Routes
  app.get("/api/auth/url", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
      prompt: "consent"
    });
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const { data } = await oauth2.userinfo.get();

      let user = db.prepare("SELECT * FROM users WHERE google_id = ?").get(data.id);
      
      if (!user) {
        const info = db.prepare(
          "INSERT INTO users (google_id, email, name, access_token, refresh_token, settings) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(
          data.id, 
          data.email, 
          data.name, 
          tokens.access_token, 
          tokens.refresh_token,
          JSON.stringify({
            targetSales: 5000000,
            items: [
              { name: "Caffe Namuin", price: 30000, type: "income" },
              { name: "Maliosewu", price: 25000, type: "income" },
              { name: "Sesi Foto", price: 20000, type: "income" },
              { name: "Extra Print", price: 10000, type: "income" }
            ]
          })
        );
        user = { id: info.lastInsertRowid };
      } else {
        db.prepare("UPDATE users SET access_token = ?, refresh_token = ? WHERE id = ?")
          .run(tokens.access_token, tokens.refresh_token || user.refresh_token, user.id);
      }

      req.session.userId = user.id;
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Auth error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/api/me", (req: any, res) => {
    if (!req.session.userId) return res.json({ user: null });
    const user = db.prepare("SELECT id, email, name, settings FROM users WHERE id = ?").get(req.session.userId);
    if (user) user.settings = JSON.parse(user.settings);
    res.json({ user });
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // Transaction Routes
  app.get("/api/transactions", isAuthenticated, (req: any, res) => {
    const transactions = db.prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC").all(req.session.userId);
    res.json(transactions);
  });

  app.post("/api/transactions", isAuthenticated, async (req: any, res) => {
    const { type, amount, units, unit_price, category, description, date } = req.body;
    const info = db.prepare(
      "INSERT INTO transactions (user_id, type, amount, units, unit_price, category, description, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(req.session.userId, type, amount, units, unit_price, category, description, date);
    
    // Optional: Sync to Google Sheets if user has tokens
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
    if (user.refresh_token) {
      // Logic to sync to sheets could go here or be triggered manually
    }

    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/transactions/:id", isAuthenticated, (req: any, res) => {
    db.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?").run(req.params.id, req.session.userId);
    res.json({ success: true });
  });

  app.get("/api/summary", isAuthenticated, (req: any, res) => {
    const summary = db.prepare(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense
      FROM transactions
      WHERE user_id = ?
    `).get(req.session.userId);
    res.json(summary);
  });

  app.post("/api/settings", isAuthenticated, (req: any, res) => {
    const { settings } = req.body;
    db.prepare("UPDATE users SET settings = ? WHERE id = ?").run(JSON.stringify(settings), req.session.userId);
    res.json({ success: true });
  });

  app.post("/api/export-sheets", isAuthenticated, async (req: any, res) => {
    try {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
      if (!user.access_token) return res.status(400).json({ error: "No Google account linked" });

      oauth2Client.setCredentials({
        access_token: user.access_token,
        refresh_token: user.refresh_token
      });

      const sheets = google.sheets({ version: "v4", auth: oauth2Client });
      
      // Create a new spreadsheet
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: `Laporan Keuangan Sewu Frame - ${new Date().toLocaleDateString()}` }
        }
      });

      const spreadsheetId = spreadsheet.data.spreadsheetId;
      const transactions = db.prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY date ASC").all(req.session.userId);

      const rows = [
        ["Tanggal", "Tipe", "Kategori", "Unit", "Harga Satuan", "Total", "Deskripsi"],
        ...transactions.map((t: any) => [
          t.date,
          t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
          t.category,
          t.units,
          t.unit_price,
          t.amount,
          t.description
        ])
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId!,
        range: "Sheet1!A1",
        valueInputOption: "RAW",
        requestBody: { values: rows }
      });

      res.json({ url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}` });
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export to Google Sheets" });
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
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
