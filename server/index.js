const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://kanka-okey.vercel.app",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://kanka-okey.vercel.app",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const rooms = {};

function createRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function createTiles() {
  const colors = ["red", "blue", "black", "yellow"];
  const tiles = [];

  let id = 1;

  for (const color of colors) {
    for (let number = 1; number <= 13; number++) {
      tiles.push({
        id: id++,
        color,
        number,
        fake: false,
      });

      tiles.push({
        id: id++,
        color,
        number,
        fake: false,
      });
    }
  }

  tiles.push({
    id: id++,
    color: "fake",
    number: null,
    fake: true,
  });

  tiles.push({
    id: id++,
    color: "fake",
    number: null,
    fake: true,
  });

  return tiles;
}

function shuffleTiles(tiles) {
  const shuffled = [...tiles];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }

  return shuffled;
}

function startGame(roomCode) {
  const room = rooms[roomCode];

  if (!room) return;

  if (room.players.length !== 4) {
    return;
  }

  const tiles = shuffleTiles(createTiles());

  const hands = {};

  room.players.forEach((player, index) => {
    const tileCount = index === 0 ? 22 : 21;
    hands[player.id] = tiles.splice(0, tileCount);
  });

  room.game = {
    started: true,
    deck: tiles,
    hands,
    currentTurnPlayerId: room.players[0].id,
    discardedTile: null,
  };

  room.players.forEach((player) => {
    io.to(player.id).emit("game-started", {
      roomCode,
      players: room.players,
      myPlayerId: player.id,
      myHand: hands[player.id],
      deckCount: room.game.deck.length,
      currentTurnPlayerId: room.game.currentTurnPlayerId,
      discardedTile: room.game.discardedTile,
    });
  });
}

io.on("connection", (socket) => {
  console.log("Bir kullanıcı bağlandı:", socket.id);

  socket.on("create-room", ({ name }) => {
    console.log("Oda oluşturma isteği geldi:", name);

    const roomCode = createRoomCode();

    rooms[roomCode] = {
      players: [{ id: socket.id, name }],
      game: null,
    };

    socket.join(roomCode);

    socket.emit("room-created", {
      roomCode,
      players: rooms[roomCode].players,
      myPlayerId: socket.id,
    });
  });

  socket.on("join-room", ({ name, roomCode }) => {
    const code = roomCode.toUpperCase();

    if (!rooms[code]) {
      socket.emit("error-message", "Böyle bir oda yok.");
      return;
    }

    if (rooms[code].game?.started) {
      socket.emit("error-message", "Bu oyuna sonradan girilemez.");
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

  socket.on("start-game", ({ roomCode }) => {
    const code = roomCode.toUpperCase();

    if (!rooms[code]) {
      socket.emit("error-message", "Oda bulunamadı.");
      return;
    }

    if (rooms[code].players.length !== 4) {
      socket.emit("error-message", "Oyunu başlatmak için 4 kişi gerekiyor.");
      return;
    }

    startGame(code);
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