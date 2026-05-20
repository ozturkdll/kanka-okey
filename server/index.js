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
const NEXT_HAND_DELAY_MS = 10000;
const COLORS = ["red", "blue", "black", "yellow"];

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

function getNextNumber(number) {
  return number === 13 ? 1 : number + 1;
}

function createRandomIndicator() {
  return {
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    number: Math.floor(Math.random() * 13) + 1,
  };
}

function createTiles() {
  const tiles = [];
  let id = 1;

  for (const color of COLORS) {
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

function getOkeyTile(room) {
  const indicator = room.game.indicatorTile;

  return {
    color: indicator.color,
    number: getNextNumber(indicator.number),
  };
}

function isRealOkeyTile(room, tile) {
  if (!tile || tile.fake) return false;

  const okeyTile = getOkeyTile(room);

  return tile.color === okeyTile.color && tile.number === okeyTile.number;
}

function getEffectiveTile(room, tile) {
  if (!tile) return null;

  if (tile.fake) {
    const okeyTile = getOkeyTile(room);

    return {
      ...tile,
      color: okeyTile.color,
      number: okeyTile.number,
      fakeAsReal: true,
    };
  }

  return tile;
}

function getTilePoint(room, tile) {
  if (!tile) return 0;

  if (tile.fake) {
    return getOkeyTile(room).number;
  }

  return Number(tile.number || 0);
}

function getHandTotal(room, hand) {
  return (hand || []).reduce((sum, tile) => sum + getTilePoint(room, tile), 0);
}

function publicPlayerList(players) {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    money: player.money,
  }));
}

function getNextPlayerId(room, currentPlayerId) {
  const currentIndex = room.players.findIndex((player) => player.id === currentPlayerId);
  if (currentIndex === -1) return room.players[0]?.id || null;

  return room.players[(currentIndex + 1) % room.players.length]?.id || null;
}

function getPreviousPlayerId(room, currentPlayerId) {
  const currentIndex = room.players.findIndex((player) => player.id === currentPlayerId);
  if (currentIndex === -1) return null;

  return room.players[(currentIndex - 1 + room.players.length) % room.players.length]?.id || null;
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

function getMyRemainingPoint(room, playerId) {
  const openType = room.game.playerOpenTypes[playerId];

  if (!openType) return null;

  const total = getHandTotal(room, room.game.hands[playerId] || []);

  if (openType === "pairs") {
    return total * 2;
  }

  return total;
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

      discardPiles: room.game.discardPiles,

      openedSeries: room.game.openedSeries,
      openedPairs: room.game.openedPairs,
      playerOpenTypes: room.game.playerOpenTypes,

      indicatorTile: room.game.indicatorTile,
      okeyTile: getOkeyTile(room),

      takenDiscard: room.game.takenDiscardByPlayerId[player.id] || null,
      mustUseTakenTileId: room.game.mustUseTakenTileIdByPlayerId[player.id] || null,

      myRemainingPoint: getMyRemainingPoint(room, player.id),

      handFinished: room.game.handFinished,
      handResult: room.game.handResult,
      totalScores: room.totalScores,
      handNumber: room.handNumber || 1,
    });
  });
}

function buildGroupLayout(room, tiles, mode) {
  if (!Array.isArray(tiles) || tiles.length < 2) {
    return null;
  }

  const realOkeys = tiles.filter((tile) => isRealOkeyTile(room, tile));
  const normalTiles = tiles
    .filter((tile) => !isRealOkeyTile(room, tile))
    .map((tile) => ({
      original: tile,
      effective: getEffectiveTile(room, tile),
    }));

  if (mode === "pairs") {
    if (tiles.length !== 2) return null;

    if (realOkeys.length === 0) {
      if (
        normalTiles.length === 2 &&
        normalTiles[0].effective.color === normalTiles[1].effective.color &&
        normalTiles[0].effective.number === normalTiles[1].effective.number
      ) {
        return {
          kind: "pair",
          score: 1,
          layout: [
            { slot: 1, tile: normalTiles[0].original, represents: null },
            { slot: 2, tile: normalTiles[1].original, represents: null },
          ],
        };
      }

      return null;
    }

    if (realOkeys.length === 1 && normalTiles.length === 1) {
      return {
        kind: "pair",
        score: 1,
        layout: [
          { slot: 1, tile: normalTiles[0].original, represents: null },
          {
            slot: 2,
            tile: realOkeys[0],
            represents: {
              color: normalTiles[0].effective.color,
              number: normalTiles[0].effective.number,
            },
          },
        ],
      };
    }

    return null;
  }

  if (mode === "series") {
    if (tiles.length < 3) return null;

    const runResult = findBestRunLayout(room, tiles, normalTiles, realOkeys);
    const setResult = findBestSetLayout(room, tiles, normalTiles, realOkeys);

    if (!runResult && !setResult) return null;
    if (runResult && !setResult) return runResult;
    if (!runResult && setResult) return setResult;

    return runResult.score >= setResult.score ? runResult : setResult;
  }

  return null;
}

function findBestRunLayout(room, tiles, normalTiles, realOkeys) {
  let best = null;

  for (const color of COLORS) {
    for (let start = 1; start <= 14 - tiles.length; start++) {
      const needed = Array.from({ length: tiles.length }, (_, index) => start + index);
      const usedTileIds = new Set();
      const layout = [];
      let jokerIndex = 0;
      let valid = true;

      for (const number of needed) {
        const found = normalTiles.find((item) => {
          if (usedTileIds.has(item.original.id)) return false;
          return item.effective.color === color && item.effective.number === number;
        });

        if (found) {
          usedTileIds.add(found.original.id);
          layout.push({
            slot: number,
            tile: found.original,
            represents: null,
          });
        } else {
          const joker = realOkeys[jokerIndex];

          if (!joker) {
            valid = false;
            break;
          }

          jokerIndex++;

          layout.push({
            slot: number,
            tile: joker,
            represents: { color, number },
          });
        }
      }

      if (!valid) continue;

      const score = needed.reduce((sum, number) => sum + number, 0);

      if (!best || score > best.score) {
        best = {
          kind: "run",
          color,
          start,
          end: start + tiles.length - 1,
          score,
          layout,
        };
      }
    }
  }

  return best;
}

function findBestSetLayout(room, tiles, normalTiles, realOkeys) {
  let best = null;

  for (let number = 1; number <= 13; number++) {
    const usedColors = new Set();
    const naturalItems = [];
    let valid = true;

    for (const item of normalTiles) {
      if (item.effective.number !== number) {
        valid = false;
        break;
      }

      if (usedColors.has(item.effective.color)) {
        valid = false;
        break;
      }

      usedColors.add(item.effective.color);
      naturalItems.push(item);
    }

    if (!valid) continue;

    const missingColors = COLORS.filter((color) => !usedColors.has(color));
    if (missingColors.length < realOkeys.length) continue;

    const chosenMissing = missingColors.slice(0, realOkeys.length);

    const rawLayout = [
      ...naturalItems.map((item) => ({
        tile: item.original,
        represents: null,
      })),
      ...realOkeys.map((joker, index) => ({
        tile: joker,
        represents: {
          color: chosenMissing[index],
          number,
        },
      })),
    ];

    const slots =
      number === 13
        ? [13, 12, 11, 10]
        : [number, number + 1, number + 2, number + 3].map((slot) =>
            Math.min(slot, 13)
          );

    const layout = rawLayout.map((entry, index) => ({
      slot: slots[index] || Math.max(1, number - index),
      tile: entry.tile,
      represents: entry.represents,
    }));

    const score = number * tiles.length;

    if (!best || score > best.score) {
      best = {
        kind: "set",
        number,
        score,
        layout,
      };
    }
  }

  return best;
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
  const tileIndex = hand.findIndex((tile) => Number(tile.id) === Number(taken.tile.id));

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

function isTileUsefulForAnyOpenGroup(room, tile) {
  return [...room.game.openedSeries, ...room.game.openedPairs].some((group) =>
    canProcessTileToGroup(room, tile, group)
  );
}

function canProcessTileToGroup(room, tile, group) {
  if (!tile || !group) return false;

  const effective = getEffectiveTile(room, tile);

  if (group.kind === "run") {
    if (!effective || effective.color !== group.color) return false;

    return effective.number === group.start - 1 || effective.number === group.end + 1;
  }

  if (group.kind === "set") {
    if (!effective || effective.number !== group.number) return false;

    const usedColors = new Set(
      (group.layout || [])
        .map((item) => item.represents?.color || getEffectiveTile(room, item.tile)?.color)
        .filter(Boolean)
    );

    return !usedColors.has(effective.color);
  }

  if (group.kind === "pair") {
    return false;
  }

  return false;
}

function processTileToGroup(room, playerId, groupId, tileId) {
  const hand = room.game.hands[playerId] || [];
  const tileIndex = hand.findIndex((tile) => Number(tile.id) === Number(tileId));

  if (tileIndex === -1) {
    return { ok: false, message: "İşlemek istediğin taş sende yok." };
  }

  const tile = hand[tileIndex];
  const allGroups = [...room.game.openedSeries, ...room.game.openedPairs];
  const group = allGroups.find((item) => item.id === groupId);

  if (!group) {
    return { ok: false, message: "İşlenecek per bulunamadı." };
  }

  if (!canProcessTileToGroup(room, tile, group)) {
    return { ok: false, message: "Bu taş bu pere işlenemez." };
  }

  const effective = getEffectiveTile(room, tile);

  hand.splice(tileIndex, 1);

  if (group.kind === "run") {
    if (effective.number === group.start - 1) {
      group.start = effective.number;
      group.layout.unshift({
        slot: effective.number,
        tile,
        represents: null,
      });
    } else {
      group.end = effective.number;
      group.layout.push({
        slot: effective.number,
        tile,
        represents: null,
      });
    }

    group.score += effective.number;
  }

  if (group.kind === "set") {
    const usedSlots = new Set(group.layout.map((item) => item.slot));
    const preferredSlots =
      group.number === 13
        ? [13, 12, 11, 10]
        : [group.number, group.number + 1, group.number + 2, group.number + 3].map((slot) =>
            Math.min(slot, 13)
          );

    const slot = preferredSlots.find((item) => !usedSlots.has(item)) || group.number;

    group.layout.push({
      slot,
      tile,
      represents: null,
    });

    group.score += group.number;
  }

  return { ok: true };
}

function discardTileForPlayer(room, playerId, tileId) {
  const hand = room.game.hands[playerId];

  if (!hand || !hand.length) return null;

  let tileIndex = -1;

  if (tileId !== undefined && tileId !== null) {
    tileIndex = hand.findIndex((tile) => Number(tile.id) === Number(tileId));
  }

  if (tileIndex === -1) {
    const lastDrawnTileId = room.game.lastDrawnTileByPlayerId
      ? room.game.lastDrawnTileByPlayerId[playerId]
      : null;

    if (lastDrawnTileId) {
      tileIndex = hand.findIndex((tile) => Number(tile.id) === Number(lastDrawnTileId));
    }
  }

  if (tileIndex === -1) {
    tileIndex = hand.length - 1;
  }

  if (tileIndex === -1) return null;

  const tile = hand[tileIndex];

  const playerOpened = Boolean(
    room.game.playerOpenTypes &&
    room.game.playerOpenTypes[playerId]
  );

  if (playerOpened && isIslekDiscard(room, tile)) {
    addIslekPenaltyScoreOnly(room, playerId, tile);
  }

  const discardedTile = hand.splice(tileIndex, 1)[0];

  if (!room.game.discardPiles) room.game.discardPiles = {};
  room.game.discardPiles[playerId] = discardedTile;

  if (room.game.lastDrawnTileByPlayerId) {
    room.game.lastDrawnTileByPlayerId[playerId] = null;
  }

  if (room.game.drawSourceByPlayerId) {
    room.game.drawSourceByPlayerId[playerId] = null;
  }

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
  const isOkeyFinish = Boolean(winnerId && isRealOkeyTile(room, finishTile));
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

    const handTotal = getHandTotal(room, hand);
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

  const { handScores, isOkeyFinish } = calculateHandScores(room, winnerId, finishTile);

  applyScores(room, handScores);

  const winner = winnerId ? room.players.find((player) => player.id === winnerId) : null;

  room.game.handFinished = true;
  room.game.handResult = {
    reason,
    winnerId,
    winnerName: winner?.name || null,
    finishTile,
    isOkeyFinish,
    handScores,
    totalScores: room.totalScores,
    penaltyMessages: room.game.penaltyMessages,
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
  const indicatorTile = createRandomIndicator();

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

    discardPiles: {},

    lastDrawnTileByPlayerId: {},
    drawSourceByPlayerId: {},

    takenDiscardByPlayerId: {},
    mustUseTakenTileIdByPlayerId: {},

    openedSeries: [],
    openedPairs: [],
    playerOpenTypes: {},

    indicatorTile,
    penaltyMessages: [],
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

      discardPiles: room.game.discardPiles,

      openedSeries: room.game.openedSeries,
      openedPairs: room.game.openedPairs,
      playerOpenTypes: room.game.playerOpenTypes,

      indicatorTile: room.game.indicatorTile,
      okeyTile: getOkeyTile(room),

      takenDiscard: null,
      mustUseTakenTileId: null,
      myRemainingPoint: null,

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
    socket.emit("error-message", "Oyun bulunamadı. Server yeniden başladıysa yeni oda kurman gerekiyor.");
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

    const layoutResult = buildGroupLayout(room, tiles, mode);

    if (!layoutResult) {
      socket.emit("error-message", mode === "series" ? "Geçersiz seri açıyorsun." : "Geçersiz çift açıyorsun.");
      return;
    }

    if (mode === "series") totalSeriesScore += layoutResult.score;
    if (mode === "pairs") totalPairCount += 1;

    openedGroups.push({
      id: `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      playerId: socket.id,
      mode,
      kind: layoutResult.kind,
      color: layoutResult.color || null,
      number: layoutResult.number || null,
      start: layoutResult.start || null,
      end: layoutResult.end || null,
      score: layoutResult.score,
      layout: layoutResult.layout,
    });
  }

  if (!openedGroups.length) {
    socket.emit("error-message", "Açılacak geçerli taş yok.");
    return;
  }

  if (mustUseTileId && !usedIds.has(Number(mustUseTileId))) {
    socket.emit("error-message", "Yandan aldığın taşı açarken kullanmak zorundasın.");
    return;
  }

  const alreadyOpened = Boolean(room.game.playerOpenTypes[socket.id]);

  if (!alreadyOpened) {
    if (mode === "series" && totalSeriesScore < 101) {
      socket.emit("error-message", `Seri açmak için en az 101 lazım. Şu an: ${totalSeriesScore}`);
      return;
    }

    if (mode === "pairs" && totalPairCount < 5) {
      socket.emit("error-message", `Çift açmak için en az 5 çift lazım. Şu an: ${totalPairCount}`);
      return;
    }
  }

  room.game.hands[socket.id] = hand.filter((tile) => !usedIds.has(Number(tile.id)));

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

function replaceJoker(socket, roomCode, openedGroupId, jokerTileId) {
  const result = getRoomOrError(socket, roomCode);
  if (!result) return;

  const { room, code } = result;

  if (room.game.currentTurnPlayerId !== socket.id) {
    socket.emit("error-message", "Sıra sende değil.");
    return;
  }

  if (!room.game.playerOpenTypes[socket.id]) {
    socket.emit("error-message", "Okey almak için önce elini açmış olman lazım.");
    return;
  }

  const allGroups = [...room.game.openedSeries, ...room.game.openedPairs];
  const group = allGroups.find((item) => item.id === openedGroupId);

  if (!group) {
    socket.emit("error-message", "Okey alınacak per bulunamadı.");
    return;
  }

  const jokerIndex = group.layout.findIndex(
    (item) => Number(item.tile.id) === Number(jokerTileId) && item.represents
  );

  if (jokerIndex === -1) {
    socket.emit("error-message", "Bu taş alınabilir okey değil.");
    return;
  }

  const jokerEntry = group.layout[jokerIndex];
  const hand = room.game.hands[socket.id] || [];

  const requiredReplacements = [];

  if (group.kind === "set") {
    const naturalColors = new Set(
      group.layout
        .filter((item) => !item.represents)
        .map((item) => getEffectiveTile(room, item.tile)?.color)
        .filter(Boolean)
    );

    const missingColors = COLORS.filter((color) => !naturalColors.has(color));

    if (naturalColors.size <= 2) {
      missingColors.forEach((color) => {
        requiredReplacements.push({ color, number: group.number });
      });
    } else {
      requiredReplacements.push(jokerEntry.represents);
    }
  } else {
    requiredReplacements.push(jokerEntry.represents);
  }

  const replacementTiles = [];
  const usedHandIds = new Set();

  for (const required of requiredReplacements) {
    const found = hand.find((tile) => {
      if (usedHandIds.has(tile.id)) return false;
      if (isRealOkeyTile(room, tile)) return false;

      const effective = getEffectiveTile(room, tile);

      return effective.color === required.color && effective.number === required.number;
    });

    if (!found) {
      socket.emit(
        "error-message",
        "Okeyi almak için gereken gerçek taşlar elinde yok."
      );
      return;
    }

    usedHandIds.add(found.id);
    replacementTiles.push(found);
  }

  const ownerId = group.playerId;

  if (ownerId && ownerId !== socket.id) {
    room.totalScores[ownerId] = (room.totalScores[ownerId] || 0) + 101;
    room.game.penaltyMessages.push({
      playerId: ownerId,
      amount: 101,
      reason: "Okey çaldırdı.",
      createdAt: Date.now(),
    });
  }

  room.game.hands[socket.id] = hand.filter((tile) => !usedHandIds.has(tile.id));

  const [removedJoker] = group.layout.splice(jokerIndex, 1);

  if (group.kind === "set" && requiredReplacements.length > 1) {
    const usedSlots = new Set(group.layout.map((item) => item.slot));
    const preferredSlots =
      group.number === 13
        ? [13, 12, 11, 10]
        : [group.number, group.number + 1, group.number + 2, group.number + 3].map((slot) =>
            Math.min(slot, 13)
          );

    replacementTiles.forEach((tile) => {
      const slot = preferredSlots.find((item) => !usedSlots.has(item)) || group.number;
      usedSlots.add(slot);

      group.layout.push({
        slot,
        tile,
        represents: null,
      });
    });
  } else {
    group.layout.push({
      slot: removedJoker.slot,
      tile: replacementTiles[0],
      represents: null,
    });
  }

  group.layout.sort((a, b) => a.slot - b.slot);
  room.game.hands[socket.id].push(removedJoker.tile);

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
    const __roomForSeriesRule = rooms && roomCode ? rooms[roomCode] : null;
    if (__roomForSeriesRule && __roomForSeriesRule.game && __roomForSeriesRule.game.playerOpenTypes) {
      const __myOpenType = __roomForSeriesRule.game.playerOpenTypes[socket.id];

      if (__myOpenType === "pairs") {
        socket.emit("error-message", "Çift açan kişi seri açamaz. Sadece yerdeki serilere taş işleyebilirsin.");
        return;
      }
    }

    openGroups(socket, roomCode, groups, "series");
  });

  socket.on("open-pairs", ({ roomCode, groups }) => {
    const __roomForPairRule = rooms && roomCode ? rooms[roomCode] : null;
    if (__roomForPairRule && __roomForPairRule.game && __roomForPairRule.game.playerOpenTypes) {
      const __myOpenType = __roomForPairRule.game.playerOpenTypes[socket.id];

      if (__myOpenType === "series" && !__someoneOpenedPairs(__roomForPairRule, socket.id)) {
        socket.emit("error-message", "Birisi çift açmadan çift açamazsın.");
        return;
      }
    }

    openGroups(socket, roomCode, groups, "pairs");
  });

  socket.on("process-tile", ({ roomCode, openedGroupId, tileId }) => {
    const result = getRoomOrError(socket, roomCode);
    if (!result) return;

    const { room, code } = result;

    if (room.game.currentTurnPlayerId !== socket.id) {
      socket.emit("error-message", "Sıra sende değil.");
      return;
    }

    if (!room.game.playerOpenTypes[socket.id]) {
      socket.emit("error-message", "Taş işlemek için önce elini açmalısın.");
      return;
    }

    const processed = processTileToGroup(room, socket.id, openedGroupId, tileId);

    if (!processed.ok) {
      socket.emit("error-message", processed.message);
      return;
    }

    broadcastGame(code);
  });

  socket.on("replace-joker", ({ roomCode, openedGroupId, jokerTileId }) => {
    replaceJoker(socket, roomCode, openedGroupId, jokerTileId);
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


function __getTileValueForUsefulCheck(room, tile) {
  if (!tile) return null;

  const indicator = room?.game?.indicatorTile;
  const okey = room?.game?.okeyTile;

  if (tile.fake && okey) {
    return {
      color: okey.color,
      number: okey.number,
      fake: true,
    };
  }

  if (okey && !tile.fake && tile.color === okey.color && tile.number === okey.number) {
    return {
      color: "__joker__",
      number: "__joker__",
      joker: true,
    };
  }

  return {
    color: tile.color,
    number: tile.number,
  };
}

function __getOpenedGroupEntriesForUsefulCheck(room, group) {
  if (!group) return [];

  const rawEntries = Array.isArray(group.layout)
    ? group.layout
    : Array.isArray(group.tiles)
      ? group.tiles.map((tile, index) => ({ tile, slot: index + 1 }))
      : [];

  return rawEntries
    .map((entry, index) => {
      const tile = entry.tile || entry;
      const value = entry.represents || __getTileValueForUsefulCheck(room, tile);

      if (!value) return null;

      return {
        slot: Number(entry.slot || index + 1),
        color: value.color,
        number: value.number,
        joker: value.joker,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.slot - b.slot);
}

function __isTileUsefulForSeriesGroup(room, tile, group) {
  const tileValue = __getTileValueForUsefulCheck(room, tile);
  if (!tileValue) return false;

  const entries = __getOpenedGroupEntriesForUsefulCheck(room, group);
  if (!entries.length) return false;

  if (tileValue.joker) return true;

  const nonJokerEntries = entries.filter((entry) => !entry.joker);

  if (!nonJokerEntries.length) return true;

  const sameColorEntries = nonJokerEntries.filter((entry) => entry.color === tileValue.color);
  const sameNumberEntries = nonJokerEntries.filter((entry) => entry.number === tileValue.number);

  const looksLikeRun = sameColorEntries.length >= 2;
  const looksLikeSet = sameNumberEntries.length >= 2;

  if (looksLikeRun) {
    const numbers = sameColorEntries.map((entry) => Number(entry.number)).filter(Number.isFinite);
    if (!numbers.length) return false;

    const min = Math.min(...numbers);
    const max = Math.max(...numbers);

    return Number(tileValue.number) === min - 1 || Number(tileValue.number) === max + 1;
  }

  if (looksLikeSet) {
    const usedColors = new Set(nonJokerEntries.map((entry) => entry.color));
    return Number(tileValue.number) === Number(sameNumberEntries[0].number) && !usedColors.has(tileValue.color);
  }

  return false;
}

function __isTileUsefulForPairsGroup(room, tile, group) {
  const tileValue = __getTileValueForUsefulCheck(room, tile);
  if (!tileValue) return false;

  if (tileValue.joker) return true;

  const entries = __getOpenedGroupEntriesForUsefulCheck(room, group);
  if (!entries.length) return false;

  return entries.some((entry) => {
    if (entry.joker) return true;
    return entry.color === tileValue.color && Number(entry.number) === Number(tileValue.number);
  });
}

function __isUsefulDiscardTile(room, tile) {
  const seriesGroups = room?.game?.openedSeries || [];
  const pairGroups = room?.game?.openedPairs || [];

  const usefulForSeries = seriesGroups.some((group) =>
    __isTileUsefulForSeriesGroup(room, tile, group)
  );

  const usefulForPairs = pairGroups.some((group) =>
    __isTileUsefulForPairsGroup(room, tile, group)
  );

  return usefulForSeries || usefulForPairs;
}

function __addInstantPenalty(room, playerId, amount, reason, tile) {
  if (!room.totalScores) room.totalScores = {};
  if (!room.game.penaltyMessages) room.game.penaltyMessages = [];

  room.totalScores[playerId] = (room.totalScores[playerId] || 0) + amount;

  room.game.penaltyMessages.push({
    playerId,
    amount,
    reason,
    tile,
    createdAt: Date.now(),
  });

  if (typeof io !== "undefined") {
    io.to(playerId).emit("penalty-message", {
      message: reason + " +" + amount + " ceza yedin.",
      amount,
      reason,
      tile,
      totalScore: room.totalScores[playerId],
    });
  }
}

function __someoneOpenedPairs(room, currentPlayerId) {
  return Object.entries(room?.game?.playerOpenTypes || {}).some(([playerId, openType]) => {
    return playerId !== currentPlayerId && openType === "pairs";
  });
}




function safeTileValueForIslek(room, tile) {
  if (!tile) return null;

  const okey = room?.game?.okeyTile;

  if (tile.fake && okey) {
    return {
      color: okey.color,
      number: Number(okey.number),
      joker: false,
    };
  }

  if (
    okey &&
    !tile.fake &&
    tile.color === okey.color &&
    Number(tile.number) === Number(okey.number)
  ) {
    return {
      color: "__joker__",
      number: -1,
      joker: true,
    };
  }

  return {
    color: tile.color,
    number: Number(tile.number),
    joker: false,
  };
}

function safeOpenedEntriesForIslek(room, group) {
  if (!group) return [];

  let raw = [];

  if (Array.isArray(group.layout)) {
    raw = group.layout;
  } else if (Array.isArray(group.tiles)) {
    raw = group.tiles.map((tile, index) => ({
      tile,
      slot: index + 1,
    }));
  }

  return raw
    .map((entry, index) => {
      const tile = entry.tile || entry;
      const value = entry.represents || safeTileValueForIslek(room, tile);

      if (!value) return null;

      return {
        slot: Number(entry.slot || index + 1),
        color: value.color,
        number: Number(value.number),
        joker: Boolean(value.joker),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.slot - b.slot);
}

function isUsefulForOpenedSeries(room, discardedTile, group) {
  const tileValue = safeTileValueForIslek(room, discardedTile);
  if (!tileValue) return false;

  if (tileValue.joker) return true;

  const entries = safeOpenedEntriesForIslek(room, group);
  const normal = entries.filter((entry) => !entry.joker);

  if (normal.length < 2) return false;

  const sameColor = normal.filter((entry) => entry.color === tileValue.color);
  const sameNumber = normal.filter((entry) => Number(entry.number) === Number(tileValue.number));

  const looksLikeRun = sameColor.length >= 2;
  const looksLikeSet = sameNumber.length >= 2;

  if (looksLikeRun) {
    const nums = sameColor
      .map((entry) => Number(entry.number))
      .filter(Number.isFinite);

    if (!nums.length || !Number.isFinite(tileValue.number)) return false;

    const min = Math.min(...nums);
    const max = Math.max(...nums);

    return tileValue.number === min - 1 || tileValue.number === max + 1;
  }

  if (looksLikeSet) {
    const usedColors = new Set(normal.map((entry) => entry.color));
    const setNumber = Number(sameNumber[0]?.number);

    return Number(tileValue.number) === setNumber && !usedColors.has(tileValue.color);
  }

  return false;
}

function isUsefulForOpenedPair(room, discardedTile, group) {
  const tileValue = safeTileValueForIslek(room, discardedTile);
  if (!tileValue) return false;

  if (tileValue.joker) return true;

  const entries = safeOpenedEntriesForIslek(room, group);
  if (!entries.length) return false;

  return entries.some((entry) => {
    if (entry.joker) return true;

    return (
      entry.color === tileValue.color &&
      Number(entry.number) === Number(tileValue.number)
    );
  });
}

function isIslekDiscard(room, discardedTile) {
  try {
    const openedSeries = Array.isArray(room?.game?.openedSeries)
      ? room.game.openedSeries
      : [];

    const openedPairs = Array.isArray(room?.game?.openedPairs)
      ? room.game.openedPairs
      : [];

    const usefulSeries = openedSeries.some((group) => {
      return isUsefulForOpenedSeries(room, discardedTile, group);
    });

    const usefulPair = openedPairs.some((group) => {
      return isUsefulForOpenedPair(room, discardedTile, group);
    });

    return usefulSeries || usefulPair;
  } catch (error) {
    console.log("İşlek taş kontrol hatası:", error.message);
    return false;
  }
}

function addIslekPenaltyScoreOnly(room, playerId, discardedTile) {
  try {
    if (!room.totalScores) room.totalScores = {};

    room.totalScores[playerId] = (room.totalScores[playerId] || 0) + 101;

    if (!room.game) room.game = {};
    if (!Array.isArray(room.game.penaltyMessages)) room.game.penaltyMessages = [];

    const player = Array.isArray(room.players)
      ? room.players.find((p) => p.id === playerId || p.socketId === playerId)
      : null;

    const playerName = player?.name || "Bir oyuncu";

    room.game.penaltyMessages.push({
      playerId,
      playerName,
      amount: 101,
      reason: "İşlek taş attı",
      message: playerName + " işlek taş attığı için 101 ceza yedi.",
      tile: discardedTile,
      createdAt: Date.now(),
    });

    console.log(playerName + " işlek taş attığı için 101 ceza yedi.");
  } catch (error) {
    console.log("İşlek ceza yazma hatası:", error.message);
  }
}

