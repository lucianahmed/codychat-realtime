// ===== CodyChat Realtime Server =====
// Author: Saif & ChatGPT
// Version: 2.0 (Seats + Voice Chat)

import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// إنشاء Http Server + Socket.io
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --------------------------------------------------------
// 🟢 عند اتصال مستخدم جديد
// --------------------------------------------------------
io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // ====================================================
    // =============== 1) RealTime Seat System =============
    // ====================================================

    socket.on("join_room", (roomId) => {
        socket.join(`room_${roomId}`);
        console.log(`👥 User ${socket.id} joined seat room ${roomId}`);
    });

    // ====================================================
    // =============== 2) Voice Chat System ================
    // ====================================================

    socket.on("voice:joinRoom", ({ roomId, userId }) => {
        socket.join("voice_room_" + roomId);
        socket.data.roomId = roomId;
        socket.data.userId = userId;

        // رجّع للمستخدم الموجودين في الغرفة
        const clients = [...io.sockets.sockets.values()]
            .filter(s => s.data?.roomId == roomId && s.id !== socket.id)
            .map(s => ({ userId: s.data.userId }));

        socket.emit("voice:usersInRoom", clients);
    });

    socket.on("voice:requestPeers", ({ roomId, userId }) => {
        const clients = [...io.sockets.sockets.values()]
            .filter(s => s.data?.roomId == roomId && s.id !== socket.id)
            .map(s => ({ userId: s.data.userId }));

        socket.emit("voice:peers", { users: clients });
    });

    // الـ Offer
    socket.on("voice:offer", ({ toUserId, fromUserId, sdp }) => {
        forwardToUser(toUserId, "voice:offer", { fromUserId, sdp });
    });

    // الـ Answer
    socket.on("voice:answer", ({ toUserId, fromUserId, sdp }) => {
        forwardToUser(toUserId, "voice:answer", { fromUserId, sdp });
    });

    // ICE Candidate
    socket.on("voice:iceCandidate", ({ toUserId, fromUserId, candidate }) => {
        forwardToUser(toUserId, "voice:iceCandidate", { fromUserId, candidate });
    });

    // Mic Status
    socket.on("voice:micOn", ({ roomId, userId }) => {
        io.to("voice_room_" + roomId).emit("voice:micOn", { userId });
    });

    socket.on("voice:micOff", ({ roomId, userId }) => {
        io.to("voice_room_" + roomId).emit("voice:micOff", { userId });
    });

    // الخروج
    socket.on("disconnect", () => {
        const roomId = socket.data?.roomId;
        const userId = socket.data?.userId;

        console.log("🔴 User disconnected:", socket.id);

        if (roomId && userId) {
            io.to("voice_room_" + roomId).emit("voice:userLeft", { userId });
        }
    });

    // ====================================================
    // دالة إرسال لأي مستخدم حسب userId
    // ====================================================
    function forwardToUser(targetUserId, event, payload) {
        for (const [id, s] of io.sockets.sockets) {
            if (s.data?.userId == targetUserId) {
                s.emit(event, payload);
                break;
            }
        }
    }
});


// --------------------------------------------------------
// 📬 استقبال seatUpdate من PHP
// --------------------------------------------------------
app.post("/seatUpdate", (req, res) => {
    const data = req.body;

    if (!data.room_id) {
        return res.status(400).json({ error: "room_id is required" });
    }

    console.log(`📢 Seat update received from PHP → Room ${data.room_id}`);

    io.to(`room_${data.room_id}`).emit("seat_update", data);

    res.json({ status: "ok" });
});


// --------------------------------------------------------
// صفحة اختبار
// --------------------------------------------------------
app.get("/", (req, res) => {
    res.send("✅ CodyChat Realtime Server Running Successfully!");
});


// --------------------------------------------------------
// تشغيل السيرفر على Render
// --------------------------------------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
    console.log(`🚀 Socket.io server running on port ${PORT}`)
);
