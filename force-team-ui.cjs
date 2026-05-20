const fs = require("fs");

const appPath = "src/App.jsx";
let app = fs.readFileSync(appPath, "utf8");

/* gameMode state garanti ekle */
if (!app.includes("const [gameMode, setGameMode]")) {
  app = app.replace(
    'const [joinCode, setJoinCode] = useState("");',
    'const [joinCode, setJoinCode] = useState("");\n  const [gameMode, setGameMode] = useState("solo");'
  );
}

/* createRoom içine gameMode garanti ekle */
app = app.replace(
  'socket.emit("create-room", { name });',
  'socket.emit("create-room", { name, gameMode });'
);

/* CSS garanti ekle */
if (!app.includes(".mode-select-row")) {
  app = app.replace(
    ".divider {",
    `.mode-select-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}

.mode-select-btn {
  padding: 13px 10px !important;
  border-radius: 14px !important;
  background: #1e293b !important;
  color: #cbd5e1 !important;
  border: 1px solid #334155 !important;
  box-shadow: none !important;
}

.mode-select-btn.active {
  background: linear-gradient(135deg, #22c55e, #16a34a) !important;
  color: white !important;
  border-color: rgba(34, 197, 94, 0.9) !important;
}

.divider {`
  );
}

/* Eğer seçim alanı yoksa Masa Kur butonunun üstüne ZORLA ekle */
if (!app.includes('className="mode-select-row"')) {
  const teamButtons = `<div className="mode-select-row">
              <button
                type="button"
                className={"mode-select-btn " + (gameMode === "solo" ? "active" : "")}
                onClick={() => setGameMode("solo")}
              >
                Tekli
              </button>

              <button
                type="button"
                className={"mode-select-btn " + (gameMode === "team" ? "active" : "")}
                onClick={() => setGameMode("team")}
              >
                Eşli
              </button>
            </div>

            `;

  const before = app;

  app = app.replace(
    '<button onClick={createRoom}>Masa Kur</button>',
    teamButtons + '<button onClick={createRoom}>Masa Kur</button>'
  );

  if (app === before) {
    console.log("Masa Kur butonu bulunamadı. App.jsx içinde button text farklı olabilir.");
    console.log("Şunu ara: createRoom");
  } else {
    console.log("Tekli / Eşli seçim alanı eklendi.");
  }
} else {
  console.log("Seçim alanı zaten var görünüyor.");
}

fs.writeFileSync(appPath, app);