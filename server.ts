import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import db from "./db.js"; // Use .js extension for ESM
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Middleware to verify JWT
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, displayName } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const id = uuidv4();
      const role = email === "huynofa@gmail.com" ? "admin" : "user"; // Default admin from runtime context
      
      const insert = db.prepare('INSERT INTO users (id, email, password, displayName, role) VALUES (?, ?, ?, ?, ?)');
      insert.run(id, email, hashedPassword, displayName || email.split('@')[0], role);
      
      const token = jwt.sign({ id, email, role }, JWT_SECRET);
      res.json({ token, user: { id, email, displayName, role, balance: 0, discount: 0 } });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ error: "Email already in use" });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
      res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, balance: user.balance, discount: user.discount } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // User Profile
  app.get("/api/user/profile", authenticateToken, (req: any, res) => {
    const user: any = db.prepare('SELECT id, email, displayName, balance, discount, role, createdAt FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
  });

  // Transactions
  app.get("/api/user/transactions", authenticateToken, (req: any, res) => {
    const transactions = db.prepare('SELECT * FROM transactions WHERE userId = ? ORDER BY createdAt DESC').all(req.user.id);
    res.json(transactions);
  });

  // Proxies
  app.get("/api/user/proxies", authenticateToken, (req: any, res) => {
    const proxies = db.prepare('SELECT * FROM proxies WHERE userId = ? ORDER BY createdAt DESC').all(req.user.id);
    res.json(proxies);
  });

  // Settings
  app.get("/api/settings", (req, res) => {
    const settings = db.prepare('SELECT * FROM settings').all();
    const settingsMap = settings.reduce((acc: any, curr: any) => {
      let val = curr.value;
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (curr.key === 'priceMarkup') val = parseFloat(val) || 0;
      acc[curr.key] = val;
      return acc;
    }, {});
    res.json(settingsMap);
  });

  // Admin Routes
  app.get("/api/admin/users", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const users = db.prepare('SELECT id, email, displayName, balance, discount, role, createdAt FROM users').all();
    res.json(users);
  });

  app.post("/api/admin/user/update", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { userId, balance, discount, displayName } = req.body;
    try {
      db.prepare('UPDATE users SET balance = ?, discount = ?, displayName = ? WHERE id = ?').run(balance, discount, displayName, userId);
      res.json({ status: "success" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/settings/update", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const updates = req.body;
    try {
      const updateStmt = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
      for (const [key, value] of Object.entries(updates)) {
        updateStmt.run(value?.toString(), key);
      }
      res.json({ status: "success" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Deposit (Mock)
  app.post("/api/deposit", authenticateToken, (req: any, res) => {
    const { amount } = req.body;
    try {
      db.transaction(() => {
        db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, req.user.id);
        db.prepare('INSERT INTO transactions (id, userId, amount, type, status, description) VALUES (?, ?, ?, ?, ?, ?)')
          .run(uuidv4(), req.user.id, amount, 'deposit', 'success', `Nạp tiền qua hệ thống: ${amount.toLocaleString()}đ`);
      })();
      res.json({ status: "success" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy Order
  app.post("/api/proxy/order", authenticateToken, async (req: any, res) => {
    const { numProxy, soNgay, usernameproxy, passwordproxy, tinhtrangproxy, totalPrice } = req.body;
    const userId = req.user.id;

    try {
      const user: any = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
      if (!user || user.balance < totalPrice) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      const apiResponse = await axios.post("https://proxynuoinick.com/api/api/tasks/start", req.body);
      
      if (apiResponse.data.status === 'success' || apiResponse.data.success) {
        db.transaction(() => {
          // Deduct balance
          db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(totalPrice, userId);

          // Transaction record
          db.prepare('INSERT INTO transactions (id, userId, amount, type, status, description) VALUES (?, ?, ?, ?, ?, ?)')
            .run(uuidv4(), userId, -totalPrice, 'purchase', 'success', `Mua ${numProxy} Proxy - ${soNgay} ngày`);

          // Proxy assets
          for (let i = 0; i < numProxy; i++) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + parseInt(soNgay));
            
            db.prepare('INSERT INTO proxies (id, userId, ip, port, username, password, type, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .run(
                uuidv4(),
                userId,
                `103.153.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                8080 + i,
                usernameproxy,
                passwordproxy,
                tinhtrangproxy,
                expiresAt.toISOString()
              );
          }
        })();

        res.json({ status: "success", message: "Order processed successfully", data: apiResponse.data });
      } else {
        res.status(400).json({ error: apiResponse.data.message || "API failed to process order" });
      }
    } catch (error: any) {
      console.error("API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        error: "Failed to process order",
        details: error.response?.data || error.message
      });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
