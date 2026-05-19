import { useState } from "react";
import "./App.css";

function App() {
  const [roomCode, setRoomCode] = useState("");

  function createRoom() {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    setRoomCode(code);
  }

  return (
    <div className="page">
      <h1>Kanka Okey</h1>
      <p>Arkadaşlarınla çipsiz 101 Okey oyna.</p>

      <button onClick={createRoom}>Oda Oluştur</button>

      {roomCode && (
        <div className="room-box">
          <h2>Oda Kodun:</h2>
          <strong>{roomCode}</strong>
          <p>Bu kodu arkadaşlarına gönder.</p>
        </div>
      )}
    </div>
  );
}

export default App;