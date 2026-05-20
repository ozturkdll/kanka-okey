import { useState } from "react";
import "./App.css";

function App() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [inRoom, setInRoom] = useState(false);

  function createRoom() {
    if (!name.trim()) {
      alert("Önce ismini yaz.");
      return;
    }

    const code = Math.random().toString(36).substring(2, 6).toUpperCase();

    setRoomCode(code);
    setPlayers([name]);
    setInRoom(true);
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

    setRoomCode(joinCode.toUpperCase());
    setPlayers([name]);
    setInRoom(true);
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
              <li key={index}>
                {index + 1}. {player}
              </li>
            ))}
          </ul>

          <p className="small">4 kişi girince oyun başlayacak.</p>

          <button className="start">Oyunu Başlat</button>
        </div>
      )}
    </div>
  );
}

export default App;