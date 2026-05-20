const fs = require("fs");

const serverPath = "server/index.js";
let server = fs.readFileSync(serverPath, "utf8");

/*
  Amaç:
  create-room eventinde gelen gameMode bilgisini oda içine kaydetmek.
  room-created, players-updated ve game-updated payloadlarına gameMode göndermek.
*/

// 1) create-room parametresinde gameMode yoksa ekle
server = server.replace(
  /socket\.on\(["']create-room["'],\s*\(\s*\{\s*name\s*\}\s*\)\s*=>/g,
  `socket.on("create-room", ({ name, gameMode }) =>`
);

// 2) Eğer room objesinde gameMode yoksa players satırından önce ekle
if (!server.includes("gameMode: gameMode ===")) {
  server = server.replace(
    /players:\s*\[\s*\{\s*id:\s*socket\.id,\s*name\s*\}\s*\]/g,
    `gameMode: gameMode === "team" ? "team" : "solo",
    players: [{ id: socket.id, name }]`
  );

  server = server.replace(
    /players:\s*\[\s*\{\s*id:\s*socket\.id,\s*name:\s*name\s*\}\s*\]/g,
    `gameMode: gameMode === "team" ? "team" : "solo",
    players: [{ id: socket.id, name: name }]`
  );
}

// 3) room-created payloadına gameMode ekle
server = server.replace(
  /socket\.emit\(["']room-created["'],\s*\{\s*roomCode,\s*players:\s*room\.players,\s*myPlayerId:\s*socket\.id\s*\}\s*\)/g,
  `socket.emit("room-created", {
    roomCode,
    gameMode: room.gameMode || "solo",
    players: room.players,
    myPlayerId: socket.id
  })`
);

// 4) players-updated payloadlarına gameMode ekle
server = server.replace(
  /io\.to\(roomCode\)\.emit\(["']players-updated["'],\s*\{\s*roomCode,\s*players:\s*room\.players\s*\}\s*\)/g,
  `io.to(roomCode).emit("players-updated", {
    roomCode,
    gameMode: room.gameMode || "solo",
    players: room.players
  })`
);

// 5) game data içinde gameMode yoksa myPlayerId satırından sonra ekle
if (!server.includes("gameMode: room.gameMode ||")) {
  server = server.replace(
    /myPlayerId:\s*playerId,/g,
    `myPlayerId: playerId,
    gameMode: room.gameMode || "solo",`
  );
}

// 6) Debug için oda kurulurken konsola yaz
if (!server.includes("ODA MODU DEBUG")) {
  server = server.replace(
    /const roomCode\s*=\s*generateRoomCode\(\);/,
    `const roomCode = generateRoomCode();
  console.log("ODA MODU DEBUG:", gameMode);`
  );
}

fs.writeFileSync(serverPath, server);

console.log("Server tarafında gameMode kaydı düzeltildi.");
console.log("Eşli seçilirse oda gameMode: team olarak açılacak.");