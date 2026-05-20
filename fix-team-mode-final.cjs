const fs = require("fs");

const serverPath = "server/index.js";
let server = fs.readFileSync(serverPath, "utf8");

/* Bozuk selectedGameMode satırını düzelt */
server = server.replace(
  /const selectedGameMode = .*?;\s*/,
  'const selectedGameMode = gameMode === "team" ? "team" : "solo";\n    '
);

/* Oda objesinde gameMode yoksa players satırının üstüne ekle */
if (!server.includes("gameMode: selectedGameMode")) {
  server = server.replace(
    /(\s+)players:\s*\[/,
    "$1gameMode: selectedGameMode,\n$1players: ["
  );
}

/* room-created içinde gameMode yoksa ekle */
server = server.replace(
  /socket\.emit\("room-created",\s*\{\s*roomCode,/,
  'socket.emit("room-created", {\n      roomCode,\n      gameMode: room.gameMode || "solo",'
);

/* players-updated içinde gameMode yoksa ekle */
server = server.replace(
  /io\.to\(code\)\.emit\("players-updated",\s*\{\s*roomCode:\s*code,/,
  'io.to(code).emit("players-updated", {\n      roomCode: code,\n      gameMode: room.gameMode || "solo",'
);

server = server.replace(
  /io\.to\(roomCode\)\.emit\("players-updated",\s*\{\s*roomCode,/,
  'io.to(roomCode).emit("players-updated", {\n        roomCode,\n        gameMode: room.gameMode || "solo",'
);

/* game data içinde gameMode yoksa ekle */
if (!server.includes("gameMode: room.gameMode || \"solo\"")) {
  server = server.replace(
    /myPlayerId:\s*playerId,/,
    'myPlayerId: playerId,\n    gameMode: room.gameMode || "solo",'
  );
}

fs.writeFileSync(serverPath, server);

console.log("Eşli oyun modu server tarafında düzeltildi.");
console.log("Eşli seçilirse room.gameMode artık team olacak.");