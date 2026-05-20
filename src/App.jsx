import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("https://kanka-okey-server.onrender.com", {
  transports: ["websocket", "polling"],
});

function App() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [inRoom, setInRoom] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Bağlanıyor...");

  const [gameStarted, setGameStarted] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState("");
  const [myHand, setMyHand] = useState([]);
  const [deckCount, setDeckCount] = useState(0);
  const [currentTurnPlayerId, setCurrentTurnPlayerId] = useState("");
  const [discardedTile, setDiscardedTile] = useState(null);

  const [dragStart, setDragStart] = useState(null);
  const [draggingTileId, setDraggingTileId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isOverDiscardZone, setIsOverDiscardZone] = useState(false);
  const [heldOkeyTileId, setHeldOkeyTileId] = useState(null);

  const myHandRef = useRef([]);

  useEffect(() => {
    myHandRef.current = myHand;
  }, [myHand]);

  useEffect(() => {
    socket.on("connect", () => {
      setConnectionStatus("Server bağlı");
    });

    socket.on("connect_error", () => {
      setConnectionStatus("Server bağlantı hatası");
    });

    socket.on("room-created", (data) => {
      setRoomCode(data.roomCode);
      setPlayers(data.players);
      setMyPlayerId(data.myPlayerId);
      setInRoom(true);
    });

    socket.on("players-updated", (data) => {
      setRoomCode(data.roomCode);
      setPlayers(data.players);
      setInRoom(true);
    });

    socket.on("game-started", (data) => {
      setGameStarted(true);
      setRoomCode(data.roomCode);
      setPlayers(data.players);
      setMyPlayerId(data.myPlayerId);
      setMyHand(data.myHand);
      myHandRef.current = data.myHand;
      setDeckCount(data.deckCount);
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
      setDiscardedTile(data.discardedTile);
    });

    socket.on("game-updated", (data) => {
      setRoomCode(data.roomCode);
      setPlayers(data.players);
      setMyPlayerId(data.myPlayerId);
      setMyHand(data.myHand);
      myHandRef.current = data.myHand;
      setDeckCount(data.deckCount);
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
      setDiscardedTile(data.discardedTile);
    });

    socket.on("error-message", (message) => {
      alert(message);
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("room-created");
      socket.off("players-updated");
      socket.off("game-started");
      socket.off("game-updated");
      socket.off("error-message");
    };
  }, []);

  function createRoom() {
    if (!name.trim()) {
      alert("Önce ismini yaz.");
      return;
    }

    socket.emit("create-room", {
      name,
    });
  }

  function joinRoom() {
    if (!name.trim()) {
      alert("Önce ismini yaz.");
      return;
    }

    if (!joinCode.trim()) {
      alert("Oda kodunu yaz.");
      return;
    }

    socket.emit("join-room", {
      name,
      roomCode: joinCode,
    });
  }

  function startGame() {
    socket.emit("start-game", {
      roomCode,
    });
  }

  function copyRoomCode() {
    navigator.clipboard.writeText(roomCode);
    alert("Oda kodu kopyalandı.");
  }

  function isOkeyTile(tile) {
    if (!tile) return false;

    // Şimdilik gösterge sarı 2 olduğu için okey sarı 3 kabul ediyoruz.
    // Sahte okey de basılı tutunca arkasını döndürsün diye ekledim.
    return tile.fake || (tile.color === "yellow" && tile.number === 3);
  }

  function reorderHand(targetTileId) {
    if (!draggingTileId || draggingTileId === targetTileId) return;

    setMyHand((prevHand) => {
      const fromIndex = prevHand.findIndex((tile) => tile.id === draggingTileId);
      const toIndex = prevHand.findIndex((tile) => tile.id === targetTileId);

      if (fromIndex === -1 || toIndex === -1) return prevHand;

      const newHand = [...prevHand];
      const [movedTile] = newHand.splice(fromIndex, 1);
      newHand.splice(toIndex, 0, movedTile);

      myHandRef.current = newHand;

      return newHand;
    });
  }

  function getElementUnderPointer(e) {
    const draggedElement = e.currentTarget;

    draggedElement.style.pointerEvents = "none";
    const element = document.elementFromPoint(e.clientX, e.clientY);
    draggedElement.style.pointerEvents = "";

    return element;
  }

  function handleTilePointerDown(e, tile) {
    e.currentTarget.setPointerCapture(e.pointerId);

    setDragStart({
      x: e.clientX,
      y: e.clientY,
    });

    setDraggingTileId(tile.id);
    setDragOffset({ x: 0, y: 0 });

    if (isOkeyTile(tile)) {
      setHeldOkeyTileId(tile.id);
    }
  }

  function handleTilePointerMove(e, tile) {
    if (draggingTileId !== tile.id || !dragStart) return;

    setDragOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });

    const element = getElementUnderPointer(e);

    const targetTile = element?.closest("[data-tile-id]");
    const discardZone = element?.closest(".discard-drop-zone");

    setIsOverDiscardZone(Boolean(discardZone));

    if (targetTile) {
      const targetTileId = Number(targetTile.dataset.tileId);
      reorderHand(targetTileId);
    }
  }

  function handleTilePointerUp(e, tile) {
    if (draggingTileId !== tile.id || !dragStart) return;

    const element = getElementUnderPointer(e);
    const discardZone = element?.closest(".discard-drop-zone");

    const orderedTileIds = myHandRef.current.map((handTile) => handTile.id);

    socket.emit("reorder-hand", {
      roomCode,
      orderedTileIds,
    });

    if (discardZone) {
      socket.emit("discard-tile", {
        roomCode,
        tileId: tile.id,
      });
    }

    setDragStart(null);
    setDraggingTileId(null);
    setDragOffset({ x: 0, y: 0 });
    setIsOverDiscardZone(false);
    setHeldOkeyTileId(null);
  }

  function handleTilePointerCancel() {
    setDragStart(null);
    setDraggingTileId(null);
    setDragOffset({ x: 0, y: 0 });
    setIsOverDiscardZone(false);
    setHeldOkeyTileId(null);
  }

  function getTileClass(tile) {
    if (!tile) return "tile";

    if (heldOkeyTileId === tile.id && isOkeyTile(tile)) {
      return "tile back okey-back";
    }

    if (tile.fake) return "tile fake";
    return `tile ${tile.color}`;
  }

  function getTileText(tile) {
    if (!tile) return "";

    if (heldOkeyTileId === tile.id && isOkeyTile(tile)) {
      return "?";
    }

    if (tile.fake) return "S";
    return tile.number;
  }

  function renderTile(tile) {
    return (
      <div
        className={`${getTileClass(tile)} ${
          draggingTileId === tile.id ? "dragging" : ""
        }`}
        key={tile.id}
        data-tile-id={tile.id}
        style={{
          transform:
            draggingTileId === tile.id
              ? `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.08)`
              : "none",
        }}
        onPointerDown={(e) => handleTilePointerDown(e, tile)}
        onPointerMove={(e) => handleTilePointerMove(e, tile)}
        onPointerUp={(e) => handleTilePointerUp(e, tile)}
        onPointerCancel={handleTilePointerCancel}
      >
        {getTileText(tile)}
      </div>
    );
  }

  const opponents = players.filter((player) => player.id !== myPlayerId);
  const currentTurnPlayer = players.find(
    (player) => player.id === currentTurnPlayerId
  );

  const topPlayer = opponents[0];
  const leftPlayer = opponents[1];
  const rightPlayer = opponents[2];
  const me = players.find((player) => player.id === myPlayerId);
  const isMyTurn = currentTurnPlayerId === myPlayerId;

  return (
    <div className="page">
      {!inRoom ? (
        <div className="home-card">
          <div className="logo-row">
            <div className="logo-chip">K</div>
            <div>
              <h1>Kanka Okey</h1>
              <p>Oda kur, link at, çipsiz oyna.</p>
            </div>
          </div>

          <p className="status">{connectionStatus}</p>

          <input
            placeholder="İsmini yaz"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <button onClick={createRoom}>Masa Kur</button>

          <div className="divider">veya</div>

          <input
            placeholder="Oda kodu"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />

          <button className="secondary" onClick={joinRoom}>
            Odaya Katıl
          </button>
        </div>
      ) : !gameStarted ? (
        <div className="home-card">
          <h1>Bekleme Odası</h1>

          <p>Oda kodu:</p>
          <div className="room-code">{roomCode}</div>

          <button onClick={copyRoomCode}>Kodu Kopyala</button>

          <h2>Oyuncular</h2>

          <ul className="player-list">
            {players.map((player, index) => (
              <li key={player.id}>
                <span>{index + 1}</span>
                {player.name}
              </li>
            ))}
          </ul>

          <p className="status">{players.length}/4 kişi odada.</p>

          {players.length === 4 && (
            <button className="start" onClick={startGame}>
              Oyunu Başlat
            </button>
          )}
        </div>
      ) : (
        <div className="okey-screen">
          <div className="top-hud">
            <button className="menu-btn">☰</button>

            <div className="room-pill">
              <span>Oda</span>
              <strong>{roomCode}</strong>
            </div>

            <div className={`turn-pill ${isMyTurn ? "my-turn" : ""}`}>
              Sıra: {currentTurnPlayer ? currentTurnPlayer.name : "Bekleniyor"}
            </div>

            <div className="mode-pill">Katlamasız</div>
          </div>

          <div className="okey-table">
            <div className={`table-felt ${isMyTurn ? "table-my-turn" : ""}`}>
              {topPlayer && (
                <div
                  className={`player-badge top-player ${
                    currentTurnPlayerId === topPlayer.id ? "active-turn" : ""
                  }`}
                >
                  <div className="avatar">{topPlayer.name[0]}</div>
                  <div>
                    <strong>{topPlayer.name}</strong>
                    <span>🟡 284</span>
                  </div>
                </div>
              )}

              {leftPlayer && (
                <div
                  className={`player-badge left-player ${
                    currentTurnPlayerId === leftPlayer.id ? "active-turn" : ""
                  }`}
                >
                  <div className="avatar">{leftPlayer.name[0]}</div>
                  <div>
                    <strong>{leftPlayer.name}</strong>
                    <span>🟡 222</span>
                  </div>
                </div>
              )}

              {rightPlayer && (
                <div
                  className={`player-badge right-player ${
                    currentTurnPlayerId === rightPlayer.id ? "active-turn" : ""
                  }`}
                >
                  <div className="avatar">{rightPlayer.name[0]}</div>
                  <div>
                    <strong>{rightPlayer.name}</strong>
                    <span>🟡 228</span>
                  </div>
                </div>
              )}

              <div className="tile-count left-count">22</div>

              <div className="opened-sets set-left">
                <div className="mini-row">
                  <span className="mini-tile red">10</span>
                  <span className="mini-tile black">11</span>
                  <span className="mini-tile blue">12</span>
                </div>
                <div className="mini-row">
                  <span className="mini-tile blue">3</span>
                  <span className="mini-tile blue">4</span>
                  <span className="mini-tile blue">5</span>
                  <span className="mini-tile blue">6</span>
                </div>
              </div>

              <div className="opened-sets set-right">
                <div className="mini-row">
                  <span className="mini-tile red">2</span>
                  <span className="mini-tile blue">2</span>
                  <span className="mini-tile black">2</span>
                </div>
                <div className="mini-row">
                  <span className="mini-tile red">12</span>
                  <span className="mini-tile yellow">12</span>
                  <span className="mini-tile black">12</span>
                </div>
              </div>

              <div className="center-tools">
                <div className="indicator-tile">
                  <span>Gösterge</span>
                  <div className="tile yellow">2</div>
                </div>

                <div className="deck-stack">
                  <span>Deste</span>
                  <strong>{deckCount}</strong>
                </div>

                <div className="discard-area">
                  <span>Atılan</span>
                  {discardedTile ? (
                    <div className={getTileClass(discardedTile)}>
                      {getTileText(discardedTile)}
                    </div>
                  ) : (
                    <div className="tile back">?</div>
                  )}
                </div>
              </div>

              <div className="quick-actions">
                <button>✅</button>
                <button>🛒</button>
                <button>💬</button>
                <button>😊</button>
              </div>

              <div className="side-actions">
                <button>
                  <strong>1 2 3</strong>
                  Seri Diz
                </button>
                <button>
                  <strong>5 5</strong>
                  Çift Diz
                </button>
              </div>

              <div
                className={`my-player-card ${
                  currentTurnPlayerId === myPlayerId ? "active-turn" : ""
                }`}
              >
                <div className="avatar">{me ? me.name[0] : "S"}</div>
                <div>
                  <strong>{me ? me.name : "Sen"}</strong>
                  <span>{isMyTurn ? "Sıra sende" : "Bekle"}</span>
                </div>
              </div>

              <div className={`rack ${isMyTurn ? "rack-my-turn" : ""}`}>
                <div className="rack-rows">
                  <div className="rack-row">
                    {myHand.slice(0, 11).map((tile) => renderTile(tile))}
                  </div>

                  <div className="rack-row">
                    {myHand.slice(11).map((tile) => renderTile(tile))}
                  </div>
                </div>

                <div
                  className={`discard-drop-zone ${
                    isOverDiscardZone ? "drop-zone-active" : ""
                  }`}
                >
                  <span>TAŞ AT</span>
                  <small>Buraya bırak</small>
                </div>
              </div>
            </div>
          </div>

          <div className="bottom-actions">
            <button>Taş Çek</button>
            <button className="secondary">Taş At</button>
            <button className="start">101 Aç</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;