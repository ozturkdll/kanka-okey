const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://kanka-okey.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  })
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const rooms = {};

const INDICATOR_TILE = {
  color: "yellow",
  number: 2,
};

function createRoomCode() {
  let code = "";

  do {
    code = Math.random().toString(36).substring(2, 6).toUpperCase();
  } while (rooms[code]);

  return code;
}

function createTiles() {
  const colors = ["red", "blue", "black", "yellow"];
  const tiles = [];
  let id = 1;

  for (const color of colors) {
    for (let number = 1; number <= 13; number++) {
      tiles.push({ id: id++, color, number, fake: false });
      tiles.push({ id: id++, color, number, fake: false });
    }
  }

  tiles.push({ id: id++, color: "fake", number: null, fake: true });
  tiles.push({ id: id++, color: "fake", number: null, fake: true });

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

function getOkeyNumber() {
  return INDICATOR_TILE.number === 13 ? 1 : INDICATOR_TILE.number + 1;
}

function isRealOkeyTile(tile) {
  if (!tile || tile.fake) return false;
  return tile.color === INDICATOR_TILE.color && tile.number === getOkeyNumber();
}

function getEffectiveTile(tile) {
  if (!tile) return null;

  if (tile.fake) {
    return {
      ...tile,
      color: INDICATOR_TILE.color,
      number: getOkeyNumber(),
      fakeAsReal: true,
    };
  }

  return tile;
}

function evaluateGroup(group) {
  if (!Array.isArray(group) || group.length < 2) {
    return { type: "none", score: 0 };
  }

  const realOkeys = group.filter((tile) => isRealOkeyTile(tile));
  const normalTiles = group
    .filter((tile) => !isRealOkeyTile(tile))
    .map((tile) => getEffectiveTile(tile));

  if (group.length === 2) {
    if (normalTiles.length === 2) {
      const same =
        normalTiles[0].color === normalTiles[1].color &&
        normalTiles[0].number === normalTiles[1].number;

      return { type: same ? "pair" : "none", score: same ? 1 : 0 };
    }

    if (normalTiles.length === 1 && realOkeys.length === 1) {
      return { type: "pair", score: 1 };
    }
  }

  if (group.length >= 3) {
    const colors = ["yellow", "blue", "black", "red"];
    let bestRunScore = 0;

    colors.forEach((color) => {
      for (let start = 1; start <= 14 - group.length; start++) {
        const needed = Array.from(
          { length: group.length },
          (_, index) => start + index
        );
        const usedIds = new Set();
        let missing = 0;

        needed.forEach((number) => {
          const found = normalTiles.find((tile) => {
            if (usedIds.has(tile.id)) return false;
            return tile.color === color && tile.number === number;
          });

          if (found) {
            usedIds.add(found.id);
          } else {
            missing++;
          }
        });

        if (missing === realOkeys.length && usedIds.size === normalTiles.length) {
          const score = needed.reduce((sum, number) => sum + number, 0);
          bestRunScore = Math.max(bestRunScore, score);
        }
      }
    });

    let bestSetScore = 0;

    for (let number = 1; number <= 13; number++) {
      const usedColors = new Set();
      let valid = true;

      normalTiles.forEach((tile) => {
        if (tile.number !== number) valid = false;
        if (usedColors.has(tile.color)) valid = false;
        usedColors.add(tile.color);
      });

      if (valid && normalTiles.length + realOkeys.length === group.length) {
        bestSetScore = Math.max(bestSetScore, number * group.length);
      }
    }

    if (bestRunScore || bestSetScore) {
      return { type: "series", score: Math.max(bestRunScore, bestSetScore) };
    }
  }

  return { type: "none", score: 0 };
}

function publicPlayerList(players) {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    money: player.money,
  }));
}

function broadcastGame(roomCode) {
  const room = rooms[roomCode];
  if (!room || !room.game) return;

  room.players.forEach((player) => {
    io.to(player.id).emit("game-updated", {
      roomCode,
      players: publicPlayerList(room.players),
      myPlayerId: player.id,
      myHand: room.game.hands[player.id] || [],
      deckCount: room.game.deck.length,
      currentTurnPlayerId: room.game.currentTurnPlayerId,
      discardedTile: room.game.discardedTile,
      lastDiscardedByPlayerId: room.game.lastDiscardedByPlayerId,
      openedSeries: room.game.openedSeries,
      openedPairs: room.game.openedPairs,
      indicatorTile: room.game.indicatorTile,
    });
  });
}

function startGame(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.players.length !== 4) return;

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
    lastDiscardedByPlayerId: null,
    openedSeries: [],
    openedPairs: [],
    indicatorTile: INDICATOR_TILE,
  };

  room.players.forEach((player) => {
    io.to(player.id).emit("game-started", {
      roomCode,
      players: publicPlayerList(room.players),
      myPlayerId: player.id,
      myHand: hands[player.id],
      deckCount: room.game.deck.length,
      currentTurnPlayerId: room.game.currentTurnPlayerId,
      discardedTile: room.game.discardedTile,
      lastDiscardedByPlayerId: room.game.lastDiscardedByPlayerId,
      openedSeries: room.game.openedSeries,
      openedPairs: room.game.openedPairs,
      indicatorTile: room.game.indicatorTile,
    });
  });
}

function getRoomOrError(socket, roomCode) {
  const code = String(roomCode || "").toUpperCase();
  const room = rooms[code];

  if (!room || !room.game || !room.game.started) {
    socket.emit("error-message", "Oyun bulunamadı.");
    return null;
  }

  return { room, code };
}

function openGroups(socket, roomCode, groups, mode) {
  const result = getRoomOrError(socket, roomCode);
  if (!result) return;

  const { room, code } = result;

  if (room.game.currentTurnPlayerId !== socket.id) {
    socket.emit("error-message", "Sıra sende değil.");
    return;
  }

  if (!Array.isArray(groups) || groups.length === 0) {
    socket.emit("error-message", "Açılacak taş bulunamadı.");
    return;
  }

  const hand = room.game.hands[socket.id];
  if (!hand) {
    socket.emit("error-message", "El bulunamadı.");
    return;
  }

  const handMap = new Map(hand.map((tile) => [tile.id, tile]));
  const openedGroups = [];
  const usedIds = new Set();

  for (const groupIds of groups) {
    if (!Array.isArray(groupIds) || groupIds.length === 0) continue;

    const tiles = [];

    for (const tileId of groupIds) {
      if (usedIds.has(tileId)) {
        socket.emit("error-message", "Aynı taşı iki kere açamazsın.");
        return;
      }

      const tile = handMap.get(tileId);

      if (!tile) {
        socket.emit("error-message", "Açmaya çalıştığın taş sende yok.");
        return;
      }

      tiles.push(tile);
      usedIds.add(tileId);
    }

    const evaluation = evaluateGroup(tiles);

    if (mode === "series" && evaluation.type !== "series") {
      socket.emit("error-message", "Geçersiz seri açmaya çalışıyorsun.");
      return;
    }

    if (mode === "pairs" && evaluation.type !== "pair") {
      socket.emit("error-message", "Geçersiz çift açmaya çalışıyorsun.");
      return;
    }

    openedGroups.push({
      id: `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      playerId: socket.id,
      tiles,
      score: evaluation.score,
    });
  }

  if (!openedGroups.length) {
    socket.emit("error-message", "Açılacak geçerli taş yok.");
    return;
  }

  room.game.hands[socket.id] = hand.filter((tile) => !usedIds.has(tile.id));

  if (mode === "series") {
    room.game.openedSeries.push(...openedGroups);
  } else {
    room.game.openedPairs.push(...openedGroups);
  }

  broadcastGame(code);
}

io.on("connection", (socket) => {
  console.log("Bir kullanıcı bağlandı:", socket.id);

  socket.on("create-room", ({ name }) => {
    const roomCode = createRoomCode();

    rooms[roomCode] = {
      players: [
        {
          id: socket.id,
          name: name?.trim() || "Oyuncu",
          money: 217,
        },
      ],
      game: null,
    };

    socket.join(roomCode);

    socket.emit("room-created", {
      roomCode,
      players: publicPlayerList(rooms[roomCode].players),
      myPlayerId: socket.id,
    });
  });

  socket.on("join-room", ({ name, roomCode }) => {
    const code = String(roomCode || "").toUpperCase();

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
      name: name?.trim() || "Oyuncu",
      money: 200 + (rooms[code].players.length + 1) * 17,
    });

    socket.join(code);

    io.to(code).emit("players-updated", {
      roomCode: code,
      players: publicPlayerList(rooms[code].players),
    });
  });

  socket.on("start-game", ({ roomCode }) => {
    const code = String(roomCode || "").toUpperCase();

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

  socket.on("reorder-hand", ({ roomCode, orderedTileIds }) => {
    const result = getRoomOrError(socket, roomCode);
    if (!result) return;

    const hand = result.room.game.hands[socket.id];
    if (!hand || !Array.isArray(orderedTileIds)) return;

    const tileMap = new Map(hand.map((tile) => [tile.id, tile]));
    const reorderedHand = orderedTileIds.map((id) => tileMap.get(id)).filter(Boolean);

    if (reorderedHand.length === hand.length) {
      result.room.game.hands[socket.id] = reorderedHand;
    }
  });

  socket.on("open-series", ({ roomCode, groups }) => {
    openGroups(socket, roomCode, groups, "series");
  });

  socket.on("open-pairs", ({ roomCode, groups }) => {
    openGroups(socket, roomCode, groups, "pairs");
  });

  socket.on("discard-tile", ({ roomCode, tileId }) => {
    const result = getRoomOrError(socket, roomCode);
    if (!result) return;

    const { room, code } = result;

    if (room.game.currentTurnPlayerId !== socket.id) {
      socket.emit("error-message", "Sıra sende değil.");
      return;
    }

    const hand = room.game.hands[socket.id];

    if (!hand) {
      socket.emit("error-message", "El bulunamadı.");
      return;
    }

    const tileIndex = hand.findIndex((tile) => tile.id === tileId);

    if (tileIndex === -1) {
      socket.emit("error-message", "Bu taş sende yok.");
      return;
    }

    const [discardedTile] = hand.splice(tileIndex, 1);

    room.game.discardedTile = discardedTile;
    room.game.lastDiscardedByPlayerId = socket.id;

    const currentIndex = room.players.findIndex((player) => player.id === socket.id);
    const nextIndex = (currentIndex + 1) % room.players.length;
    room.game.currentTurnPlayerId = room.players[nextIndex].id;

    broadcastGame(code);
  });

  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      room.players = room.players.filter((player) => player.id !== socket.id);

      io.to(roomCode).emit("players-updated", {
        roomCode,
        players: publicPlayerList(room.players),
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