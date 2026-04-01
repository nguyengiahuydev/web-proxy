import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as admin from "firebase-admin";

// Initialize Firebase Admin
admin.initializeApp({
  projectId: "gen-lang-client-0427603627" // Using projectId from config
});

const db = admin.firestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy API endpoint to handle order, balance deduction and proxy storage
  app.post("/api/proxy/order", async (req, res) => {
    const { userId, numProxy, soNgay, usernameproxy, passwordproxy, tinhtrangproxy, thoigianxoay, totalPrice } = req.body;

    try {
      // 1. Check User Balance
      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();
      
      if (!userSnap.exists) {
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userSnap.data();
      if (!userData || userData.balance < totalPrice) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // 2. Call External API
      const apiResponse = await axios.post("https://proxynuoinick.com/api/api/tasks/start", req.body);
      
      // 3. If API success, deduct balance and save proxy
      if (apiResponse.data.status === 'success' || apiResponse.data.success) {
        const batch = db.batch();
        
        // Deduct balance
        batch.update(userRef, {
          balance: admin.firestore.FieldValue.increment(-totalPrice)
        });

        // Create transaction record
        const txRef = db.collection("transactions").doc();
        batch.set(txRef, {
          userId,
          amount: -totalPrice,
          type: "purchase",
          status: "success",
          description: `Mua ${numProxy} Proxy - ${soNgay} ngày`,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Create proxy assets (mocking IP/Port if API doesn't return them directly in a standard way)
        // In a real scenario, you'd parse apiResponse.data for the actual proxy details
        for (let i = 0; i < numProxy; i++) {
          const proxyRef = db.collection("proxies").doc();
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + parseInt(soNgay));
          
          batch.set(proxyRef, {
            userId,
            ip: `103.153.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            port: 8080 + i,
            username: usernameproxy,
            password: passwordproxy,
            type: tinhtrangproxy,
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        await batch.commit();
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
