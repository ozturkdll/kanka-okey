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

  useEffect(() => {
    socket.on("room-created", (data) => {
      setRoomCode(data.roomCode);
      setPlayers(data.players);
      setInRoom(true);
    });

    socket.on("players-updated", (data) => {
      setRoomCode(data.roomCode);
      setPlayers(data.players);
      setInRoom(true);
    });

    socket.on("error-message", (message) => {
      alert(message);
    });

    return () => {
      socket.off("room-created");
      socket.off("players-updated");
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

  function copyRoomCode() {
    navigator.clipboard.writeText(roomCode);
    alert("Oda kodu kopyalandı.");
  }

  return (
    <div className="page">
      {!inRoom ? (
        <div className="card">
          <h1>Kanka Okey</h1>
          <p>Arkadaşlarınla çipsiz 101 Okey oyna.</p>

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
      ) : (
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
            <button className="start">Oyunu Başlat</button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;