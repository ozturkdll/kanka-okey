const fs = require("fs");

const serverPath = "server/index.js";

if (!fs.existsSync(serverPath)) {
  console.error("server/index.js bulunamadı.");
  process.exit(1);
}

let server = fs.readFileSync(serverPath, "utf8");

const helperCode = `
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
`;

if (!server.includes("function isIslekDiscard")) {
  server += "\n\n" + helperCode + "\n";
}

const discardRegex =
  /function discardTileForPlayer\s*\(\s*room\s*,\s*playerId\s*,\s*tileId\s*\)\s*\{[\s\S]*?\n\}\s*\n\s*function passTurn/;

if (!discardRegex.test(server)) {
  console.error("discardTileForPlayer fonksiyonu bulunamadı.");
  process.exit(1);
}

const newDiscardFunction = `function discardTileForPlayer(room, playerId, tileId) {
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

function passTurn`;

server = server.replace(discardRegex, newDiscardFunction);

fs.writeFileSync(serverPath, server);

console.log("İşlek taş atan açılmış oyuncuya +101 ceza sistemi eklendi.");
console.log("Uyarı çıkmasa bile skor hanesine +101 yazılacak.");
console.log("Server patlamasın diye kontrol try/catch içinde.");