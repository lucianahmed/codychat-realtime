// ===== CodyChat Realtime Server =====
// Version 2.5 (Seats + FULL Voice Sync)

import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ========================================================
// 🟢 Users Map
// ========================================================
/*
   نستخدمها لتسجيل:
   - هل المستخدم فاتح المايك؟ (isSpeaker)
   - هل المستخدم داخل غرفة الصوت؟ (roomId)
*/
const users = new Map();

// ========================================================
// 🟢 عند اتصال مستخدم جديد
// ========================================================
io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // ----------------------------------------------------
    // 1) نظام المقاعد
    // ----------------------------------------------------
    socket.on("join_room", (roomId) => {
        socket.join(`room_${roomId}`);
        console.log(`👥 User ${socket.id} joined seat room ${roomId}`);
    });

    // ----------------------------------------------------
    // 2) نظام الصوت الكامل
    // ----------------------------------------------------
    socket.on("voice:joinRoom", ({ roomId, userId }) => {
        socket.join("voice_room_" + roomId);

        socket.data.roomId = roomId;
        socket.data.userId = userId;

        // حفظ المستخدم في الذاكرة
        users.set(userId, {
            roomId,
            socketId: socket.id,
            isSpeaker: false
        });

        // قائمة المتحدثين الحاليين فقط
        const speakers = [...users.entries()]
            .filter(([_, u]) => u.roomId == roomId && u.isSpeaker === true)
            .map(([id, _]) => ({ userId: id }));

        // إرسال القائمة للعضو الجديد
        socket.emit("voice:usersInRoom", { speakers });
    });

    // ----------------------------------------------------
    // طلب الاتصال من speaker للناس الموجودة
    // ----------------------------------------------------
    socket.on("voice:requestPeers", ({ roomId, userId }) => {
        const peers = [...users.entries()]
            .filter(([id, u]) => u.roomId == roomId && id !== userId)
            .map(([id]) => ({ userId: id }));

        socket.emit("voice:peers", { users: peers });
    });

    // ----------------------------------------------------
    // Offer / Answer / ICE
    // ----------------------------------------------------
    socket.on("voice:offer", ({ toUserId, fromUserId, sdp }) => {
        forward(toUserId, "voice:offer", { fromUserId, sdp });
    });

    socket.on("voice:answer", ({ toUserId, fromUserId, sdp }) => {
        forward(toUserId, "voice:answer", { fromUserId, sdp });
    });

    socket.on("voice:iceCandidate", ({ toUserId, fromUserId, candidate }) => {
        forward(toUserId, "voice:iceCandidate", { fromUserId, candidate });
    });

    // ----------------------------------------------------
    // Mic ON
    // ----------------------------------------------------
    socket.on("voice:micOn", ({ roomId, userId }) => {

        // سجل إنه speaker
        if (users.has(userId)) {
            users.get(userId).isSpeaker = true;
        }

        // أبلغ الجميع
        io.to("voice_room_" + roomId).emit("voice:micOn", { userId });
    });

    // ----------------------------------------------------
    // Mic OFF
    // ----------------------------------------------------
    socket.on("voice:micOff", ({ roomId, userId }) => {

        // سجل إنه مش speaker
        if (users.has(userId)) {
            users.get(userId).isSpeaker = false;
        }

        io.to("voice_room_" + roomId).emit("voice:micOff", { userId });
    });

    // ----------------------------------------------------
    // خروج المستخدم
    // ----------------------------------------------------
    socket.on("disconnect", () => {

        const roomId = socket.data?.roomId;
        const userId = socket.data?.userId;

        console.log("🔴 User disconnected:", socket.id);

        if (userId) users.delete(userId);

        if (roomId && userId) {
            io.to("voice_room_" + roomId).emit("voice:userLeft", { userId });
        }
    });

    // ----------------------------------------------------
    // مساعد إرسال
    // ----------------------------------------------------
    function forward(targetUserId, event, payload) {
        const u = users.get(targetUserId);
        if (u && u.socketId) {
            io.to(u.socketId).emit(event, payload);
        }
    }
});

// ========================================================
// 📬 استقبال seatUpdate من PHP
// ========================================================
app.post("/seatUpdate", (req, res) => {
    const data = req.body;

    if (!data.room_id) {
        return res.status(400).json({ error: "room_id is required" });
    }

    console.log(`📢 Seat update → Room ${data.room_id}`);

    io.to(`room_${data.room_id}`).emit("seat_update", data);

    res.json({ status: "ok" });
});

// ========================================================
app.get("/", (req, res) => {
    res.send("✅ CodyChat Realtime Server Running Successfully!");
});

// ========================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
    console.log(`🚀 Socket.io server running on port ${PORT}`)
);
