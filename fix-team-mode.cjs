const fs = require("fs");

const appPath = "src/App.jsx";
const serverPath = "server/index.js";

if (!fs.existsSync(appPath)) {
  console.error("src/App.jsx bulunamadı.");
  process.exit(1);
}

if (!fs.existsSync(serverPath)) {
  console.error("server/index.js bulunamadı.");
  process.exit(1);
}

let app = fs.readFileSync(appPath, "utf8");
let server = fs.readFileSync(serverPath, "utf8");

/* =========================
   APP: state ekle
========================= */

if (!app.includes("const [gameMode, setGameMode]")) {
  app = app.replace(
    `const [joinCode, setJoinCode] = useState("");`,
    `const [joinCode, setJoinCode] = useState("");
  const [gameMode, setGameMode] = useState("solo");`
  );
}

if (!app.includes("const [roomGameMode, setRoomGameMode]")) {
  app = app.replace(
    `const [gameStarted, setGameStarted] = useState(false);`,
    `const [gameStarted, setGameStarted] = useState(false);
  const [roomGameMode, setRoomGameMode] = useState("solo");`
  );
}

/* =========================
   APP: server data içinden gameMode al
========================= */

if (!app.includes("setRoomGameMode(data.gameMode ||")) {
  app = app.replace(
    `setPlayers(data.players || []);`,
    `setPlayers(data.players || []);
    setRoomGameMode(data.gameMode || data.roomGameMode || "solo");`
  );
}

/* room-created ve players-updated içinde de gameMode al */
app = app.replace(
  /setPlayers\(data\.players\);\s*setMyPlayerId\(data\.myPlayerId\);/g,
  `setPlayers(data.players);
      setRoomGameMode(data.gameMode || data.roomGameMode || "solo");
      setMyPlayerId(data.myPlayerId);`
);

app = app.replace(
  /setPlayers\(data\.players\);\s*setInRoom\(true\);/g,
  `setPlayers(data.players);
      setRoomGameMode(data.gameMode || data.roomGameMode || "solo");
      setInRoom(true);`
);

/* =========================
   APP: create-room emit içine gameMode ekle
========================= */

app = app.replace(
  `socket.emit("create-room", { name });`,
  `socket.emit("create-room", { name, gameMode });`
);

/* =========================
   APP: CSS ekle
========================= */

if (!app.includes(".mode-select-row")) {
  app = app.replace(
    `.divider {`,
    `.mode-select-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}

.mode-select-btn {
  padding: 13px 10px !important;
  border-radius: 14px !important;
  background: #1e293b !important;
  color: #cbd5e1 !important;
  border: 1px solid #334155 !important;
  box-shadow: none !important;
}

.mode-select-btn.active {
  background: linear-gradient(135deg, #22c55e, #16a34a) !important;
  color: white !important;
  border-color: rgba(34, 197, 94, 0.9) !important;
}

.team-info-pill {
  position: absolute;
  left: 50%;
  bottom: 164px;
  transform: translateX(-50%);
  z-index: 70;
  background: rgba(2, 6, 23, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #e2e8f0;
  border-radius: 999px;
  padding: 7px 13px;
  font-size: 12px;
  font-weight: 900;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
  white-space: nowrap;
}

.team-info-pill strong {
  color: #22c55e;
}

.divider {`
  );
}

/* =========================
   APP: oda kurma ekranına Tekli/Eşli seçimi ekle
========================= */

if (!app.includes("mode-select-row")) {
  app = app.replace(
    `<button onClick={createRoom}>Masa Kur</button>`,
    `<div className="mode-select-row">
              <button
                type="button"
                className={\`mode-select-btn \${gameMode === "solo" ? "active" : ""}\`}
                onClick={() => setGameMode("solo")}
              >
                Tekli
              </button>

              <button
                type="button"
                className={\`mode-select-btn \${gameMode === "team" ? "active" : ""}\`}
                onClick={() => setGameMode("team")}
              >
                Eşli
              </button>
            </div>

            <button onClick={createRoom}>Masa Kur</button>`
  );
}

/* =========================
   APP: takım helper fonksiyonları ekle
========================= */

if (!app.includes("function getTeamInfoForPlayer")) {
  app = app.replace(
    `function renderScoreRows(scoreSource = totalScores) {`,
    `function getTeamInfoForPlayer(playerId) {
    if (roomGameMode !== "team") return null;

    const index = players.findIndex((player) => player.id === playerId);

    if (index === -1 || players.length < 4) return null;

    const teamA = [players[0], players[2]].filter(Boolean);
    const teamB = [players[1], players[3]].filter(Boolean);

    const myTeam = index === 0 || index === 2 ? teamA : teamB;
    const teamName = index === 0 || index === 2 ? "Takım A" : "Takım B";
    const partner = myTeam.find((player) => player.id !== playerId);

    return {
      teamName,
      partner,
      players: myTeam,
    };
  }

  function renderScoreRows(scoreSource = totalScores) {`
  );
}

/* =========================
   APP: JSX içine eş bilgisini ekle
========================= */

if (!app.includes("team-info-pill")) {
  app = app.replace(
    `<div className="rack">`,
    `{roomGameMode === "team" && getTeamInfoForPlayer(myPlayerId) && (
                  <div className="team-info-pill">
                    {getTeamInfoForPlayer(myPlayerId).teamName} / Eşin:{" "}
                    <strong>{getTeamInfoForPlayer(myPlayerId).partner?.name || "Bekleniyor"}</strong>
                  </div>
                )}

                <div className="rack">`
  );
}

/* =========================
   APP: bekleme odasında oyun tipini göster
========================= */

if (!app.includes("Oyun Tipi")) {
  app = app.replace(
    `<p className="status">{players.length}/4 kişi odada.</p>`,
    `<p className="status">
              Oyun Tipi: <strong>{roomGameMode === "team" ? "Eşli" : "Tekli"}</strong>
            </p>

            <p className="status">{players.length}/4 kişi odada.</p>`
  );
}

/* =========================
   SERVER: create-room içinde gameMode kaydet
========================= */

/* create-room parametresine gameMode ekle */
server = server.replace(
  /socket\.on\(["']create-room["'],\s*\(\s*\{\s*name\s*\}\s*\)\s*=>/g,
  `socket.on("create-room", ({ name, gameMode }) =>`
);

/* Eğer create-room zaten farklı formatta ise, destructuring içine gameMode eklemeye çalış */
server = server.replace(
  /socket\.on\(["']create-room["'],\s*\(\s*data\s*\)\s*=>/g,
  `socket.on("create-room", (data) =>`
);

/* room oluşturulan yere gameMode ekle - yaygın room objesi kalıpları */
if (!server.includes("gameMode: gameMode ===")) {
  server = server.replace(
    /players:\s*\[\s*\{\s*id:\s*socket\.id,\s*name\s*\}\s*\]/,
    `gameMode: gameMode === "team" ? "team" : "solo",
    players: [{ id: socket.id, name }]`
  );

  server = server.replace(
    /players:\s*\[\s*\{\s*id:\s*socket\.id,\s*name:\s*name\s*\}\s*\]/,
    `gameMode: gameMode === "team" ? "team" : "solo",
    players: [{ id: socket.id, name: name }]`
  );
}

/* Eğer data formatı kullanılıyorsa güvenli fallback */
if (!server.includes("const selectedGameMode")) {
  server = server.replace(
    /const roomCode\s*=/,
    `const selectedGameMode = (typeof gameMode !== "undefined" ? gameMode : data?.gameMode) === "team" ? "team" : "solo";
  const roomCode =`
  );

  server = server.replace(
    /gameMode:\s*gameMode === "team" \? "team" : "solo"/g,
    `gameMode: selectedGameMode`
  );
}

/* room-created / players-updated / game update payloadlarına gameMode ekle */
server = server.replace(
  /roomCode,\s*players:\s*room\.players/g,
  `roomCode,
      gameMode: room.gameMode || "solo",
      players: room.players`
);

server = server.replace(
  /roomCode:\s*room\.roomCode,\s*players:\s*room\.players/g,
  `roomCode: room.roomCode,
      gameMode: room.gameMode || "solo",
      players: room.players`
);

/* game data gönderen fonksiyonda gameMode yoksa ekle */
server = server.replace(
  /myPlayerId:\s*playerId,/g,
  `myPlayerId: playerId,
    gameMode: room.gameMode || "solo",`
);

/* =========================
   SERVER: oyun başlayınca takım bilgisini room'a yaz
========================= */

if (!server.includes("function assignTeamsIfNeeded")) {
  server += `

function assignTeamsIfNeeded(room) {
  if (!room) return;

  if (room.gameMode !== "team") {
    room.teams = null;
    return;
  }

  if (!Array.isArray(room.players) || room.players.length < 4) return;

  room.teams = {
    A: [room.players[0].id, room.players[2].id],
    B: [room.players[1].id, room.players[3].id],
  };
}
`;
}

/* start-game içinde assignTeamsIfNeeded çağır */
if (!server.includes("assignTeamsIfNeeded(room);")) {
  server = server.replace(
    /socket\.on\(["']start-game["'][\s\S]*?\{\s*const room/,
    (match) => match
  );

  server = server.replace(
    /startGameForRoom\(room\);/g,
    `assignTeamsIfNeeded(room);
    startGameForRoom(room);`
  );

  server = server.replace(
    /startGame\(room\);/g,
    `assignTeamsIfNeeded(room);
    startGame(room);`
  );
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(serverPath, server);

console.log("Eşli/Tekli oda seçimi eklendi.");
console.log("Eşli modda Oyuncu 1 + Oyuncu 3 ve Oyuncu 2 + Oyuncu 4 takım olacak.");
console.log("Şimdilik skor hesabına dokunulmadı.");