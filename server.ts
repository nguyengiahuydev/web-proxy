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
      else if (['priceMarkup', 'basePrice', 'rotatingSurcharge'].includes(curr.key)) val = parseFloat(val) || 0;
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
      const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && value !== null) {
          updateStmt.run(key, value.toString());
        }
      }
      res.json({ status: "success" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bank API Polling
  const BANK_PASSWORD = process.env.BANK_PASSWORD || "Giahuy@123";
  const BANK_ACCOUNT = process.env.BANK_ACCOUNT || "0355656730";
  const BANK_TOKEN = process.env.BANK_TOKEN || "48E1EDB4-347A-24C0-A43B-43B5201CF8E3";
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  const sendTelegramMessage = async (message: string) => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    try {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      });
    } catch (error: any) {
      console.error("Telegram Error:", error.message);
    }
  };

  const checkBankHistory = async () => {
    try {
      const response = await axios.get(`https://api.web2m.com/historyapimb/${BANK_PASSWORD}/${BANK_ACCOUNT}/${BANK_TOKEN}`);
      if (response.data.success && response.data.data) {
        for (const tx of response.data.data) {
          const amount = parseFloat(tx.creditAmount);
          if (amount > 0) {
            const description = tx.description.toUpperCase();
            // Match "NAP <userId_first_8>"
            const match = description.match(/NAP\s+([A-Z0-9]{8})/);
            if (match) {
              const shortId = match[1];
              // Find user with this shortId (first 8 chars of UUID)
              const user: any = db.prepare('SELECT id FROM users WHERE id LIKE ?').get(`${shortId}%`);
              if (user) {
                // Check if this transaction refNo was already processed
                const existingTx = db.prepare('SELECT id FROM transactions WHERE description LIKE ? AND status = ?').get(`%${tx.refNo}%`, 'success');
                if (!existingTx) {
                  db.transaction(() => {
                    const txId = uuidv4();
                    db.prepare('INSERT INTO transactions (id, userId, amount, type, status, description) VALUES (?, ?, ?, ?, ?, ?)')
                      .run(txId, user.id, amount, 'deposit', 'success', `Nạp tiền tự động (Bank): ${amount.toLocaleString()}đ - Ref: ${tx.refNo} - Nội dung: ${description}`);
                    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, user.id);
                  })();
                  console.log(`Auto-approved deposit for user ${user.id}: ${amount}đ`);
                  
                  // Send Telegram notification
                  const telegramMsg = `<b>💰 NẠP TIỀN THÀNH CÔNG</b>\n\n` +
                    `👤 User ID: <code>${user.id}</code>\n` +
                    `💵 Số tiền: <b>${amount.toLocaleString()}đ</b>\n` +
                    `📝 Nội dung: <code>${description}</code>\n` +
                    `🆔 Ref: <code>${tx.refNo}</code>\n` +
                    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}`;
                  sendTelegramMessage(telegramMsg);
                }
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Bank API Error:", error.message);
    }
  };

  setInterval(checkBankHistory, 60000); // Check every minute

  // Web-triggerable cron endpoint
  app.get("/api/cron/bank", async (req, res) => {
    try {
      await checkBankHistory();
      res.json({ status: "success", message: "Bank history check triggered" });
    } catch (error: any) {
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  // Serve cron.php as a trigger (even if it's just Node.js behind it)
  app.get("/cron.php", async (req, res) => {
    try {
      await checkBankHistory();
      res.send(`
        <html>
          <body style="font-family: sans-serif; padding: 20px; background: #121214; color: #fff;">
            <h2 style="color: #6366f1;">--- Đang bắt đầu kiểm tra lịch sử ngân hàng ---</h2>
            <p><strong>Trạng thái:</strong> Thành công</p>
            <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
            <p>Hệ thống đã kiểm tra và tự động duyệt các giao dịch nạp tiền khớp nội dung.</p>
            <hr style="border: 0; border-top: 1px solid #333; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© 2026 PROXYPRO. All rights reserved.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      res.status(500).send(`Lỗi: ${error.message}`);
    }
  });

  app.post("/api/admin/transaction/approve", authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { transactionId } = req.body;
    try {
      db.transaction(() => {
        const tx: any = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
        if (!tx || tx.status !== 'pending') {
          throw new Error("Transaction not found or already processed");
        }
        
        // Update transaction status
        db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run('success', transactionId);
        
        // If it was a deposit, update user balance
        if (tx.type === 'deposit') {
          db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(tx.amount, tx.userId);
        }
      })();
      res.json({ status: "success" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Deposit (Request)
  app.post("/api/deposit", authenticateToken, (req: any, res) => {
    const { amount } = req.body;
    try {
      db.prepare('INSERT INTO transactions (id, userId, amount, type, status, description) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), req.user.id, amount, 'deposit', 'pending', `Yêu cầu nạp tiền: ${amount.toLocaleString()}đ`);
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

      const externalApiToken = process.env.EXTERNAL_PROXY_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1lIjoiMDM1NTY1NjczMCIsImlwIjoiMTcyLjcxLjIxNC4xNDciLCJleHAiOjE3NzI2NTg1ODl9.mx_Y_OiXQNxB7uuWieEnXRaODwCpKKKtuVYkpccyzJo';
      
      const apiResponse = await axios.post("https://proxynuoinick.com/api/api/tasks/start", {
        userId: "0355656730",
        numProxy: parseInt(numProxy),
        passwordproxy: passwordproxy || "0355656730",
        usernameproxy: usernameproxy || "0355656730",
        tinhtrangproxy: tinhtrangproxy || "Không xoay",
        thoigianxoay: 0,
        soNgay: parseInt(soNgay),
        tenKhach: "0355656730"
      }, {
        headers: {
          'Authorization': `Bearer ${externalApiToken}`
        }
      });
      
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
