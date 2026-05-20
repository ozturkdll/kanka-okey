const fs = require("fs");

const serverPath = "server/index.js";
const appPath = "src/App.jsx";

if (!fs.existsSync(serverPath)) {
  console.error("server/index.js bulunamadı.");
  process.exit(1);
}

if (!fs.existsSync(appPath)) {
  console.error("src/App.jsx bulunamadı.");
  process.exit(1);
}

let server = fs.readFileSync(serverPath, "utf8");
let app = fs.readFileSync(appPath, "utf8");

let serverChanged = false;
let appChanged = false;

function injectAfter(source, marker, code) {
  if (!source.includes(marker)) return null;
  if (source.includes(code.trim().split("\n")[0].trim())) return source;
  return source.replace(marker, marker + "\n" + code);
}

const helperCode = `
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
`;

if (!server.includes("function __getTileValueForUsefulCheck")) {
  server += "\n\n" + helperCode + "\n";
  serverChanged = true;
}

const openPairsRegex = /socket\.on\(["']open-pairs["'],\s*\(([^)]*)\)\s*=>\s*\{/;
const openPairsMatch = server.match(openPairsRegex);

if (openPairsMatch && !server.includes("Birisi çift açmadan çift açamazsın.")) {
  const injected = `
    const __roomForPairRule = rooms && roomCode ? rooms[roomCode] : null;
    if (__roomForPairRule && __roomForPairRule.game && __roomForPairRule.game.playerOpenTypes) {
      const __myOpenType = __roomForPairRule.game.playerOpenTypes[socket.id];

      if (__myOpenType === "series" && !__someoneOpenedPairs(__roomForPairRule, socket.id)) {
        socket.emit("error-message", "Birisi çift açmadan çift açamazsın.");
        return;
      }
    }
`;
  server = server.replace(openPairsRegex, (m) => m + injected);
  serverChanged = true;
}

const openSeriesRegex = /socket\.on\(["']open-series["'],\s*\(([^)]*)\)\s*=>\s*\{/;
const openSeriesMatch = server.match(openSeriesRegex);

if (openSeriesMatch && !server.includes("Çift açan kişi seri açamaz.")) {
  const injected = `
    const __roomForSeriesRule = rooms && roomCode ? rooms[roomCode] : null;
    if (__roomForSeriesRule && __roomForSeriesRule.game && __roomForSeriesRule.game.playerOpenTypes) {
      const __myOpenType = __roomForSeriesRule.game.playerOpenTypes[socket.id];

      if (__myOpenType === "pairs") {
        socket.emit("error-message", "Çift açan kişi seri açamaz. Sadece yerdeki serilere taş işleyebilirsin.");
        return;
      }
    }
`;
  server = server.replace(openSeriesRegex, (m) => m + injected);
  serverChanged = true;
}

const discardFunctionRegex =
  /function discardTileForPlayer\s*\(\s*room\s*,\s*playerId\s*,\s*tileId\s*\)\s*\{[\s\S]*?\n\}\s*\n\s*function passTurn/;

if (discardFunctionRegex.test(server) && !server.includes("__isUsefulDiscardTile(room, tile)")) {
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

  const playerOpened = Boolean(room.game.playerOpenTypes && room.game.playerOpenTypes[playerId]);

  if (playerOpened && __isUsefulDiscardTile(room, tile)) {
    __addInstantPenalty(room, playerId, 101, "İşlek taş attın.", tile);
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

  server = server.replace(discardFunctionRegex, newDiscardFunction);
  serverChanged = true;
} else if (!server.includes("__isUsefulDiscardTile(room, tile)")) {
  console.log("UYARI: discardTileForPlayer fonksiyonu otomatik bulunamadı. İşlek taş cezası için server/index.js içeriğini atman gerekebilir.");
}

if (!server.includes('socket.on("penalty-message"') && !server.includes("socket.on('penalty-message'")) {
  console.log("Server penalty-message emit ediyor. App tarafı da dinleyecek.");
}

if (!app.includes('socket.on("penalty-message"')) {
  app = app.replace(
    `    socket.on("error-message", (message) => {`,
    `    socket.on("penalty-message", (data) => {
      alert(data?.message || "Ceza yedin.");
    });

    socket.on("error-message", (message) => {`
  );

  app = app.replace(
    `      socket.off("error-message");`,
    `      socket.off("penalty-message");
      socket.off("error-message");`
  );

  appChanged = true;
}

const openAreaCssRegex = /\/\* ORTA AÇMA ALANI \*\/[\s\S]*?\.hand-summary-box \{/;

const newOpenAreaCss = `/* ORTA AÇMA ALANI */
.open-area {
  position: absolute;
  left: 104px;
  right: 104px;
  top: 68px;
  bottom: 258px;
  z-index: 5;
  display: flex;
  gap: 8px;
}

.open-area-main,
.open-area-pairs {
  position: relative;
  height: 100%;
  border-radius: 7px;
  overflow: hidden;
  border: 2px solid rgba(214, 228, 240, 0.55);
  background:
    linear-gradient(rgba(164, 185, 203, 0.16) 1px, transparent 1px),
    linear-gradient(90deg, rgba(164, 185, 203, 0.16) 1px, transparent 1px),
    linear-gradient(180deg, rgba(32, 54, 74, 0.86), rgba(27, 48, 67, 0.86));
  background-size: 34px 34px, 34px 34px, 100% 100%;
  box-shadow:
    inset 0 0 18px rgba(255, 255, 255, 0.025),
    0 0 10px rgba(0, 0, 0, 0.14);
}

.open-area-main {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  padding: 5px;
}

.open-area-pairs {
  width: 178px;
  flex: 0 0 178px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  padding: 5px;
}

.series-section,
.pair-section {
  display: grid;
  min-height: 0;
  gap: 3px;
}

.series-section {
  grid-template-rows: repeat(12, 1fr);
}

.pair-section {
  grid-template-rows: repeat(12, 1fr);
}

.series-row {
  display: grid;
  grid-template-columns: repeat(13, 1fr);
  gap: 3px;
  min-height: 0;
}

.pair-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 3px;
  min-height: 0;
}

.series-cell,
.pair-cell {
  min-height: 0;
  border: 1px solid rgba(174, 195, 210, 0.24);
  background: rgba(255, 255, 255, 0.012);
  border-radius: 3px;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  overflow: hidden;
}

.series-cell.drop-target,
.pair-cell.drop-target {
  background: rgba(34, 197, 94, 0.14);
  border-color: rgba(34, 197, 94, 0.62);
}

.open-area-label,
.open-area-right-label {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  color: rgba(255, 255, 255, 0.58);
  font-size: 10px;
  font-weight: 900;
  background: rgba(2, 6, 23, 0.34);
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
}

.opened-tile {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  border-radius: 2px;
  background: #f8fafc;
  color: #020617;
  border: none;
  font-size: 16px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.10);
  cursor: pointer;
}

.opened-tile.red {
  color: #dc2626;
}

.opened-tile.blue {
  color: #2563eb;
}

.opened-tile.black {
  color: #020617;
}

.opened-tile.yellow {
  color: #ca8a04;
}

.opened-tile.fake {
  color: #7c3aed;
  border: 1px solid #a855f7;
}

.opened-tile.joker-opened {
  outline: 2px solid #facc15;
  outline-offset: -2px;
}

.hand-summary-box {`;

if (openAreaCssRegex.test(app)) {
  app = app.replace(openAreaCssRegex, newOpenAreaCss);
  appChanged = true;
} else {
  console.log("UYARI: App.jsx içindeki ORTA AÇMA ALANI CSS bloğu bulunamadı.");
}

const mediaCssRegex = /\.open-area \{\s*left: 82px;[\s\S]*?\.opened-tile \{\s*font-size: 11px;\s*\}/;

const newMediaCss = `.open-area {
    left: 82px;
    right: 82px;
    top: 66px;
    bottom: 288px;
    gap: 5px;
  }

  .open-area-main {
    gap: 3px;
    padding: 4px;
  }

  .open-area-pairs {
    width: 130px;
    flex-basis: 130px;
    gap: 3px;
    padding: 4px;
  }

  .series-section,
  .pair-section {
    gap: 2px;
  }

  .series-row,
  .pair-row {
    gap: 2px;
  }

  .series-cell,
  .pair-cell {
    border-radius: 2px;
  }

  .opened-tile {
    font-size: 11px;
  }`;

if (mediaCssRegex.test(app)) {
  app = app.replace(mediaCssRegex, newMediaCss);
  appChanged = true;
}

fs.writeFileSync(serverPath, server);
fs.writeFileSync(appPath, app);

console.log("Bitti.");
console.log("Server değişti:", serverChanged);
console.log("App değişti:", appChanged);
console.log("Şimdi npm run build çalıştır.");