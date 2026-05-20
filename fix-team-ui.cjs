const fs = require("fs");

const appPath = "src/App.jsx";

if (!fs.existsSync(appPath)) {
  console.error("src/App.jsx bulunamadı.");
  process.exit(1);
}

let app = fs.readFileSync(appPath, "utf8");

/* 1) gameMode state yoksa ekle */
if (!app.includes("const [gameMode, setGameMode]")) {
  app = app.replace(
    'const [joinCode, setJoinCode] = useState("");',
    'const [joinCode, setJoinCode] = useState("");\n  const [gameMode, setGameMode] = useState("solo");'
  );
}

/* 2) create-room emit içine gameMode ekle */
app = app.replace(
  'socket.emit("create-room", { name });',
  'socket.emit("create-room", { name, gameMode });'
);

/* 3) CSS yoksa ekle */
if (!app.includes(".mode-select-btn")) {
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

/* 4) Masa Kur butonunun üstüne Tekli/Eşli seçim alanını koy */
if (!app.includes("Tekli") || !app.includes("Eşli")) {
  app = app.replace(
    `<button onClick={createRoom}>Masa Kur</button>`,
    `<div className="mode-select-row">
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

            <button onClick={createRoom}>Masa Kur</button>`
  );
}

fs.writeFileSync(appPath, app);

console.log("Oda kurma ekranına Tekli / Eşli seçimi eklendi.");