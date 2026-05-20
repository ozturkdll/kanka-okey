const fs = require("fs");

const serverPath = "server/index.js";
const appPath = "src/App.jsx";

let server = fs.readFileSync(serverPath, "utf8");
let app = fs.readFileSync(appPath, "utf8");

/* 1) Açma kuralları:
   - Seri açan, başka biri çift açmadan çift açamaz.
   - Çift açan, sonradan seri açamaz.
*/

if (!server.includes("Birisi çift açmadan çift açamazsın")) {
  server = server.replace(
    `  const alreadyOpened = Boolean(room.game.playerOpenTypes[socket.id]);

  if (!alreadyOpened) {`,
    `  const alreadyOpened = Boolean(room.game.playerOpenTypes[socket.id]);

  if (alreadyOpened) {
    const myOpenType = room.game.playerOpenTypes[socket.id];

    if (myOpenType === "pairs" && mode === "series") {
      socket.emit("error-message", "Çift açtıysan sonradan seri açamazsın. Sadece yerdeki serilere taş işleyebilirsin.");
      return;
    }

    if (myOpenType === "series" && mode === "pairs") {
      const someoneOpenedPairs = Object.entries(room.game.playerOpenTypes).some(
        ([playerId, openType]) => playerId !== socket.id && openType === "pairs"
      );

      if (!someoneOpenedPairs) {
        socket.emit("error-message", "Birisi çift açmadan çift açamazsın.");
        return;
      }
    }
  }

  if (!alreadyOpened) {`
  );
}

/* 2) İşlek taş cezası:
   - Yerdeki herhangi bir pere işlenebilecek taş atılırsa +101 ceza.
   - Oyuncuya anlık uyarı gider.
*/

const newDiscardFunction = `function discardTileForPlayer(room, playerId, tileId) {
  const hand = room.game.hands[playerId];

  if (!hand || !hand.length) return null;

  let tileIndex = -1;

  if (tileId !== undefined && tileId !== null) {
    tileIndex = hand.findIndex((tile) => Number(tile.id) === Number(tileId));
  }

  if (tileIndex === -1) {
    const lastDrawnTileId = room.game.lastDrawnTileByPlayerId[playerId];

    if (lastDrawnTileId) {
      tileIndex = hand.findIndex((tile) => Number(tile.id) === Number(lastDrawnTileId));
    }
  }

  if (tileIndex === -1) {
    tileIndex = hand.length - 1;
  }

  if (tileIndex === -1) return null;

  const tile = hand[tileIndex];

  const playerAlreadyOpened = Boolean(room.game.playerOpenTypes[playerId]);
  const usefulTile = playerAlreadyOpened && isTileUsefulForAnyOpenGroup(room, tile);

  if (usefulTile) {
    room.totalScores[playerId] = (room.totalScores[playerId] || 0) + 101;

    const penalty = {
      playerId,
      amount: 101,
      reason: "İşlek taş attı.",
      tile,
      createdAt: Date.now(),
    };

    room.game.penaltyMessages.push(penalty);

    io.to(playerId).emit("penalty-message", {
      message: "İşlek taş attın. +101 ceza yedin.",
      amount: 101,
      reason: "İşlek taş attı.",
      tile,
    });
  }

  const [discardedTile] = hand.splice(tileIndex, 1);

  room.game.discardPiles[playerId] = discardedTile;
  room.game.lastDrawnTileByPlayerId[playerId] = null;
  room.game.drawSourceByPlayerId[playerId] = null;

  return discardedTile;
}`;

server = server.replace(
  /function discardTileForPlayer\(room, playerId, tileId\) \{[\s\S]*?\n\}\n\nfunction passTurn/,
  `${newDiscardFunction}\n\nfunction passTurn`
);

/* 3) App tarafı ceza uyarısını dinlesin.
   error-message kullanmıyoruz çünkü error-message taş atmayı geri alıyor.
*/

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
}

fs.writeFileSync(serverPath, server);
fs.writeFileSync(appPath, app);

console.log("Okey kuralları güncellendi:");
console.log("- Seri açan, başka biri çift açmadan çift açamaz.");
console.log("- Çift açan sonradan seri açamaz.");
console.log("- İşlek taş atana +101 ceza ve anlık uyarı eklendi.");