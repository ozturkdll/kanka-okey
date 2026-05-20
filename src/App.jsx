import { useEffect, useState } from "react";
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

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Socket bağlandı:", socket.id);
      setConnectionStatus("Server bağlı");
    });

    socket.on("connect_error", (err) => {
      console.log("Socket bağlantı hatası:", err.message);
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

  function getTileClass(tile) {
    if (tile.fake) return "tile fake";
    return `tile ${tile.color}`;
  }

  function getTileText(tile) {
    if (tile.fake) return "S";
    return tile.number;
  }

  const currentTurnPlayer = players.find(
    (player) => player.id === currentTurnPlayerId
  );

  return (
    <div className="page">
      {!inRoom ? (
        <div className="card">
          <h1>Kanka Okey</h1>
          <p>Arkadaşlarınla çipsiz 101 Okey oyna.</p>
          <p className="small">{connectionStatus}</p>

          <input
            placeholder="İsmini yaz"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <button onClick={createRoom}>Oda Oluştur</button>

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
        <div className="card">
          <h1>Bekleme Odası</h1>

          <p>Oda kodu:</p>
          <div className="room-code">{roomCode}</div>

          <button onClick={copyRoomCode}>Kodu Kopyala</button>

          <h2>Oyuncular</h2>

          <ul className="player-list">
            {players.map((player, index) => (
              <li key={player.id}>
                {index + 1}. {player.name}
              </li>
            ))}
          </ul>

          <p className="small">{players.length}/4 kişi odada.</p>

          {players.length === 4 && (
            <button className="start" onClick={startGame}>
              Oyunu Başlat
            </button>
          )}
        </div>
      ) : (
        <div className="game-page">
          <div className="game-header">
            <div>
              <h1>101 Okey</h1>
              <p>Oda: {roomCode}</p>
            </div>

            <div className="turn-box">
              Sıra: {currentTurnPlayer ? currentTurnPlayer.name : "Bilinmiyor"}
            </div>
          </div>

          <div className="table-area">
            <div className="opponents">
              {players
                .filter((player) => player.id !== myPlayerId)
                .map((player) => (
                  <div className="opponent-card" key={player.id}>
                    <strong>{player.name}</strong>
                    <span>21 taş</span>
                  </div>
                ))}
            </div>

            <div className="middle-table">
              <div className="deck-box">
                <span>Deste</span>
                <strong>{deckCount}</strong>
              </div>

              <div className="discard-box">
                <span>Atılan Taş</span>
                {discardedTile ? (
                  <div className={getTileClass(discardedTile)}>
                    {getTileText(discardedTile)}
                  </div>
                ) : (
                  <div className="empty-tile">Boş</div>
                )}
              </div>
            </div>

            <div className="my-area">
              <h2>Senin Taşların</h2>

              <div className="my-hand">
                {myHand.map((tile) => (
                  <div className={getTileClass(tile)} key={tile.id}>
                    {getTileText(tile)}
                  </div>
                ))}
              </div>

              <div className="action-buttons">
                <button>Taş Çek</button>
                <button className="secondary">Taş At</button>
                <button className="start">101 Aç</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;