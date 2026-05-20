const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = {};

function createRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("Bir kullanıcı bağlandı:", socket.id);

  socket.on("create-room", ({ name }) => {
    const roomCode = createRoomCode();

    rooms[roomCode] = {
      players: [{ id: socket.id, name }],
    };

    socket.join(roomCode);

    socket.emit("room-created", {
      roomCode,
      players: rooms[roomCode].players,
    });
  });

  socket.on("join-room", ({ name, roomCode }) => {
    const code = roomCode.toUpperCase();

    if (!rooms[code]) {
      socket.emit("error-message", "Böyle bir oda yok.");
      return;
    }

    if (rooms[code].players.length >= 4) {
      socket.emit("error-message", "Bu oda dolu.");
      return;
    }

    rooms[code].players.push({
      id: socket.id,
      name,
    });

    socket.join(code);

    io.to(code).emit("players-updated", {
      roomCode: code,
      players: rooms[code].players,
    });
  });

  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];

      room.players = room.players.filter((player) => player.id !== socket.id);

      io.to(roomCode).emit("players-updated", {
        roomCode,
        players: room.players,
      });

      if (room.players.length === 0) {
        delete rooms[roomCode];
      }
    }

    console.log("Kullanıcı ayrıldı:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("Kanka Okey server çalışıyor.");
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor.`);
});