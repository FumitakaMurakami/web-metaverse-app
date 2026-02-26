const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.NAF_PORT || 8888;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

const io = socketIo(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
});

// Room state: track connected clients per room
const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`[NAF] Client connected: ${socket.id}`);
  let currentRoom = null;

  socket.on("joinRoom", (data) => {
    const { room } = data;
    currentRoom = room;
    socket.join(room);

    if (!rooms.has(room)) {
      rooms.set(room, new Map());
    }
    const roomClients = rooms.get(room);
    roomClients.set(socket.id, { id: socket.id });

    // Send list of existing clients to the new joiner
    const occupants = {};
    for (const [clientId] of roomClients) {
      if (clientId !== socket.id) {
        occupants[clientId] = true;
      }
    }
    socket.emit("connectSuccess", { clientId: socket.id, serverTime: Date.now() });
    socket.emit("occupantsChanged", { occupants });

    // Notify existing clients about the new joiner
    socket.to(room).emit("occupantsChanged", {
      occupants: Object.fromEntries(
        [...roomClients.keys()].map((id) => [id, true])
      ),
    });

    console.log(
      `[NAF] ${socket.id} joined room: ${room} (${roomClients.size} clients)`
    );
  });

  socket.on("send", (data) => {
    // Relay data messages to specific target or broadcast to room
    if (data.target) {
      io.to(data.target).emit("send", {
        from: socket.id,
        dataType: data.dataType,
        data: data.data,
      });
    } else if (currentRoom) {
      socket.to(currentRoom).emit("send", {
        from: socket.id,
        dataType: data.dataType,
        data: data.data,
      });
    }
  });

  socket.on("broadcast", (data) => {
    if (currentRoom) {
      socket.to(currentRoom).emit("send", {
        from: socket.id,
        dataType: data.dataType,
        data: data.data,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`[NAF] Client disconnected: ${socket.id}`);
    if (currentRoom && rooms.has(currentRoom)) {
      const roomClients = rooms.get(currentRoom);
      roomClients.delete(socket.id);

      if (roomClients.size === 0) {
        rooms.delete(currentRoom);
        console.log(`[NAF] Room ${currentRoom} is now empty, removed.`);
      } else {
        // Notify remaining clients
        const occupants = Object.fromEntries(
          [...roomClients.keys()].map((id) => [id, true])
        );
        socket.to(currentRoom).emit("occupantsChanged", { occupants });
      }
    }
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rooms: rooms.size,
    clients: [...rooms.values()].reduce((sum, r) => sum + r.size, 0),
  });
});

server.listen(PORT, () => {
  console.log(`[NAF] Signaling server running on port ${PORT}`);
  console.log(`[NAF] CORS origin: ${CORS_ORIGIN}`);
});
