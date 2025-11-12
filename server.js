// ===== CodyChat Seat System - RealTime Server =====
// Author: Saif & ChatGPT
// Version: 1.0 (for Render Deployment)

import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// إنشاء سيرفر HTTP وSocket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // ممكن تحدد "https://ra7ra.site" لو عايز تأمين أكتر
    methods: ["GET", "POST"]
  }
});

// 🟢 عند اتصال مستخدم
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // المستخدم ينضم لغرفة معينة
  socket.on("join_room", (roomId) => {
    socket.join(`room_${roomId}`);
    console.log(`👥 User ${socket.id} joined room ${roomId}`);
  });

  // المستخدم يخرج
  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// 🔔 استقبال التحديثات من PHP
// PHP هيبعت هنا POST request لما يتغير مقعد
app.post("/seatUpdate", (req, res) => {
  const data = req.body;

  if (!data.room_id) {
    return res.status(400).json({ error: "room_id is required" });
  }

  console.log(`📢 Seat update from PHP → Room ${data.room_id}`, data);

  // إرسال التحديث لكل المستخدمين في نفس الغرفة
  io.to(`room_${data.room_id}`).emit("seat_update", data);

  res.json({ status: "ok" });
});

// 🔧 نقطة اختبار بسيطة
app.get("/", (req, res) => {
  res.send("✅ CodyChat Realtime Server Running Successfully!");
});

// Render يوفّر PORT في متغير بيئي
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Socket.io server running on port ${PORT}`));
