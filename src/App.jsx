import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("https://kanka-okey-server.onrender.com", {
  transports: ["websocket", "polling"],
});

const TILE_WIDTH = 42;
const TILE_HEIGHT = 54;
const SLOT_WIDTH = 52;
const ROW_1_Y = 10;
const ROW_2_Y = 72;

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

  const [tilePositions, setTilePositions] = useState({});
  const [draggingTile, setDraggingTile] = useState(null);
  const [isOverMyDiscard, setIsOverMyDiscard] = useState(false);

  const rackBoardRef = useRef(null);
  const pendingDiscardRef = useRef(null);

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
      setDeckCount(data.deckCount);
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
      setDiscardedTile(data.discardedTile);
      setTilePositions(createInitialTilePositions(data.myHand));
      setDraggingTile(null);
      setIsOverMyDiscard(false);
      pendingDiscardRef.current = null;
    });

    socket.on("game-updated", (data) => {
      setRoomCode(data.roomCode);
      setPlayers(data.players);
      setMyPlayerId(data.myPlayerId);
      setMyHand(data.myHand);
      setDeckCount(data.deckCount);
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
      setDiscardedTile(data.discardedTile);
      setTilePositions((prev) => reconcileTilePositions(data.myHand, prev));
      setDraggingTile(null);
      setIsOverMyDiscard(false);
      pendingDiscardRef.current = null;
    });

    socket.on("error-message", (message) => {
      alert(message);

      const pending = pendingDiscardRef.current;

      if (pending) {
        setMyHand((prev) => {
          const exists = prev.some((tile) => tile.id === pending.tile.id);
          if (exists) return prev;
          return [...prev, pending.tile];
        });

        setTilePositions((prev) => ({
          ...prev,
          [pending.tile.id]: pending.position,
        }));

        setDiscardedTile(pending.previousDiscardedTile);
        pendingDiscardRef.current = null;
      }
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

  function createInitialTilePositions(hand) {
    const positions = {};

    hand.forEach((tile, index) => {
      const row = index < 11 ? 0 : 1;
      const col = row === 0 ? index : index - 11;

      positions[tile.id] = {
        x: 12 + col * SLOT_WIDTH,
        y: row === 0 ? ROW_1_Y : ROW_2_Y,
      };
    });

    return positions;
  }

  function reconcileTilePositions(hand, oldPositions) {
    const next = {};
    const usedSlots = {
      0: new Set(),
      1: new Set(),
    };

    hand.forEach((tile, index) => {
      const old = oldPositions[tile.id];

      if (old) {
        const row = closestRackRow(old.y);
        let slot = positionToSlot(old.x);

        while (usedSlots[row].has(slot)) {
          slot++;
        }

        usedSlots[row].add(slot);

        next[tile.id] = {
          x: slotToPosition(slot),
          y: row === 0 ? ROW_1_Y : ROW_2_Y,
        };
      } else {
        const row = index < 11 ? 0 : 1;
        let slot = row === 0 ? index : index - 11;

        while (usedSlots[row].has(slot)) {
          slot++;
        }

        usedSlots[row].add(slot);

        next[tile.id] = {
          x: slotToPosition(slot),
          y: row === 0 ? ROW_1_Y : ROW_2_Y,
        };
      }
    });

    return next;
  }

  function createRoom() {
    if (!name.trim()) {
      alert("Önce ismini yaz.");
      return;
    }

    socket.emit("create-room", { name });
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
    socket.emit("start-game", { roomCode });
  }

  function copyRoomCode() {
    navigator.clipboard.writeText(roomCode);
    alert("Oda kodu kopyalandı.");
  }

  function getTileClass(tile) {
    if (!tile) return "tile";
    if (tile.fake) return "tile fake";
    return `tile ${tile.color}`;
  }

  function getTileText(tile) {
    if (!tile) return "";
    if (tile.fake) return "S";
    return tile.number;
  }

  function getRackWidth() {
    return rackBoardRef.current?.clientWidth || 700;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function closestRackRow(y) {
    return Math.abs(y - ROW_1_Y) < Math.abs(y - ROW_2_Y) ? 0 : 1;
  }

  function positionToSlot(x) {
    return Math.max(0, Math.round((x - 12) / SLOT_WIDTH));
  }

  function slotToPosition(slot) {
    return 12 + slot * SLOT_WIDTH;
  }

  function getMaxSlot() {
    const boardWidth = getRackWidth();
    return Math.max(0, Math.floor((boardWidth - TILE_WIDTH - 12) / SLOT_WIDTH));
  }

  function snapTileToRack(tileId) {
    const boardWidth = getRackWidth();

    setTilePositions((prev) => {
      const current = prev[tileId] || { x: 12, y: ROW_1_Y };

      const targetRow = closestRackRow(current.y);
      const maxSlot = getMaxSlot();
      const targetSlot = clamp(positionToSlot(current.x), 0, maxSlot);

      return resolveRackCollision(prev, tileId, targetRow, targetSlot);
    });
  }

  function resolveRackCollision(prevPositions, movingTileId, targetRow, targetSlot) {
    const maxSlot = getMaxSlot();

    const result = { ...prevPositions };
    const occupied = {
      0: {},
      1: {},
    };

    Object.entries(prevPositions).forEach(([id, pos]) => {
      const numericId = Number(id);
      if (numericId === movingTileId) return;

      const row = closestRackRow(pos.y);
      const slot = clamp(positionToSlot(pos.x), 0, maxSlot);

      occupied[row][slot] = numericId;
    });

    function pushRight(row, slot) {
      if (slot > maxSlot) return false;

      const occupyingTileId = occupied[row][slot];

      if (!occupyingTileId) {
        return true;
      }

      const canPush = pushRight(row, slot + 1);

      if (!canPush) {
        return false;
      }

      occupied[row][slot + 1] = occupyingTileId;
      delete occupied[row][slot];

      result[occupyingTileId] = {
        x: slotToPosition(slot + 1),
        y: row === 0 ? ROW_1_Y : ROW_2_Y,
      };

      return true;
    }

    function pushLeft(row, slot) {
      if (slot < 0) return false;

      const occupyingTileId = occupied[row][slot];

      if (!occupyingTileId) {
        return true;
      }

      const canPush = pushLeft(row, slot - 1);

      if (!canPush) {
        return false;
      }

      occupied[row][slot - 1] = occupyingTileId;
      delete occupied[row][slot];

      result[occupyingTileId] = {
        x: slotToPosition(slot - 1),
        y: row === 0 ? ROW_1_Y : ROW_2_Y,
      };

      return true;
    }

    let finalSlot = targetSlot;

    if (occupied[targetRow][targetSlot]) {
      const pushedRight = pushRight(targetRow, targetSlot);

      if (!pushedRight) {
        const pushedLeft = pushLeft(targetRow, targetSlot);

        if (!pushedLeft) {
          finalSlot = findNearestEmptySlot(occupied[targetRow], targetSlot, maxSlot);
        }
      }
    }

    result[movingTileId] = {
      x: slotToPosition(finalSlot),
      y: targetRow === 0 ? ROW_1_Y : ROW_2_Y,
    };

    return result;
  }

  function findNearestEmptySlot(rowOccupied, targetSlot, maxSlot) {
    for (let distance = 0; distance <= maxSlot; distance++) {
      const left = targetSlot - distance;
      const right = targetSlot + distance;

      if (left >= 0 && !rowOccupied[left]) return left;
      if (right <= maxSlot && !rowOccupied[right]) return right;
    }

    return clamp(targetSlot, 0, maxSlot);
  }

  function isPointerOverMyDiscardZone(e, draggedElement) {
    draggedElement.style.pointerEvents = "none";
    const elementUnderPointer = document.elementFromPoint(e.clientX, e.clientY);
    draggedElement.style.pointerEvents = "";

    return Boolean(elementUnderPointer?.closest(".my-table-discard-zone"));
  }

  function handleTilePointerDown(e, tile) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const currentPosition = tilePositions[tile.id] || { x: 12, y: ROW_1_Y };

    setDraggingTile({
      id: tile.id,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startTileX: currentPosition.x,
      startTileY: currentPosition.y,
    });
  }

  function handleTilePointerMove(e, tile) {
    if (!draggingTile || draggingTile.id !== tile.id) return;

    const nextX =
      draggingTile.startTileX + (e.clientX - draggingTile.startPointerX);
    const nextY =
      draggingTile.startTileY + (e.clientY - draggingTile.startPointerY);

    setTilePositions((prev) => ({
      ...prev,
      [tile.id]: {
        x: nextX,
        y: nextY,
      },
    }));

    const overDiscard = isPointerOverMyDiscardZone(e, e.currentTarget);
    setIsOverMyDiscard(overDiscard);
  }

  function handleTilePointerUp(e, tile) {
    if (!draggingTile || draggingTile.id !== tile.id) return;

    const overDiscard = isPointerOverMyDiscardZone(e, e.currentTarget);

    if (overDiscard) {
      if (currentTurnPlayerId !== myPlayerId) {
        alert("Sıra sende değil.");
        snapTileToRack(tile.id);
        setDraggingTile(null);
        setIsOverMyDiscard(false);
        return;
      }

      const previousPosition = tilePositions[tile.id] || { x: 12, y: ROW_1_Y };
      const previousDiscardedTile = discardedTile;

      pendingDiscardRef.current = {
        tile,
        position: previousPosition,
        previousDiscardedTile,
      };

      setDiscardedTile(tile);
      setMyHand((prev) => prev.filter((handTile) => handTile.id !== tile.id));
      setTilePositions((prev) => {
        const next = { ...prev };
        delete next[tile.id];
        return next;
      });

      socket.emit("discard-tile", {
        roomCode,
        tileId: tile.id,
      });

      setDraggingTile(null);
      setIsOverMyDiscard(false);
      return;
    }

    snapTileToRack(tile.id);
    setDraggingTile(null);
    setIsOverMyDiscard(false);
  }

  function handleTilePointerCancel(tile) {
    if (tile) {
      snapTileToRack(tile.id);
    }

    setDraggingTile(null);
    setIsOverMyDiscard(false);
  }

  function renderFreeTile(tile) {
    const position = tilePositions[tile.id] || { x: 12, y: ROW_1_Y };

    return (
      <div
        key={tile.id}
        className={`${getTileClass(tile)} ${
          draggingTile?.id === tile.id ? "dragging-tile" : ""
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        onPointerDown={(e) => handleTilePointerDown(e, tile)}
        onPointerMove={(e) => handleTilePointerMove(e, tile)}
        onPointerUp={(e) => handleTilePointerUp(e, tile)}
        onPointerCancel={() => handleTilePointerCancel(tile)}
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
                    <span>Rakip</span>
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
                    <span>Rakip</span>
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
                    <span>Rakip</span>
                  </div>
                </div>
              )}

              <div className="table-discard-zone top-left-discard-zone">
                <span>Atılan</span>
                <div className="empty-discard-slot"></div>
              </div>

              <div className="table-discard-zone top-right-discard-zone">
                <span>Atılan</span>
                <div className="empty-discard-slot"></div>
              </div>

              <div className="table-discard-zone bottom-left-discard-zone">
                <span>Atılan</span>
                <div className="empty-discard-slot"></div>
              </div>

              <div
                className={`table-discard-zone my-table-discard-zone bottom-right-discard-zone ${
                  isOverMyDiscard ? "discard-zone-hover" : ""
                }`}
              >
                <span>TAŞ AT</span>
                {discardedTile ? (
                  <div className={getTileClass(discardedTile)}>
                    {getTileText(discardedTile)}
                  </div>
                ) : (
                  <div className="empty-discard-slot"></div>
                )}
              </div>

              <div className="center-tools clean-center">
                <div className="indicator-tile">
                  <span>Gösterge</span>
                  <div className="tile yellow center-static-tile">2</div>
                </div>

                <div className="deck-back-box">
                  <span>Kalan</span>
                  <div className="deck-back-tile">{deckCount}</div>
                </div>
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
                <div className="rack-wood-top"></div>

                <div className="rack-main">
                  <div className="free-rack-board" ref={rackBoardRef}>
                    <div className="rack-lane lane-top"></div>
                    <div className="rack-lane lane-bottom"></div>
                    {myHand.map((tile) => renderFreeTile(tile))}
                  </div>
                </div>

                <div className="rack-wood-bottom"></div>
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