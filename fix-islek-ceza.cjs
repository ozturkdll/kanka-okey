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

/* =========================
   SERVER: işlek taş helperları
========================= */

const helperCode = `
function __getRoomCodeFromRoom(room) {
  if (!room) return null;

  if (room.roomCode) return room.roomCode;
  if (room.code) return room.code;
  if (room.id) return room.id;

  if (typeof rooms !== "undefined") {
    if (rooms instanceof Map) {
      for (const [code, candidateRoom] of rooms.entries()) {
        if (candidateRoom === room) return code;
      }
    } else {
      for (const [code, candidateRoom] of Object.entries(rooms)) {
        if (candidateRoom === room) return code;
      }
    }
  }

  return null;
}

function __getPlayerNameForIslek(room, playerId) {
  const players = room && Array.isArray(room.players) ? room.players : [];
  const player = players.find((item) => {
    return item.id === playerId || item.socketId === playerId;
  });

  return player && player.name ? player.name : "Bir oyuncu";
}

function __getUsefulTileValue(room, tile) {
  if (!tile) return null;

  const okey = room && room.game ? room.game.okeyTile : null;

  if (tile.fake && okey) {
    return {
      color: okey.color,
      number: Number(okey.number),
      fake: true,
    };
  }

  if (okey && !tile.fake && tile.color === okey.color && Number(tile.number) === Number(okey.number)) {
    return {
      color: "__joker__",
      number: "__joker__",
      joker: true,
    };
  }

  return {
    color: tile.color,
    number: Number(tile.number),
  };
}

function __getOpenedEntries(room, group) {
  if (!group) return [];

  let rawEntries = [];

  if (Array.isArray(group.layout)) {
    rawEntries = group.layout;
  } else if (Array.isArray(group.tiles)) {
    rawEntries = group.tiles.map((tile, index) => ({
      tile,
      slot: index + 1,
    }));
  }

  return rawEntries
    .map((entry, index) => {
      const tile = entry.tile || entry;
      const value = entry.represents || __getUsefulTileValue(room, tile);

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

function __isUsefulForSeriesGroup(room, tile, group) {
  const tileValue = __getUsefulTileValue(room, tile);
  if (!tileValue) return false;

  if (tileValue.joker) return true;

  const entries = __getOpenedEntries(room, group);
  if (!entries.length) return false;

  const normalEntries = entries.filter((entry) => !entry.joker);

  if (!normalEntries.length) return true;

  const sameColorEntries = normalEntries.filter((entry) => entry.color === tileValue.color);
  const sameNumberEntries = normalEntries.filter((entry) => Number(entry.number) === Number(tileValue.number));

  const looksLikeRun = sameColorEntries.length >= 2;
  const looksLikeSet = sameNumberEntries.length >= 2;

  if (looksLikeRun) {
    const numbers = sameColorEntries
      .map((entry) => Number(entry.number))
      .filter(Number.isFinite);

    if (!numbers.length || !Number.isFinite(tileValue.number)) return false;

    const min = Math.min(...numbers);
    const max = Math.max(...numbers);

    return tileValue.number === min - 1 || tileValue.number === max + 1;
  }

  if (looksLikeSet) {
    const setNumber = Number(sameNumberEntries[0].number);
    const usedColors = new Set(normalEntries.map((entry) => entry.color));

    return Number(tileValue.number) === setNumber && !usedColors.has(tileValue.color);
  }

  return false;
}

function __isUsefulForPairGroup(room, tile, group) {
  const tileValue = __getUsefulTileValue(room, tile);
  if (!tileValue) return false;

  if (tileValue.joker) return true;

  const entries = __getOpenedEntries(room, group);
  if (!entries.length) return false;

  return entries.some((entry) => {
    if (entry.joker) return true;

    return (
      entry.color === tileValue.color &&
      Number(entry.number) === Number(tileValue.number)
    );
  });
}

function __isUsefulDiscardTile(room, tile) {
  const openedSeries = room && room.game && Array.isArray(room.game.openedSeries)
    ? room.game.openedSeries
    : [];

  const openedPairs = room && room.game && Array.isArray(room.game.openedPairs)
    ? room.game.openedPairs
    : [];

  const usefulForSeries = openedSeries.some((group) => {
    return __isUsefulForSeriesGroup(room, tile, group);
  });

  const usefulForPairs = openedPairs.some((group) => {
    return __isUsefulForPairGroup(room, tile, group);
  });

  return usefulForSeries || usefulForPairs;
}

function __addIslekPenalty(room, playerId, tile) {
  if (!room.totalScores) room.totalScores = {};
  if (!room.game) room.game = {};
  if (!room.game.penaltyMessages) room.game.penaltyMessages = [];

  room.totalScores[playerId] = (room.totalScores[playerId] || 0) + 101;

  const playerName = __getPlayerNameForIslek(room, playerId);
  const message = playerName + " işlek taş attığı için 101 ceza yedi.";

  const penalty = {
    playerId,
    playerName,
    amount: 101,
    reason: "İşlek taş",
    message,
    tile,
    createdAt: Date.now(),
  };

  room.game.penaltyMessages.push(penalty);

  const roomCode = __getRoomCodeFromRoom(room);

  if (typeof io !== "undefined") {
    if (roomCode) {
      io.to(roomCode).emit("table-message", {
        type: "penalty",
        message,
        playerId,
        playerName,
        amount: 101,
        reason: "İşlek taş",
        tile,
      });
    }

    io.to(playerId).emit("penalty-message", {
      type: "penalty",
      message,
      playerId,
      playerName,
      amount: 101,
      reason: "İşlek taş",
      tile,
    });
  }
}
`;

if (!server.includes("function __isUsefulDiscardTile")) {
  server += "\n\n" + helperCode + "\n";
}

/* =========================
   SERVER: discardTileForPlayer içine ceza ekle
========================= */

const discardRegex =
  /function discardTileForPlayer\s*\(\s*room\s*,\s*playerId\s*,\s*tileId\s*\)\s*\{[\s\S]*?\n\}\s*\n\s*function passTurn/;

if (!discardRegex.test(server)) {
  console.error("discardTileForPlayer fonksiyonu bulunamadı. server/index.js içeriğini bana atman gerekebilir.");
  process.exit(1);
}

if (!server.includes("__addIslekPenalty(room, playerId, tile);")) {
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

  if (playerOpened && __isUsefulDiscardTile(room, tile)) {
    __addIslekPenalty(room, playerId, tile);
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
}

/* =========================
   APP: masa uyarısı state
========================= */

if (!app.includes("const [tableMessages, setTableMessages]")) {
  app = app.replace(
    "const [showScoreboard, setShowScoreboard] = useState(false);",
    `const [showScoreboard, setShowScoreboard] = useState(false);
  const [tableMessages, setTableMessages] = useState([]);`
  );
}

/* Eski penalty alert varsa patlamasın diye alert yerine küçük uyarıya çevir */
app = app.replace(
  /socket\.on\("penalty-message",\s*\(data\)\s*=>\s*\{[\s\S]*?\}\);/g,
  `socket.on("penalty-message", (data) => {
      const id = Date.now() + Math.random();
      const message = data?.message || "Ceza yedin.";

      setTableMessages((prev) => [...prev, { id, message }].slice(-3));

      setTimeout(() => {
        setTableMessages((prev) => prev.filter((item) => item.id !== id));
      }, 5000);
    });`
);

/* APP: table-message listener */
if (!app.includes('socket.on("table-message"')) {
  app = app.replace(
    `    socket.on("connect_error", () => {
      setConnectionStatus("Server bağlantı hatası");
    });`,
    `    socket.on("connect_error", () => {
      setConnectionStatus("Server bağlantı hatası");
    });

    socket.on("table-message", (data) => {
      const id = Date.now() + Math.random();
      const message = data?.message || "Masa bildirimi";

      setTableMessages((prev) => [...prev, { id, message }].slice(-3));

      setTimeout(() => {
        setTableMessages((prev) => prev.filter((item) => item.id !== id));
      }, 5000);
    });`
  );
}

if (!app.includes('socket.off("table-message")')) {
  app = app.replace(
    `      socket.off("connect_error");`,
    `      socket.off("connect_error");
      socket.off("table-message");`
  );
}

if (!app.includes('socket.off("penalty-message")')) {
  app = app.replace(
    `      socket.off("error-message");`,
    `      socket.off("penalty-message");
      socket.off("error-message");`
  );
}

/* APP: küçük uyarı CSS */
if (!app.includes(".table-toast-stack")) {
  app = app.replace(
    `.notice-pill {`,
    `.table-toast-stack {
  position: absolute;
  left: 50%;
  top: 58px;
  transform: translateX(-50%);
  z-index: 130;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.table-toast {
  min-width: 260px;
  max-width: 560px;
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(250, 204, 21, 0.75);
  color: #fef3c7;
  font-size: 13px;
  font-weight: 900;
  text-align: center;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.35);
}

.notice-pill {`
  );
}

/* APP: küçük uyarı JSX */
if (!app.includes('className="table-toast-stack"')) {
  app = app.replace(
    `<div className="table-felt">`,
    `<div className="table-felt">
                {tableMessages.length > 0 && (
                  <div className="table-toast-stack">
                    {tableMessages.map((item) => (
                      <div className="table-toast" key={item.id}>
                        {item.message}
                      </div>
                    ))}
                  </div>
                )}`
  );
}

fs.writeFileSync(serverPath, server);
fs.writeFileSync(appPath, app);

console.log("İşlek taş cezası eklendi.");
console.log("İşlek atan oyuncuya +101 yazılır.");
console.log("Ekranda küçük uyarı çıkar: X işlek taş attığı için 101 ceza yedi.");