const fs = require("fs");

const serverPath = "server/index.js";
const appPath = "src/App.jsx";

let server = fs.readFileSync(serverPath, "utf8");
let app = fs.readFileSync(appPath, "utf8");

function replaceBetween(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start === -1) return source;

  const end = source.indexOf(endMarker, start);
  if (end === -1) return source;

  return source.slice(0, start) + replacement + source.slice(end);
}

/* SERVER: işlek taş cezasını tüm masaya bildir */

const newPenaltyFunction = `
function __findRoomCodeForPenalty(room) {
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

function __getPlayerNameForPenalty(room, playerId) {
  const players = room && Array.isArray(room.players) ? room.players : [];
  const player = players.find((item) => {
    return item.id === playerId || item.socketId === playerId;
  });

  return player && player.name ? player.name : "Bir oyuncu";
}

function __addInstantPenalty(room, playerId, amount, reason, tile) {
  if (!room.totalScores) room.totalScores = {};
  if (!room.game) room.game = {};
  if (!room.game.penaltyMessages) room.game.penaltyMessages = [];

  room.totalScores[playerId] = (room.totalScores[playerId] || 0) + amount;

  const playerName = __getPlayerNameForPenalty(room, playerId);
  const cleanReason = reason || "Ceza";
  const tableMessage = playerName + " " + cleanReason.toLowerCase() + " için " + amount + " ceza yedi.";

  const penalty = {
    playerId,
    playerName,
    amount,
    reason: cleanReason,
    message: tableMessage,
    tile,
    createdAt: Date.now(),
  };

  room.game.penaltyMessages.push(penalty);

  const roomCode = __findRoomCodeForPenalty(room);

  if (typeof io !== "undefined") {
    if (roomCode) {
      io.to(roomCode).emit("table-message", {
        type: "penalty",
        message: tableMessage,
        playerId,
        playerName,
        amount,
        reason: cleanReason,
        tile,
      });
    }

    io.to(playerId).emit("penalty-message", {
      message: tableMessage,
      amount,
      reason: cleanReason,
      tile,
      totalScore: room.totalScores[playerId],
    });
  }
}
`;

if (server.includes("function __addInstantPenalty")) {
  server = server.replace(
    /function __findRoomCodeForPenalty[\s\S]*?function __addInstantPenalty[\s\S]*?\n\}/,
    newPenaltyFunction.trim()
  );

  server = server.replace(
    /function __addInstantPenalty[\s\S]*?\n\}/,
    newPenaltyFunction.trim()
  );
} else {
  server += "\n\n" + newPenaltyFunction + "\n";
}

/* Eğer discard içinde eski reason varsa düzelt */
server = server.replaceAll(
  '__addInstantPenalty(room, playerId, 101, "İşlek taş attın.", tile);',
  '__addInstantPenalty(room, playerId, 101, "işlek taş attığı", tile);'
);

server = server.replaceAll(
  '__addInstantPenalty(room, playerId, 101, "İşlek taş attı.", tile);',
  '__addInstantPenalty(room, playerId, 101, "işlek taş attığı", tile);'
);

/* APP: masa bildirimi state */
if (!app.includes("const [tableMessages, setTableMessages]")) {
  app = app.replace(
    'const [showScoreboard, setShowScoreboard] = useState(false);',
    'const [showScoreboard, setShowScoreboard] = useState(false);\n  const [tableMessages, setTableMessages] = useState([]);'
  );
}

/* APP: table-message socket listener */
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
      const message = data && data.message ? data.message : "Masa bildirimi";

      setTableMessages((prev) => {
        return [...prev, { id, message }].slice(-3);
      });

      setTimeout(() => {
        setTableMessages((prev) => prev.filter((item) => item.id !== id));
      }, 5000);
    });`
  );

  app = app.replace(
    `      socket.off("connect_error");`,
    `      socket.off("connect_error");
      socket.off("table-message");`
  );
}

/* APP: toast CSS */
if (!app.includes(".table-toast-stack")) {
  app = app.replace(
    `.notice-pill {`,
    `.table-toast-stack {
  position: absolute;
  left: 50%;
  top: 58px;
  transform: translateX(-50%);
  z-index: 120;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.table-toast {
  min-width: 260px;
  max-width: 520px;
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(250, 204, 21, 0.7);
  color: #fef3c7;
  font-size: 13px;
  font-weight: 900;
  text-align: center;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.35);
}

.notice-pill {`
  );
}

/* APP: toast JSX */
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

/* APP: orta alanı baştan sade ve geniş tasarım */
const newMiddleCss = `/* ORTA AÇMA ALANI */
.open-area {
  position: absolute;
  left: 96px;
  right: 96px;
  top: 52px;
  bottom: 238px;
  z-index: 5;
  display: flex;
  gap: 10px;
}

.open-area-main,
.open-area-pairs {
  position: relative;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid rgba(214, 228, 240, 0.42);
  background: rgba(24, 47, 67, 0.72);
  box-shadow:
    inset 0 0 20px rgba(255, 255, 255, 0.035),
    0 0 12px rgba(0, 0, 0, 0.18);
}

.open-area-main {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 26px 8px 8px;
}

.open-area-pairs {
  width: 186px;
  flex: 0 0 186px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 26px 8px 8px;
}

.series-section,
.pair-section {
  display: grid;
  min-height: 0;
  gap: 5px;
}

.series-section,
.pair-section {
  grid-template-rows: repeat(12, 1fr);
}

.series-row {
  display: grid;
  grid-template-columns: repeat(13, 1fr);
  gap: 4px;
  min-height: 0;
}

.pair-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  min-height: 0;
}

.series-cell,
.pair-cell {
  min-height: 0;
  border: 1px solid rgba(214, 228, 240, 0.28);
  background: rgba(255, 255, 255, 0.035);
  border-radius: 5px;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  overflow: hidden;
}

.series-cell.drop-target,
.pair-cell.drop-target {
  background: rgba(34, 197, 94, 0.16);
  border-color: rgba(34, 197, 94, 0.65);
}

.open-area-label,
.open-area-right-label {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  color: rgba(255, 255, 255, 0.68);
  font-size: 10px;
  font-weight: 900;
  background: rgba(2, 6, 23, 0.38);
  border-radius: 999px;
  padding: 3px 10px;
  white-space: nowrap;
}

.opened-tile {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  border-radius: 4px;
  background: #f8fafc;
  color: #020617;
  border: none;
  font-size: 18px;
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

app = replaceBetween(app, "/* ORTA AÇMA ALANI */", ".hand-summary-box {", newMiddleCss);

/* Mobil orta alan */
app = app.replace(
  /\.open-area \{\s*left: 82px;[\s\S]*?\.opened-tile \{\s*font-size: 11px;\s*\}/,
  `.open-area {
    left: 78px;
    right: 78px;
    top: 58px;
    bottom: 285px;
    gap: 6px;
  }

  .open-area-main {
    gap: 5px;
    padding: 24px 5px 5px;
  }

  .open-area-pairs {
    width: 132px;
    flex-basis: 132px;
    gap: 5px;
    padding: 24px 5px 5px;
  }

  .series-section,
  .pair-section {
    gap: 3px;
  }

  .series-row,
  .pair-row {
    gap: 2px;
  }

  .series-cell,
  .pair-cell {
    border-radius: 3px;
  }

  .opened-tile {
    font-size: 12px;
  }`
);

fs.writeFileSync(serverPath, server);
fs.writeFileSync(appPath, app);

console.log("Bitti.");
console.log("Masa bildirimi eklendi.");
console.log("Orta açma alanı baştan sade ve geniş tasarlandı.");