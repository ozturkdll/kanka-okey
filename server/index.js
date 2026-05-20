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

const TURN_SECONDS = 30;
const NEXT_HAND_DELAY_MS = 4000;

const INDICATOR_TILE = {
  color: "yellow",
  number: 2,
};

function normalizeRoomCode(roomCode) {
  return String(roomCode || "").trim().toUpperCase();
}

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

function getTilePoint(tile) {
  if (!tile) return 0;

  if (isRealOkeyTile(tile)) {
    return getOkeyNumber();
  }

  if (tile.fake) {
    return getOkeyNumber();
  }

  return Number(tile.number || 0);
}

function getHandTotal(hand) {
  return (hand || []).reduce((sum, tile) => sum + getTilePoint(tile), 0);
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

      return {
        type: same ? "pair" : "none",
        score: same ? 1 : 0,
      };
    }

    if (normalTiles.length === 1 && realOkeys.length === 1) {
      return {
        type: "pair",
        score: 1,
      };
    }
  }

  if (group.length >= 3) {
    const colors = ["yellow", "blue", "black", "red"];
    let bestRunScore = 0;

    colors.forEach((color) => {
      for (let start = 1; start <= 14 - group.length; start++) {
        const neededNumbers = Array.from(
          { length: group.length },
          (_, index) => start + index
        );

        const usedIds = new Set();
        let missing = 0;

        neededNumbers.forEach((number) => {
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
          const score = neededNumbers.reduce((sum, number) => sum + number, 0);
          bestRunScore = Math.max(bestRunScore, score);
        }
      }
    });

    let bestSetScore = 0;

    for (let number = 1; number <= 13; number++) {
      const usedColors = new Set();
      let valid = true;

      normalTiles.forEach((tile) => {
        if (tile.number !== number) {
          valid = false;
          return;
        }

        if (usedColors.has(tile.color)) {
          valid = false;
          return;
        }

        usedColors.add(tile.color);
      });

      if (valid && normalTiles.length + realOkeys.length === group.length) {
        bestSetScore = Math.max(bestSetScore, number * group.length);
      }
    }

    if (bestRunScore || bestSetScore) {
      return {
        type: "series",
        score: Math.max(bestRunScore, bestSetScore),
      };
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

/*
  Sabit sıra mantığı:
  Oyuncular join sırasına göre masaya oturur.
  App tarafında:
  sen = alt
  index + 1 = sağ
  index + 2 = karşı
  index + 3 = sol

  Oynama sırası:
  1 -> sağındaki -> sağındaki -> sağındaki
  yani index + 1
*/
function getNextPlayerId(room, currentPlayerId) {
  const currentIndex = room.players.findIndex(
    (player) => player.id === currentPlayerId
  );

  if (currentIndex === -1) return room.players[0]?.id || null;

  const nextIndex = (currentIndex + 1) % room.players.length;
  return room.players[nextIndex]?.id || null;
}

function getPreviousPlayerId(room, currentPlayerId) {
  const currentIndex = room.players.findIndex(
    (player) => player.id === currentPlayerId
  );

  if (currentIndex === -1) return null;

  const previousIndex = (currentIndex - 1 + room.players.length) % room.players.length;
  return room.players[previousIndex]?.id || null;
}

function clearTurnTimer(room) {
  if (room?.game?.turnTimer) {
    clearTimeout(room.game.turnTimer);
    room.game.turnTimer = null;
  }
}

function clearNextHandTimer(room) {
  if (room?.game?.nextHandTimer) {
    clearTimeout(room.game.nextHandTimer);
    room.game.nextHandTimer = null;
  }
}

function startTurnTimer(roomCode) {
  const code = normalizeRoomCode(roomCode);
  const room = rooms[code];

  if (!room || !room.game || room.game.handFinished) return;

  clearTurnTimer(room);

  room.game.turnDeadline = Date.now() + TURN_SECONDS * 1000;

  room.game.turnTimer = setTimeout(() => {
    handleTurnTimeout(code);
  }, TURN_SECONDS * 1000);
}

function broadcastGame(roomCode) {
  const code = normalizeRoomCode(roomCode);
  const room = rooms[code];

  if (!room || !room.game) return;

  room.players.forEach((player) => {
    io.to(player.id).emit("game-updated", {
      roomCode: code,
      players: publicPlayerList(room.players),
      myPlayerId: player.id,
      myHand: room.game.hands[player.id] || [],
      deckCount: room.game.deck.length,
      currentTurnPlayerId: room.game.currentTurnPlayerId,
      turnPhase: room.game.turnPhase,
      turnDeadline: room.game.turnDeadline,
      turnSeconds: TURN_SECONDS,

      discardedTile: room.game.discardedTile,
      lastDiscardedByPlayerId: room.game.lastDiscardedByPlayerId,
      discardPiles: room.game.discardPiles,

      openedSeries: room.game.openedSeries,
      openedPairs: room.game.openedPairs,
      playerOpenTypes: room.game.playerOpenTypes,

      indicatorTile: room.game.indicatorTile,

      takenDiscard: room.game.takenDiscardByPlayerId[player.id] || null,
      mustUseTakenTileId: room.game.mustUseTakenTileIdByPlayerId[player.id] || null,

      handFinished: room.game.handFinished,
      handResult: room.game.handResult,
      totalScores: room.totalScores,
      handNumber: room.handNumber || 1,
    });
  });
}

function drawTileForPlayer(room, playerId) {
  if (!room.game.deck.length) return null;

  const drawnTile = room.game.deck.shift();

  if (!room.game.hands[playerId]) {
    room.game.hands[playerId] = [];
  }

  room.game.hands[playerId].push(drawnTile);
  room.game.lastDrawnTileByPlayerId[playerId] = drawnTile.id;
  room.game.drawSourceByPlayerId[playerId] = "deck";

  return drawnTile;
}

function takeDiscardForPlayer(room, playerId) {
  const previousPlayerId = getPreviousPlayerId(room, playerId);

  if (!previousPlayerId) return null;

  const discardTile = room.game.discardPiles[previousPlayerId];

  if (!discardTile) return null;

  delete room.game.discardPiles[previousPlayerId];

  if (!room.game.hands[playerId]) {
    room.game.hands[playerId] = [];
  }

  room.game.hands[playerId].push(discardTile);

  room.game.takenDiscardByPlayerId[playerId] = {
    tile: discardTile,
    fromPlayerId: previousPlayerId,
  };

  room.game.mustUseTakenTileIdByPlayerId[playerId] = discardTile.id;
  room.game.drawSourceByPlayerId[playerId] = "discard";
  room.game.lastDrawnTileByPlayerId[playerId] = discardTile.id;

  return discardTile;
}

function returnTakenDiscardForPlayer(room, playerId) {
  const taken = room.game.takenDiscardByPlayerId[playerId];

  if (!taken || !taken.tile || !taken.fromPlayerId) return false;

  const hand = room.game.hands[playerId] || [];
  const tileIndex = hand.findIndex(
    (tile) => Number(tile.id) === Number(taken.tile.id)
  );

  if (tileIndex === -1) return false;

  const [returnedTile] = hand.splice(tileIndex, 1);

  room.game.discardPiles[taken.fromPlayerId] = returnedTile;
  room.game.takenDiscardByPlayerId[playerId] = null;
  room.game.mustUseTakenTileIdByPlayerId[playerId] = null;
  room.game.drawSourceByPlayerId[playerId] = null;
  room.game.lastDrawnTileByPlayerId[playerId] = null;
  room.game.turnPhase = "draw";

  return true;
}

function discardTileForPlayer(room, playerId, tileId) {
  const hand = room.game.hands[playerId];

  if (!hand || !hand.length) return null;

  let tileIndex = -1;

  if (tileId !== undefined && tileId !== null) {
    const numericTileId = Number(tileId);
    tileIndex = hand.findIndex((tile) => Number(tile.id) === numericTileId);
  }

  if (tileIndex === -1) {
    const lastDrawnTileId = room.game.lastDrawnTileByPlayerId[playerId];

    if (lastDrawnTileId) {
      tileIndex = hand.findIndex(
        (tile) => Number(tile.id) === Number(lastDrawnTileId)
      );
    }
  }

  if (tileIndex === -1) {
    tileIndex = hand.length - 1;
  }

  if (tileIndex === -1) return null;

  const [discardedTile] = hand.splice(tileIndex, 1);

  room.game.discardedTile = discardedTile;
  room.game.lastDiscardedByPlayerId = playerId;
  room.game.discardPiles[playerId] = discardedTile;
  room.game.lastDrawnTileByPlayerId[playerId] = null;
  room.game.drawSourceByPlayerId[playerId] = null;

  return discardedTile;
}

function passTurn(roomCode, currentPlayerId) {
  const code = normalizeRoomCode(roomCode);
  const room = rooms[code];

  if (!room || !room.game || room.game.handFinished) return;

  room.game.currentTurnPlayerId = getNextPlayerId(room, currentPlayerId);
  room.game.turnPhase = "draw";

  startTurnTimer(code);
  broadcastGame(code);
}

function calculateHandScores(room, winnerId = null, finishTile = null) {
  const isOkeyFinish = Boolean(winnerId && isRealOkeyTile(finishTile));
  const handScores = {};

  room.players.forEach((player) => {
    const playerId = player.id;
    const hand = room.game.hands[playerId] || [];
    const openType = room.game.playerOpenTypes[playerId];

    if (winnerId && playerId === winnerId) {
      handScores[playerId] = isOkeyFinish ? -202 : -101;
      return;
    }

    if (!openType) {
      handScores[playerId] = 202;
      return;
    }

    const handTotal = getHandTotal(hand);
    let penalty = handTotal;

    if (openType === "pairs") {
      penalty *= 2;
    }

    if (isOkeyFinish) {
      penalty *= 2;
    }

    handScores[playerId] = penalty;
  });

  return {
    handScores,
    isOkeyFinish,
  };
}

function applyScores(room, handScores) {
  room.players.forEach((player) => {
    if (typeof room.totalScores[player.id] !== "number") {
      room.totalScores[player.id] = 0;
    }

    room.totalScores[player.id] += handScores[player.id] || 0;
  });
}

function finishHand(roomCode, winnerId = null, finishTile = null, reason = "finish") {
  const code = normalizeRoomCode(roomCode);
  const room = rooms[code];

  if (!room || !room.game || room.game.handFinished) return;

  clearTurnTimer(room);

  const { handScores, isOkeyFinish } = calculateHandScores(
    room,
    winnerId,
    finishTile
  );

  applyScores(room, handScores);

  const winner = winnerId
    ? room.players.find((player) => player.id === winnerId)
    : null;

  room.game.handFinished = true;
  room.game.handResult = {
    reason,
    winnerId,
    winnerName: winner?.name || null,
    finishTile,
    isOkeyFinish,
    handScores,
    totalScores: room.totalScores,
    message: winner
      ? `${winner.name} eli bitirdi${isOkeyFinish ? " ve okey ile bitti!" : "!"}`
      : "Destede taş kalmadı. El bitti.",
  };

  broadcastGame(code);

  clearNextHandTimer(room);

  room.game.nextHandTimer = setTimeout(() => {
    const liveRoom = rooms[code];

    if (!liveRoom || liveRoom.players.length !== 4) return;

    startNewHand(code);
  }, NEXT_HAND_DELAY_MS);
}

function handleTurnTimeout(roomCode) {
  const code = normalizeRoomCode(roomCode);
  const room = rooms[code];

  if (!room || !room.game || room.game.handFinished) return;

  const playerId = room.game.currentTurnPlayerId;

  if (!playerId || !room.game.hands[playerId]) return;

  const mustUseTileId = room.game.mustUseTakenTileIdByPlayerId[playerId];

  if (mustUseTileId) {
    returnTakenDiscardForPlayer(room, playerId);
  }

  if (room.game.turnPhase === "draw") {
    const drawnTile = drawTileForPlayer(room, playerId);

    if (!drawnTile) {
      finishHand(code, null, null, "deck-empty");
      return;
    }

    room.game.turnPhase = "discard";
  }

  const discardedTile = discardTileForPlayer(room, playerId);

  if (!discardedTile) {
    finishHand(code, null, null, "no-discard");
    return;
  }

  if ((room.game.hands[playerId] || []).length === 0) {
    finishHand(code, playerId, discardedTile, "finish");
    return;
  }

  passTurn(code, playerId);
}

function startNewHand(roomCode) {
  const code = normalizeRoomCode(roomCode);
  const room = rooms[code];

  if (!room || room.players.length !== 4) return;

  clearTurnTimer(room);
  clearNextHandTimer(room);

  const tiles = shuffleTiles(createTiles());
  const hands = {};

  const handNumber = (room.handNumber || 0) + 1;
  room.handNumber = handNumber;

  const starterIndex = (handNumber - 1) % room.players.length;

  room.players.forEach((player, index) => {
    const tileCount = index === starterIndex ? 22 : 21;
    hands[player.id] = tiles.splice(0, tileCount);
  });

  room.game = {
    started: true,
    handFinished: false,
    handResult: null,

    deck: tiles,
    hands,

    currentTurnPlayerId: room.players[starterIndex].id,
    turnPhase: "discard",

    turnDeadline: Date.now() + TURN_SECONDS * 1000,
    turnTimer: null,
    nextHandTimer: null,

    discardedTile: null,
    lastDiscardedByPlayerId: null,
    discardPiles: {},

    lastDrawnTileByPlayerId: {},
    drawSourceByPlayerId: {},

    takenDiscardByPlayerId: {},
    mustUseTakenTileIdByPlayerId: {},

    openedSeries: [],
    openedPairs: [],
    playerOpenTypes: {},

    indicatorTile: INDICATOR_TILE,
  };

  room.players.forEach((player) => {
    io.to(player.id).emit("game-started", {
      roomCode: code,
      players: publicPlayerList(room.players),
      myPlayerId: player.id,
      myHand: hands[player.id],
      deckCount: room.game.deck.length,

      currentTurnPlayerId: room.game.currentTurnPlayerId,
      turnPhase: room.game.turnPhase,
      turnDeadline: room.game.turnDeadline,
      turnSeconds: TURN_SECONDS,

      discardedTile: room.game.discardedTile,
      lastDiscardedByPlayerId: room.game.lastDiscardedByPlayerId,
      discardPiles: room.game.discardPiles,

      openedSeries: room.game.openedSeries,
      openedPairs: room.game.openedPairs,
      playerOpenTypes: room.game.playerOpenTypes,

      indicatorTile: room.game.indicatorTile,

      takenDiscard: null,
      mustUseTakenTileId: null,

      handFinished: false,
      handResult: null,
      totalScores: room.totalScores,
      handNumber: room.handNumber,
    });
  });

  startTurnTimer(code);
}

function getRoomOrError(socket, roomCode) {
  let code = normalizeRoomCode(roomCode);

  if (!code && socket.data.roomCode) {
    code = normalizeRoomCode(socket.data.roomCode);
  }

  const room = rooms[code];

  if (!room) {
    socket.emit(
      "error-message",
      "Oyun bulunamadı. Server yeniden başladıysa yeni oda kurman gerekiyor."
    );
    return null;
  }

  if (!room.game || !room.game.started) {
    socket.emit("error-message", "Oyun henüz başlamadı.");
    return null;
  }

  if (room.game.handFinished) {
    socket.emit("error-message", "El bitti. Yeni el başlıyor.");
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

  const handMap = new Map(hand.map((tile) => [Number(tile.id), tile]));
  const openedGroups = [];
  const usedIds = new Set();

  let totalSeriesScore = 0;
  let totalPairCount = 0;

  const mustUseTileId = room.game.mustUseTakenTileIdByPlayerId[socket.id];

  for (const groupIds of groups) {
    if (!Array.isArray(groupIds) || groupIds.length === 0) continue;

    const tiles = [];

    for (const rawTileId of groupIds) {
      const tileId = Number(rawTileId);

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

    if (mode === "series") totalSeriesScore += evaluation.score;
    if (mode === "pairs") totalPairCount += 1;

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

  if (mustUseTileId && !usedIds.has(Number(mustUseTileId))) {
    socket.emit(
      "error-message",
      "Yandan aldığın taşı açarken kullanmak zorundasın."
    );
    return;
  }

  const alreadyOpened = Boolean(room.game.playerOpenTypes[socket.id]);

  if (!alreadyOpened) {
    if (mode === "series" && totalSeriesScore < 101) {
      socket.emit(
        "error-message",
        `Seri açmak için en az 101 lazım. Şu an: ${totalSeriesScore}`
      );
      return;
    }

    if (mode === "pairs" && totalPairCount < 5) {
      socket.emit(
        "error-message",
        `Çift açmak için en az 5 çift lazım. Şu an: ${totalPairCount}`
      );
      return;
    }
  }

  room.game.hands[socket.id] = hand.filter(
    (tile) => !usedIds.has(Number(tile.id))
  );

  if (mode === "series") {
    room.game.openedSeries.push(...openedGroups);

    if (!room.game.playerOpenTypes[socket.id]) {
      room.game.playerOpenTypes[socket.id] = "series";
    }
  } else {
    room.game.openedPairs.push(...openedGroups);

    if (!room.game.playerOpenTypes[socket.id]) {
      room.game.playerOpenTypes[socket.id] = "pairs";
    }
  }

  if (mustUseTileId) {
    room.game.mustUseTakenTileIdByPlayerId[socket.id] = null;
    room.game.takenDiscardByPlayerId[socket.id] = null;
  }

  broadcastGame(code);
}

io.on("connection", (socket) => {
  console.log("Bir kullanıcı bağlandı:", socket.id);

  socket.on("create-room", ({ name }) => {
    const roomCode = createRoomCode();

    socket.data.roomCode = roomCode;

    rooms[roomCode] = {
      players: [
        {
          id: socket.id,
          name: name?.trim() || "Oyuncu",
          money: 217,
        },
      ],
      game: null,
      totalScores: {
        [socket.id]: 0,
      },
      handNumber: 0,
    };

    socket.join(roomCode);

    socket.emit("room-created", {
      roomCode,
      players: publicPlayerList(rooms[roomCode].players),
      myPlayerId: socket.id,
    });
  });

  socket.on("join-room", ({ name, roomCode }) => {
    const code = normalizeRoomCode(roomCode);

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

    socket.data.roomCode = code;

    rooms[code].players.push({
      id: socket.id,
      name: name?.trim() || "Oyuncu",
      money: 200 + (rooms[code].players.length + 1) * 17,
    });

    rooms[code].totalScores[socket.id] = 0;

    socket.join(code);

    io.to(code).emit("players-updated", {
      roomCode: code,
      players: publicPlayerList(rooms[code].players),
    });
  });

  socket.on("start-game", ({ roomCode }) => {
    const code = normalizeRoomCode(roomCode || socket.data.roomCode);

    if (!rooms[code]) {
      socket.emit("error-message", "Oda bulunamadı.");
      return;
    }

    if (rooms[code].players.length !== 4) {
      socket.emit("error-message", "Oyunu başlatmak için 4 kişi gerekiyor.");
      return;
    }

    startNewHand(code);
  });

  socket.on("draw-tile", ({ roomCode }) => {
    const result = getRoomOrError(socket, roomCode);
    if (!result) return;

    const { room, code } = result;

    if (room.game.currentTurnPlayerId !== socket.id) {
      socket.emit("error-message", "Sıra sende değil.");
      return;
    }

    if (room.game.turnPhase !== "draw") {
      socket.emit("error-message", "Şu an taş çekemezsin. Taş atman gerekiyor.");
      return;
    }

    if (room.game.drawSourceByPlayerId[socket.id] === "discard") {
      socket.emit("error-message", "Yandan taş aldıysan kapalıdan taş çekemezsin.");
      return;
    }

    if (room.game.deck.length === 0) {
      finishHand(code, null, null, "deck-empty");
      return;
    }

    drawTileForPlayer(room, socket.id);
    room.game.turnPhase = "discard";

    startTurnTimer(code);
    broadcastGame(code);
  });

  socket.on("take-discard", ({ roomCode }) => {
    const result = getRoomOrError(socket, roomCode);
    if (!result) return;

    const { room, code } = result;

    if (room.game.currentTurnPlayerId !== socket.id) {
      socket.emit("error-message", "Sıra sende değil.");
      return;
    }

    if (room.game.turnPhase !== "draw") {
      socket.emit("error-message", "Şu an yandan taş alamazsın.");
      return;
    }

    if (room.game.drawSourceByPlayerId[socket.id] === "deck") {
      socket.emit("error-message", "Kapalıdan taş çektiysen yandan taş alamazsın.");
      return;
    }

    const takenTile = takeDiscardForPlayer(room, socket.id);

    if (!takenTile) {
      socket.emit("error-message", "Alınacak yandaki taş yok.");
      return;
    }

    room.game.turnPhase = "discard";

    startTurnTimer(code);
    broadcastGame(code);
  });

  socket.on("return-discard", ({ roomCode }) => {
    const result = getRoomOrError(socket, roomCode);
    if (!result) return;

    const { room, code } = result;

    if (room.game.currentTurnPlayerId !== socket.id) {
      socket.emit("error-message", "Sıra sende değil.");
      return;
    }

    const returned = returnTakenDiscardForPlayer(room, socket.id);

    if (!returned) {
      socket.emit("error-message", "Geri bırakılacak yandan alınmış taş yok.");
      return;
    }

    startTurnTimer(code);
    broadcastGame(code);
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

    if (room.game.turnPhase !== "discard") {
      socket.emit("error-message", "Önce taş çekmelisin.");
      return;
    }

    const mustUseTileId = room.game.mustUseTakenTileIdByPlayerId[socket.id];

    if (mustUseTileId) {
      socket.emit(
        "error-message",
        "Yandan aldığın taşı kullanmadan taş atamazsın. Önce elini açmalı ya da taşı geri bırakmalısın."
      );
      return;
    }

    const discardedTile = discardTileForPlayer(room, socket.id, tileId);

    if (!discardedTile) {
      socket.emit("error-message", "Atılacak taş bulunamadı.");
      return;
    }

    if ((room.game.hands[socket.id] || []).length === 0) {
      finishHand(code, socket.id, discardedTile, "finish");
      return;
    }

    passTurn(code, socket.id);
  });

  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];

      if (!room) continue;

      room.players = room.players.filter((player) => player.id !== socket.id);
      delete room.totalScores[socket.id];

      io.to(roomCode).emit("players-updated", {
        roomCode,
        players: publicPlayerList(room.players),
      });

      if (room.players.length === 0) {
        clearTurnTimer(room);
        clearNextHandTimer(room);
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