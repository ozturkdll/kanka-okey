import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://kanka-okey-server.onrender.com", {
  transports: ["websocket", "polling"],
});

const TILE_WIDTH = 42;
const SLOT_WIDTH = 45;
const ROW_1_Y = 10;
const ROW_2_Y = 70;

const INDICATOR_TILE = {
  color: "yellow",
  number: 2,
};

const styles = `
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #07111f;
  color: white;
  overflow-x: hidden;
}

button {
  border: none;
  cursor: pointer;
  font-weight: bold;
  font-family: inherit;
}

.page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(34, 197, 94, 0.14), transparent 34%),
    linear-gradient(135deg, #07111f, #0f172a);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}

.home-card {
  width: 100%;
  max-width: 430px;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 26px;
  padding: 30px;
  text-align: center;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
}

.logo-row {
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  justify-content: center;
}

.logo-chip {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  background: linear-gradient(135deg, #f59e0b, #b45309);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 900;
}

h1 {
  margin: 0;
  font-size: 38px;
}

h2 {
  margin-top: 26px;
}

p {
  color: #cbd5e1;
}

.status {
  font-size: 14px;
  color: #94a3b8;
}

input {
  width: 100%;
  margin-top: 14px;
  padding: 15px;
  border-radius: 14px;
  border: 1px solid #334155;
  background: #020617;
  color: white;
  font-size: 16px;
  outline: none;
}

input:focus {
  border-color: #22c55e;
}

.home-card button {
  width: 100%;
  margin-top: 14px;
  padding: 15px;
  border-radius: 14px;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  font-size: 17px;
}

.home-card button.secondary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.home-card button.start {
  background: linear-gradient(135deg, #f97316, #ea580c);
}

.divider {
  margin: 20px 0 4px;
  color: #94a3b8;
}

.room-code {
  font-size: 42px;
  letter-spacing: 8px;
  font-weight: 900;
  background: #020617;
  border: 1px dashed #22c55e;
  padding: 16px;
  border-radius: 18px;
  margin: 10px 0;
}

.player-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.player-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #334155;
  margin-top: 9px;
  padding: 12px;
  border-radius: 12px;
  text-align: left;
}

.player-list span {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #22c55e;
  display: flex;
  align-items: center;
  justify-content: center;
}

.okey-screen {
  width: 100%;
  max-width: 1120px;
}

.top-hud {
  height: 54px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.menu-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #fbbf24, #b45309);
  color: #3b2108;
  font-size: 24px;
}

.room-pill,
.turn-pill,
.mode-pill {
  background: rgba(15, 23, 42, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  padding: 9px 14px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
}

.room-pill span {
  color: #94a3b8;
  font-size: 12px;
  margin-right: 8px;
}

.turn-pill {
  margin-left: auto;
}

.turn-pill.my-turn {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
}

.mode-pill {
  background: rgba(2, 6, 23, 0.8);
  color: #e2e8f0;
}

.okey-table {
  background: linear-gradient(135deg, #6b3f1d, #2f1b0d);
  border-radius: 34px;
  padding: 18px;
  box-shadow:
    inset 0 4px 0 rgba(255, 255, 255, 0.15),
    inset 0 -10px 0 rgba(0, 0, 0, 0.28),
    0 35px 80px rgba(0, 0, 0, 0.48);
}

.table-felt {
  position: relative;
  min-height: 640px;
  border-radius: 26px;
  overflow: hidden;
  background:
    radial-gradient(circle at center, rgba(255, 255, 255, 0.08), transparent 32%),
    linear-gradient(160deg, #0f95b1, #0a7397 55%, #075d80);
  box-shadow:
    inset 0 0 80px rgba(0, 0, 0, 0.28),
    inset 0 0 0 3px rgba(255, 255, 255, 0.08);
}

.table-felt::after {
  content: "KANKA OKEY";
  position: absolute;
  left: 50%;
  top: 41%;
  transform: translate(-50%, -50%) rotate(-5deg);
  font-size: 54px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.05);
  pointer-events: none;
}

.player-badge,
.my-player-card {
  position: absolute;
  z-index: 45;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(15, 23, 42, 0.93);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 18px;
  padding: 10px 13px;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.28);
}

.player-badge strong,
.my-player-card strong {
  display: block;
  font-size: 14px;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-subtitle {
  color: #facc15;
  font-size: 12px;
  min-height: 14px;
  display: block;
  font-weight: 700;
  margin-top: 2px;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background:
    radial-gradient(circle at top, #bae6fd, #0284c7);
  border: 3px solid #f8fafc;
  color: #082f49;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  text-transform: uppercase;
  flex-shrink: 0;
}

.player-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.top-player {
  left: 50%;
  top: 10px;
  transform: translateX(-50%);
}

.left-player {
  left: 16px;
  top: 146px;
  width: 76px;
  height: 172px;
  flex-direction: column;
  justify-content: center;
  padding: 10px 7px;
}

.left-player .player-info,
.right-player .player-info {
  align-items: center;
  gap: 2px;
}

.left-player strong,
.left-player .player-subtitle {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  max-height: 90px;
  max-width: unset;
}

.right-player {
  right: 16px;
  top: 146px;
  width: 76px;
  height: 172px;
  flex-direction: column;
  justify-content: center;
  padding: 10px 7px;
}

.right-player strong,
.right-player .player-subtitle {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  max-height: 90px;
  max-width: unset;
}

.my-player-card {
  left: 50%;
  bottom: 208px;
  transform: translateX(-50%);
  min-width: 168px;
  justify-content: center;
}

.my-player-card .player-info,
.top-player .player-info {
  align-items: flex-start;
}

.my-player-card.active-turn,
.player-badge.active-turn {
  box-shadow:
    0 0 0 3px rgba(34, 197, 94, 0.9),
    0 0 32px rgba(34, 197, 94, 0.85),
    0 14px 30px rgba(0, 0, 0, 0.35);
  border-color: rgba(34, 197, 94, 0.95);
}

.my-player-card.active-turn::after,
.player-badge.active-turn::after {
  content: "SIRA";
  position: absolute;
  top: -14px;
  right: 10px;
  background: #22c55e;
  color: white;
  font-size: 10px;
  font-weight: 900;
  padding: 3px 7px;
  border-radius: 999px;
}

.open-area {
  position: absolute;
  left: 104px;
  right: 104px;
  top: 88px;
  bottom: 236px;
  z-index: 5;
  display: flex;
  gap: 10px;
  pointer-events: none;
}

.open-area-main,
.open-area-pairs {
  height: 100%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background:
    linear-gradient(rgba(255, 255, 255, 0.026) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.026) 1px, transparent 1px),
    rgba(2, 6, 23, 0.06);
  background-size: 24px 24px;
  box-shadow:
    inset 0 0 35px rgba(255, 255, 255, 0.02),
    0 0 16px rgba(255, 255, 255, 0.035);
  border-radius: 8px;
  position: relative;
}

.open-area-main {
  flex: 7;
}

.open-area-pairs {
  flex: 3;
  min-width: 210px;
  max-width: 260px;
  padding: 30px 8px 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.pair-section {
  display: grid;
  grid-template-rows: repeat(12, 1fr);
  gap: 4px;
  min-height: 0;
}

.pair-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  min-height: 0;
}

.pair-cell {
  border: 1px dashed rgba(255, 255, 255, 0.22);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.025);
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.016);
  min-height: 13px;
}

.open-area-label,
.open-area-right-label {
  position: absolute;
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  font-weight: 900;
  background: rgba(2, 6, 23, 0.42);
  border-radius: 999px;
  padding: 3px 8px;
}

.open-area-label {
  left: 10px;
  top: -21px;
}

.open-area-right-label {
  left: 50%;
  top: 7px;
  transform: translateX(-50%);
  z-index: 2;
  white-space: nowrap;
}

.hand-summary-box {
  position: absolute;
  z-index: 42;
  right: 260px;
  bottom: 225px;
  width: 170px;
  height: 34px;
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 0 12px;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
}

.hand-summary-item {
  font-size: 12px;
  color: #e2e8f0;
  white-space: nowrap;
}

.hand-summary-item strong {
  color: #facc15;
  margin-left: 4px;
}

.center-tools {
  position: absolute;
  z-index: 42;
  right: 110px;
  bottom: 220px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.indicator-tile,
.deck-back-box {
  width: 62px;
  height: 70px;
  border-radius: 12px;
  background: rgba(2, 6, 23, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.14);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.indicator-tile span,
.deck-back-box span {
  color: #cbd5e1;
  font-size: 10px;
}

.deck-back-tile {
  width: 34px;
  height: 44px;
  border-radius: 7px;
  background:
    repeating-linear-gradient(
      45deg,
      #f8fafc,
      #f8fafc 5px,
      #fecaca 5px,
      #fecaca 10px
    );
  color: #991b1b;
  border: 2px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
}

.table-discard-zone {
  position: absolute;
  z-index: 44;
  width: 48px;
  height: 60px;
  padding: 0;
  border-radius: 9px;
  border: 2px dashed rgba(255, 255, 255, 0.55);
  background: rgba(2, 6, 23, 0.5);
  color: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.table-discard-zone span {
  position: absolute;
  top: -19px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #cbd5e1;
  white-space: nowrap;
  background: rgba(2, 6, 23, 0.75);
  padding: 2px 6px;
  border-radius: 999px;
}

.top-left-discard-zone {
  left: 116px;
  top: 68px;
}

.top-right-discard-zone {
  right: 116px;
  top: 68px;
}

.bottom-left-discard-zone {
  left: 116px;
  bottom: 224px;
}

.bottom-right-discard-zone {
  right: 48px;
  bottom: 224px;
}

.my-table-discard-zone {
  border-color: rgba(34, 197, 94, 0.95);
  background: rgba(34, 197, 94, 0.18);
}

.discard-zone-hover {
  background: rgba(34, 197, 94, 0.75);
  border-color: white;
  transform: scale(1.08);
}

.empty-discard-slot {
  width: 40px;
  height: 52px;
  border-radius: 7px;
  border: 2px dashed #94a3b8;
  background: rgba(255, 255, 255, 0.04);
}

.left-action-stack {
  position: absolute;
  left: 14px;
  bottom: 24px;
  z-index: 60;
  width: 92px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.left-action-stack button {
  width: 100%;
  padding: 8px 7px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #e2e8f0;
  font-size: 11px;
  line-height: 1.15;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.22);
}

.left-action-stack button:hover {
  background: rgba(30, 41, 59, 0.96);
}

.rack {
  position: absolute;
  z-index: 50;
  left: 115px;
  right: 22px;
  bottom: 18px;
  overflow: visible;
}

.rack-main {
  display: block;
  padding: 10px 12px;
  overflow: visible;
  background:
    linear-gradient(180deg, #d9a55b, #9a5f24 55%, #6b3f1d);
  border-left: 5px solid #4b2a10;
  border-right: 5px solid #4b2a10;
  box-shadow:
    inset 0 8px 12px rgba(255, 255, 255, 0.18),
    inset 0 -8px 12px rgba(0, 0, 0, 0.28);
}

.rack-wood-top {
  height: 16px;
  border-radius: 14px 14px 4px 4px;
  background:
    linear-gradient(180deg, #f3c27b, #9a5f24);
  border: 4px solid #613915;
  border-bottom: none;
}

.rack-wood-bottom {
  height: 18px;
  border-radius: 4px 4px 14px 14px;
  background:
    linear-gradient(180deg, #8a511f, #4b2a10);
  border: 4px solid #613915;
  border-top: none;
}

.free-rack-board {
  position: relative;
  width: 100%;
  height: 132px;
  background:
    linear-gradient(180deg, rgba(80, 43, 14, 0.35), rgba(50, 26, 8, 0.45));
  border-radius: 10px;
  overflow: visible;
  box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.25);
}

.rack-lane {
  position: absolute;
  left: 6px;
  right: 6px;
  height: 56px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.07);
  pointer-events: none;
}

.lane-top {
  top: 7px;
}

.lane-bottom {
  top: 68px;
}

.tile {
  width: 42px;
  height: 54px;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 7px;
  color: #020617;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  font-weight: 900;
  cursor: grab;
  user-select: none;
  touch-action: none;
  box-shadow:
    inset 0 -4px 0 rgba(0, 0, 0, 0.13),
    0 5px 10px rgba(0, 0, 0, 0.22);
}

.free-rack-board .tile {
  position: absolute;
  margin: 0;
  z-index: 10;
}

.free-rack-board .tile.dragging-tile {
  z-index: 99999;
  cursor: grabbing;
  box-shadow:
    0 0 0 3px rgba(34, 197, 94, 0.8),
    0 18px 34px rgba(0, 0, 0, 0.55);
}

.table-discard-zone .tile {
  position: static;
  margin: 0;
  cursor: default;
}

.center-static-tile {
  position: static !important;
  cursor: default !important;
}

.tile.red {
  color: #dc2626;
}

.tile.blue {
  color: #2563eb;
}

.tile.black {
  color: #020617;
}

.tile.yellow {
  color: #ca8a04;
}

.tile.fake {
  color: #7c3aed;
  border-color: #a855f7;
}

.tile.back-tile {
  background:
    repeating-linear-gradient(
      45deg,
      #f8fafc,
      #f8fafc 5px,
      #fecaca 5px,
      #fecaca 10px
    );
  color: transparent;
  border-color: #e2e8f0;
}

.tile.back-tile::after {
  content: "★";
  color: #991b1b;
  font-size: 18px;
}

.bottom-actions {
  display: none;
  gap: 10px;
  margin-top: 12px;
}

.bottom-actions button {
  flex: 1;
  padding: 14px;
  border-radius: 14px;
  color: white;
  background: linear-gradient(135deg, #22c55e, #16a34a);
}

.bottom-actions button.secondary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.bottom-actions button.start {
  background: linear-gradient(135deg, #f97316, #ea580c);
}

@media (max-width: 900px) {
  .page {
    padding: 8px;
    align-items: flex-start;
  }

  .okey-screen {
    max-width: 100%;
  }

  .top-hud {
    height: auto;
    flex-wrap: wrap;
  }

  .turn-pill {
    margin-left: 0;
    width: 100%;
    text-align: center;
  }

  .okey-table {
    padding: 9px;
    border-radius: 22px;
  }

  .table-felt {
    min-height: 690px;
    border-radius: 18px;
  }

  .left-player {
    top: 124px;
    left: 8px;
    width: 64px;
    height: 146px;
  }

  .right-player {
    top: 124px;
    right: 8px;
    width: 64px;
    height: 146px;
  }

  .player-badge {
    padding: 7px 9px;
    gap: 7px;
  }

  .avatar {
    width: 34px;
    height: 34px;
    border-width: 2px;
  }

  .open-area {
    left: 82px;
    right: 82px;
    top: 78px;
    bottom: 240px;
    gap: 8px;
  }

  .open-area-pairs {
    min-width: 170px;
    max-width: 190px;
    padding: 27px 6px 6px;
    gap: 6px;
  }

  .pair-section {
    grid-template-rows: repeat(12, 1fr);
    gap: 3px;
  }

  .pair-row {
    gap: 3px;
  }

  .pair-cell {
    min-height: 10px;
  }

  .bottom-right-discard-zone {
    right: 22px;
    bottom: 218px;
  }

  .hand-summary-box {
    right: 200px;
    bottom: 218px;
    width: 145px;
    height: 32px;
    gap: 10px;
  }

  .hand-summary-item {
    font-size: 11px;
  }

  .center-tools {
    right: 86px;
    bottom: 214px;
  }

  .indicator-tile,
  .deck-back-box {
    width: 56px;
    height: 66px;
  }

  .my-player-card {
    left: 50%;
    bottom: 200px;
    padding: 7px;
    min-width: 144px;
  }

  .left-action-stack {
    left: 8px;
    bottom: 8px;
    width: 74px;
  }

  .left-action-stack button {
    font-size: 10px;
    padding: 7px 5px;
  }

  .rack {
    left: 88px;
    right: 8px;
    bottom: 8px;
  }

  .free-rack-board {
    height: 126px;
  }

  .tile {
    width: 34px;
    height: 48px;
    font-size: 16px;
  }

  .empty-discard-slot {
    width: 34px;
    height: 48px;
  }

  .table-discard-zone {
    width: 42px;
    height: 56px;
  }

  .bottom-actions {
    display: flex;
  }
}
`;

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
  const [lastDiscardedByPlayerId, setLastDiscardedByPlayerId] = useState(null);

  const [tilePositions, setTilePositions] = useState({});
  const [draggingTile, setDraggingTile] = useState(null);
  const [isOverMyDiscard, setIsOverMyDiscard] = useState(false);
  const [flippedOkeyIds, setFlippedOkeyIds] = useState(() => new Set());
  const [heldOkeyTileId, setHeldOkeyTileId] = useState(null);

  const rackBoardRef = useRef(null);
  const pendingDiscardRef = useRef(null);
  const holdTimerRef = useRef(null);

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
      setLastDiscardedByPlayerId(data.lastDiscardedByPlayerId || null);
      setTilePositions(createInitialTilePositions(data.myHand));
      setDraggingTile(null);
      setIsOverMyDiscard(false);
      pendingDiscardRef.current = null;
    });

    socket.on("game-updated", (data) => {
      const inferredLastDiscardedBy = getPreviousPlayerIdFromList(
        data.players,
        data.currentTurnPlayerId
      );

      setRoomCode(data.roomCode);
      setPlayers(data.players);
      setMyPlayerId(data.myPlayerId);
      setMyHand(data.myHand);
      setDeckCount(data.deckCount);
      setCurrentTurnPlayerId(data.currentTurnPlayerId);
      setDiscardedTile(data.discardedTile);
      setLastDiscardedByPlayerId(
        data.lastDiscardedByPlayerId || inferredLastDiscardedBy
      );
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
        setLastDiscardedByPlayerId(pending.previousLastDiscardedByPlayerId);
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

  function getOkeyNumber() {
    return INDICATOR_TILE.number === 13 ? 1 : INDICATOR_TILE.number + 1;
  }

  function isRealOkeyTile(tile) {
    if (!tile || tile.fake) return false;
    return tile.color === INDICATOR_TILE.color && tile.number === getOkeyNumber();
  }

  function getEffectiveTile(tile) {
    if (!tile) return null;

    if (tile.fake) {
      return {
        ...tile,
        color: INDICATOR_TILE.color,
        number: getOkeyNumber(),
        fakeAsReal: true,
      };
    }

    return tile;
  }

  function shouldShowTileBack(tile) {
    if (!isRealOkeyTile(tile)) return false;
    return flippedOkeyIds.has(tile.id) || heldOkeyTileId === tile.id;
  }

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
    if (shouldShowTileBack(tile)) return "tile back-tile";
    if (tile.fake) return "tile fake";
    return `tile ${tile.color}`;
  }

  function getTileText(tile) {
    if (!tile) return "";
    if (shouldShowTileBack(tile)) return "";
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

      if (!occupyingTileId) return true;

      const canPush = pushRight(row, slot + 1);
      if (!canPush) return false;

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

      if (!occupyingTileId) return true;

      const canPush = pushLeft(row, slot - 1);
      if (!canPush) return false;

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

  function getPreviousPlayerIdFromList(playerList, currentId) {
    if (!playerList || playerList.length === 0 || !currentId) return null;

    const currentIndex = playerList.findIndex((player) => player.id === currentId);
    if (currentIndex === -1) return null;

    const previousIndex = (currentIndex - 1 + playerList.length) % playerList.length;
    return playerList[previousIndex]?.id || null;
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

    if (isRealOkeyTile(tile)) {
      holdTimerRef.current = setTimeout(() => {
        setHeldOkeyTileId(tile.id);
      }, 350);
    }

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

  function clearOkeyHold() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    setHeldOkeyTileId(null);
  }

  function toggleOkeyBack(tile) {
    if (!isRealOkeyTile(tile)) return;

    setFlippedOkeyIds((prev) => {
      const next = new Set(prev);

      if (next.has(tile.id)) {
        next.delete(tile.id);
      } else {
        next.add(tile.id);
      }

      return next;
    });
  }

  function handleTilePointerUp(e, tile) {
    clearOkeyHold();

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
      const previousLastDiscardedByPlayerId = lastDiscardedByPlayerId;

      pendingDiscardRef.current = {
        tile,
        position: previousPosition,
        previousDiscardedTile,
        previousLastDiscardedByPlayerId,
      };

      setDiscardedTile(tile);
      setLastDiscardedByPlayerId(myPlayerId);
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
    clearOkeyHold();

    if (tile) {
      snapTileToRack(tile.id);
    }

    setDraggingTile(null);
    setIsOverMyDiscard(false);
  }

  function getManualGroupsFromRack() {
    const placedTiles = myHand
      .map((tile) => {
        const position = tilePositions[tile.id] || { x: 12, y: ROW_1_Y };

        return {
          tile,
          row: closestRackRow(position.y),
          slot: positionToSlot(position.x),
        };
      })
      .sort((a, b) => a.row - b.row || a.slot - b.slot);

    const groups = [];
    let currentGroup = [];

    placedTiles.forEach((item) => {
      const last = currentGroup[currentGroup.length - 1];

      if (!last) {
        currentGroup = [item];
        return;
      }

      const sameRow = item.row === last.row;
      const closeEnough = item.slot - last.slot <= 1;

      if (sameRow && closeEnough) {
        currentGroup.push(item);
      } else {
        groups.push(currentGroup.map((groupItem) => groupItem.tile));
        currentGroup = [item];
      }
    });

    if (currentGroup.length) {
      groups.push(currentGroup.map((groupItem) => groupItem.tile));
    }

    return groups;
  }

  function evaluateGroup(group) {
    if (!group || group.length < 2) {
      return {
        type: "none",
        score: 0,
      };
    }

    const realOkeys = group.filter((tile) => isRealOkeyTile(tile));
    const normalTiles = group
      .filter((tile) => !isRealOkeyTile(tile))
      .map((tile) => getEffectiveTile(tile));

    if (group.length === 2) {
      if (normalTiles.length === 2) {
        const same =
          normalTiles[0].color === normalTiles[1].color &&
          normalTiles[0].number === normalTiles[1].number;

        return {
          type: same ? "pair" : "none",
          score: same ? 1 : 0,
        };
      }

      if (normalTiles.length === 1 && realOkeys.length === 1) {
        return {
          type: "pair",
          score: 1,
        };
      }
    }

    if (group.length >= 3) {
      const colors = ["yellow", "blue", "black", "red"];
      let bestRunScore = 0;

      colors.forEach((color) => {
        for (let start = 1; start <= 14 - group.length; start++) {
          const needed = Array.from(
            { length: group.length },
            (_, index) => start + index
          );

          const usedIds = new Set();
          let missing = 0;

          needed.forEach((number) => {
            const found = normalTiles.find((tile) => {
              if (usedIds.has(tile.id)) return false;

              return tile.color === color && tile.number === number;
            });

            if (found) {
              usedIds.add(found.id);
            } else {
              missing++;
            }
          });

          if (missing === realOkeys.length && usedIds.size === normalTiles.length) {
            const score = needed.reduce((sum, number) => sum + number, 0);
            bestRunScore = Math.max(bestRunScore, score);
          }
        }
      });

      let bestSetScore = 0;

      for (let number = 1; number <= 13; number++) {
        const usedColors = new Set();
        let valid = true;

        normalTiles.forEach((tile) => {
          if (tile.number !== number) {
            valid = false;
            return;
          }

          if (usedColors.has(tile.color)) {
            valid = false;
            return;
          }

          usedColors.add(tile.color);
        });

        if (valid && normalTiles.length + realOkeys.length === group.length) {
          bestSetScore = Math.max(bestSetScore, number * group.length);
        }
      }

      if (bestRunScore || bestSetScore) {
        return {
          type: "series",
          score: Math.max(bestRunScore, bestSetScore),
        };
      }
    }

    return {
      type: "none",
      score: 0,
    };
  }

  const liveHandSummary = useMemo(() => {
    const manualGroups = getManualGroupsFromRack();

    return manualGroups.reduce(
      (summary, group) => {
        const result = evaluateGroup(group);

        if (result.type === "series") {
          summary.seriPuan += result.score;
        }

        if (result.type === "pair") {
          summary.ciftSayisi += result.score;
        }

        return summary;
      },
      {
        seriPuan: 0,
        ciftSayisi: 0,
      }
    );
  }, [myHand, tilePositions]);

  function applyLayoutWithGroups(groups) {
    const positions = {};
    let row = 0;
    let slot = 0;
    const maxSlot = getMaxSlot();

    groups.forEach((groupObject) => {
      const group = Array.isArray(groupObject) ? groupObject : groupObject.tiles;

      if (!group || !group.length) return;

      if (slot + group.length > maxSlot + 1) {
        row = 1;
        slot = 0;
      }

      group.forEach((tile) => {
        if (slot > maxSlot) {
          row = 1;
          slot = 0;
        }

        positions[tile.id] = {
          x: slotToPosition(slot),
          y: row === 0 ? ROW_1_Y : ROW_2_Y,
        };

        slot++;
      });

      slot++;
    });

    setTilePositions((prev) => ({
      ...prev,
      ...positions,
    }));
  }

  function buildOkeyGroups(mode) {
    const colorOrder = {
      yellow: 0,
      blue: 1,
      black: 2,
      red: 3,
    };

    const unused = [...myHand];
    const groups = [];

    function removeTiles(group) {
      group.forEach((tile) => {
        const index = unused.findIndex((item) => item.id === tile.id);
        if (index !== -1) unused.splice(index, 1);
      });
    }

    function takeRealOkeys(count) {
      const jokers = unused.filter((tile) => isRealOkeyTile(tile)).slice(0, count);
      return jokers.length === count ? jokers : null;
    }

    function findRunsWithRealOkey() {
      const colors = ["yellow", "blue", "black", "red"];
      const candidates = [];

      colors.forEach((color) => {
        for (let start = 1; start <= 11; start++) {
          for (let length = 5; length >= 3; length--) {
            const neededNumbers = Array.from({ length }, (_, index) => start + index);
            if (neededNumbers.some((number) => number > 13)) continue;

            const realTiles = [];
            let missingCount = 0;

            neededNumbers.forEach((number) => {
              const realTile = unused.find((tile) => {
                if (isRealOkeyTile(tile)) return false;

                const effectiveTile = getEffectiveTile(tile);

                return (
                  effectiveTile.color === color &&
                  effectiveTile.number === number &&
                  !realTiles.some((used) => used.id === tile.id)
                );
              });

              if (realTile) {
                realTiles.push(realTile);
              } else {
                missingCount++;
              }
            });

            const jokers = takeRealOkeys(missingCount);

            if (realTiles.length + missingCount >= 3 && jokers) {
              candidates.push({
                type: "run",
                tiles: [...realTiles, ...jokers],
                score: neededNumbers.reduce((sum, number) => sum + number, 0),
                quality: realTiles.length * 10 + length,
              });
            }
          }
        }
      });

      candidates
        .sort((a, b) => b.score - a.score || b.quality - a.quality)
        .forEach((candidate) => {
          const available = candidate.tiles.every((tile) =>
            unused.some((item) => item.id === tile.id)
          );

          if (available) {
            groups.push(candidate);
            removeTiles(candidate.tiles);
          }
        });
    }

    function findSameNumberSetsWithRealOkey() {
      const candidates = [];

      for (let number = 1; number <= 13; number++) {
        const realTiles = [];
        const usedColors = new Set();

        unused.forEach((tile) => {
          if (isRealOkeyTile(tile)) return;

          const effectiveTile = getEffectiveTile(tile);

          if (effectiveTile.number !== number) return;
          if (usedColors.has(effectiveTile.color)) return;

          usedColors.add(effectiveTile.color);
          realTiles.push(tile);
        });

        for (let targetLength = 4; targetLength >= 3; targetLength--) {
          const missingCount = targetLength - realTiles.length;
          if (missingCount < 0) continue;

          const jokers = takeRealOkeys(missingCount);

          if (realTiles.length + missingCount >= 3 && jokers) {
            candidates.push({
              type: "set",
              tiles: [...realTiles.slice(0, targetLength), ...jokers],
              score: number * targetLength,
              quality: realTiles.length * 10 + targetLength,
            });
          }
        }
      }

      candidates
        .sort((a, b) => b.score - a.score || b.quality - a.quality)
        .forEach((candidate) => {
          const available = candidate.tiles.every((tile) =>
            unused.some((item) => item.id === tile.id)
          );

          if (available) {
            groups.push(candidate);
            removeTiles(candidate.tiles);
          }
        });
    }

    function findPairsWithRealOkey() {
      const candidates = [];
      const realTiles = unused.filter((tile) => !isRealOkeyTile(tile));

      realTiles.forEach((tile) => {
        const effectiveTile = getEffectiveTile(tile);

        const pairTile = unused.find((other) => {
          if (other.id === tile.id) return false;
          if (isRealOkeyTile(other)) return false;

          const otherEffective = getEffectiveTile(other);

          return (
            otherEffective.color === effectiveTile.color &&
            otherEffective.number === effectiveTile.number
          );
        });

        if (pairTile) {
          candidates.push({
            type: "pair",
            tiles: [tile, pairTile],
            score: effectiveTile.number * 2,
            quality: 10,
          });
        } else {
          const joker = takeRealOkeys(1)?.[0];

          if (joker) {
            candidates.push({
              type: "pair",
              tiles: [tile, joker],
              score: effectiveTile.number * 2,
              quality: 7,
            });
          }
        }
      });

      candidates
        .sort((a, b) => b.score - a.score || b.quality - a.quality)
        .forEach((candidate) => {
          const available = candidate.tiles.every((tile) =>
            unused.some((item) => item.id === tile.id)
          );

          if (available) {
            groups.push(candidate);
            removeTiles(candidate.tiles);
          }
        });
    }

    if (mode === "pair" || mode === "doubleTiles") {
      findPairsWithRealOkey();
      findSameNumberSetsWithRealOkey();
      findRunsWithRealOkey();
    } else {
      findRunsWithRealOkey();
      findSameNumberSetsWithRealOkey();
      findPairsWithRealOkey();
    }

    const rest = unused.sort((a, b) => {
      const effectiveA = getEffectiveTile(a);
      const effectiveB = getEffectiveTile(b);

      return (
        effectiveA.number - effectiveB.number ||
        (colorOrder[effectiveA.color] ?? 99) - (colorOrder[effectiveB.color] ?? 99)
      );
    });

    if (rest.length) {
      groups.push({
        type: "rest",
        tiles: rest,
        score: 0,
        quality: 0,
      });
    }

    return groups;
  }

  function handleArrange(mode) {
    if (!myHand.length) return;

    if (mode === "collect") {
      const tiles = [...myHand].sort((a, b) => {
        const pa = tilePositions[a.id] || { x: 12, y: ROW_1_Y };
        const pb = tilePositions[b.id] || { x: 12, y: ROW_1_Y };

        return closestRackRow(pa.y) - closestRackRow(pb.y) || pa.x - pb.x;
      });

      applyLayoutWithGroups([{ type: "rest", tiles }]);
      return;
    }

    const groups = buildOkeyGroups(mode);
    applyLayoutWithGroups(groups);
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
        onDoubleClick={() => toggleOkeyBack(tile)}
        onPointerDown={(e) => handleTilePointerDown(e, tile)}
        onPointerMove={(e) => handleTilePointerMove(e, tile)}
        onPointerUp={(e) => handleTilePointerUp(e, tile)}
        onPointerCancel={() => handleTilePointerCancel(tile)}
      >
        {getTileText(tile)}
      </div>
    );
  }

  function renderDiscardZoneForPlayer(playerId, className, label = "Atılan") {
    const shouldShowTile =
      discardedTile && playerId && playerId === lastDiscardedByPlayerId;

    return (
      <div className={`table-discard-zone ${className}`}>
        <span>{label}</span>
        {shouldShowTile ? (
          <div className={getTileClass(discardedTile)}>
            {getTileText(discardedTile)}
          </div>
        ) : (
          <div className="empty-discard-slot"></div>
        )}
      </div>
    );
  }

  function getPlayerPrestige(player) {
    if (!player) return 0;

    const value =
      player.money ??
      player.coins ??
      player.balance ??
      player.prestige ??
      player.gold;

    if (typeof value === "number") return value;

    const index = players.findIndex((p) => p.id === player.id);
    return 200 + (index + 1) * 17;
  }

  function renderPairSection(sectionIndex) {
    return (
      <div className="pair-section" key={sectionIndex}>
        {Array.from({ length: 12 }).map((_, rowIndex) => (
          <div className="pair-row" key={`${sectionIndex}-${rowIndex}`}>
            <div className="pair-cell"></div>
            <div className="pair-cell"></div>
          </div>
        ))}
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
    <>
      <style>{styles}</style>

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
              <div className="table-felt">
                {topPlayer && (
                  <div
                    className={`player-badge top-player ${
                      currentTurnPlayerId === topPlayer.id ? "active-turn" : ""
                    }`}
                  >
                    <div className="avatar">{topPlayer.name[0]}</div>
                    <div className="player-info">
                      <strong>{topPlayer.name}</strong>
                      <span className="player-subtitle">₺{getPlayerPrestige(topPlayer)}</span>
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
                    <div className="player-info">
                      <strong>{leftPlayer.name}</strong>
                      <span className="player-subtitle">₺{getPlayerPrestige(leftPlayer)}</span>
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
                    <div className="player-info">
                      <strong>{rightPlayer.name}</strong>
                      <span className="player-subtitle">₺{getPlayerPrestige(rightPlayer)}</span>
                    </div>
                  </div>
                )}

                {renderDiscardZoneForPlayer(leftPlayer?.id, "top-left-discard-zone")}
                {renderDiscardZoneForPlayer(topPlayer?.id, "top-right-discard-zone")}
                {renderDiscardZoneForPlayer(rightPlayer?.id, "bottom-left-discard-zone")}

                <div
                  className={`table-discard-zone my-table-discard-zone bottom-right-discard-zone ${
                    isOverMyDiscard ? "discard-zone-hover" : ""
                  }`}
                >
                  <span>TAŞ AT</span>
                  {discardedTile && lastDiscardedByPlayerId === myPlayerId ? (
                    <div className={getTileClass(discardedTile)}>
                      {getTileText(discardedTile)}
                    </div>
                  ) : (
                    <div className="empty-discard-slot"></div>
                  )}
                </div>

                <div className="open-area">
                  <div className="open-area-main">
                    <div className="open-area-label">Seri Açılan Alan</div>
                  </div>

                  <div className="open-area-pairs">
                    <div className="open-area-right-label">Çifte Açılan</div>
                    {renderPairSection(1)}
                    {renderPairSection(2)}
                  </div>
                </div>

                <div className="hand-summary-box">
                  <div className="hand-summary-item">
                    Seri <strong>{liveHandSummary.seriPuan}</strong>
                  </div>
                  <div className="hand-summary-item">
                    Çift <strong>{liveHandSummary.ciftSayisi}</strong>
                  </div>
                </div>

                <div className="center-tools">
                  <div className="indicator-tile">
                    <span>Gösterge</span>
                    <div className="tile yellow center-static-tile">
                      {INDICATOR_TILE.number}
                    </div>
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
                  <div className="player-info">
                    <strong>{me ? me.name : "Sen"}</strong>
                    <span className="player-subtitle">₺{getPlayerPrestige(me)}</span>
                  </div>
                </div>

                <div className="left-action-stack">
                  <button onClick={() => handleArrange("run")}>Sıralı Diz</button>
                  <button onClick={() => handleArrange("pair")}>Çift Diz</button>
                  <button onClick={() => handleArrange("doubleTiles")}>Çift Taş</button>
                  <button onClick={() => handleArrange("collect")}>Geri Topla</button>
                </div>

                <div className="rack">
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
    </>
  );
}

export default App;