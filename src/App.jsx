import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./App.css";

const socket = io("https://kanka-okey-server.onrender.com", {
  transports: ["websocket", "polling"],
});

function SortableTile({
  tile,
  selectedTileId,
  onSelect,
  getTileClass,
  getTileText,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: tile.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 9999 : "auto",
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${getTileClass(tile)} ${
        selectedTileId === tile.id ? "selected-tile" : ""
      } ${isDragging ? "dragging-tile" : ""}`}
      onClick={() => onSelect(tile)}
      {...attributes}
      {...listeners}
    >
      {getTileText(tile)}
    </div>
  );
}

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
  const [selectedTileId, setSelectedTileId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 120,
        tolerance: 8,
      },
    })
  );

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
      setSelectedTileId(null);
    });

    socket.on("game-updated", (data) => {
      setRoomCode(data.roomCode);
      setPlayers(data.players);
      setMyPlayerId(data.myPlayerId);
      setMyHand(data.myHand);
      setDeckCount(data.deckCount);
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
      setDiscardedTile(data.discardedTile);
      setSelectedTileId(null);
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

  function selectTile(tile) {
    setSelectedTileId((prev) => (prev === tile.id ? null : tile.id));
  }

  function discardSelectedTile() {
    if (!selectedTileId) {
      alert("Önce atacağın taşı seç.");
      return;
    }

    socket.emit("discard-tile", {
      roomCode,
      tileId: selectedTileId,
    });
  }

  function handleDragEnd(event) {
    const { active, over } = event;

    if (!over) return;

    if (active.id !== over.id) {
      setMyHand((items) => {
        const oldIndex = items.findIndex((tile) => tile.id === active.id);
        const newIndex = items.findIndex((tile) => tile.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return items;

        const newHand = arrayMove(items, oldIndex, newIndex);

        socket.emit("reorder-hand", {
          roomCode,
          orderedTileIds: newHand.map((tile) => tile.id),
        });

        return newHand;
      });
    }
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

  function renderTile(tile) {
    return (
      <SortableTile
        key={tile.id}
        tile={tile}
        selectedTileId={selectedTileId}
        onSelect={selectTile}
        getTileClass={getTileClass}
        getTileText={getTileText}
      />
    );
  }

  function renderDiscardBox(label, active = false, clickable = false) {
    return (
      <div
        className={`discard-box-small ${active ? "active-discard-box" : ""} ${
          clickable ? "clickable-discard" : ""
        }`}
        onClick={clickable ? discardSelectedTile : undefined}
      >
        <span>{label}</span>

        {active && discardedTile ? (
          <div className={getTileClass(discardedTile)}>
            {getTileText(discardedTile)}
          </div>
        ) : (
          <div className="empty-discard-slot">+</div>
        )}
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

              <div className="opponent-discard top-discard">
                {renderDiscardBox("Atılan", false)}
              </div>

              <div className="opponent-discard left-discard">
                {renderDiscardBox("Atılan", false)}
              </div>

              <div className="opponent-discard right-discard">
                {renderDiscardBox("Atılan", false)}
              </div>

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

              <div className="center-tools clean-center">
                <div className="indicator-tile">
                  <span>Gösterge</span>
                  <div className="tile yellow">2</div>
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
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={myHand.map((tile) => tile.id)}
                      strategy={rectSortingStrategy}
                    >
                      <div className="rack-rows">
                        <div className="rack-row">
                          {myHand.slice(0, 11).map((tile) => renderTile(tile))}
                        </div>

                        <div className="rack-row">
                          {myHand.slice(11).map((tile) => renderTile(tile))}
                        </div>
                      </div>
                    </SortableContext>
                  </DndContext>

                  <div className="my-discard-zone">
                    {renderDiscardBox("TAŞ AT", Boolean(discardedTile), true)}
                  </div>
                </div>

                <div className="rack-wood-bottom"></div>
              </div>
            </div>
          </div>

          <div className="bottom-actions">
            <button>Taş Çek</button>
            <button className="secondary" onClick={discardSelectedTile}>
              Taş At
            </button>
            <button className="start">101 Aç</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;