const fs = require("fs");

const appPath = "src/App.jsx";
let app = fs.readFileSync(appPath, "utf8");

function replaceBlock(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start === -1) {
    console.log("Bulunamadı:", startMarker);
    return source;
  }

  const end = source.indexOf(endMarker, start);
  if (end === -1) {
    console.log("Bitiş bulunamadı:", endMarker);
    return source;
  }

  return source.slice(0, start) + replacement + source.slice(end);
}

/* Masa yüksekliği: ıstaka ve orta alan birbirine girmesin */
app = app.replace(
  /min-height:\s*640px;/,
  "min-height: 720px;"
);

app = app.replace(
  /min-height:\s*690px;/,
  "min-height: 760px;"
);

/* Orta açma alanını geniş ama ıstakaya taşmayacak şekilde yeniden konumlandır */
const newMiddleCss = `/* ORTA AÇMA ALANI */
.open-area {
  position: absolute;
  left: 96px;
  right: 96px;
  top: 62px;
  bottom: 330px;
  z-index: 5;
  display: flex;
  gap: 10px;
}

.open-area-main,
.open-area-pairs {
  position: relative;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid rgba(214, 228, 240, 0.42);
  background: rgba(24, 47, 67, 0.72);
  box-shadow:
    inset 0 0 20px rgba(255, 255, 255, 0.035),
    0 0 12px rgba(0, 0, 0, 0.18);
}

.open-area-main {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 26px 8px 8px;
}

.open-area-pairs {
  width: 186px;
  flex: 0 0 186px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 26px 8px 8px;
}

.series-section,
.pair-section {
  display: grid;
  min-height: 0;
  gap: 5px;
  grid-template-rows: repeat(12, 1fr);
}

.series-row {
  display: grid;
  grid-template-columns: repeat(13, 1fr);
  gap: 4px;
  min-height: 0;
}

.pair-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  min-height: 0;
}

.series-cell,
.pair-cell {
  min-height: 0;
  border: 1px solid rgba(214, 228, 240, 0.28);
  background: rgba(255, 255, 255, 0.035);
  border-radius: 5px;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  overflow: hidden;
}

.series-cell.drop-target,
.pair-cell.drop-target {
  background: rgba(34, 197, 94, 0.16);
  border-color: rgba(34, 197, 94, 0.65);
}

.open-area-label,
.open-area-right-label {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  color: rgba(255, 255, 255, 0.68);
  font-size: 10px;
  font-weight: 900;
  background: rgba(2, 6, 23, 0.38);
  border-radius: 999px;
  padding: 3px 10px;
  white-space: nowrap;
  pointer-events: none;
}

.opened-tile {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  border-radius: 4px;
  background: #f8fafc;
  color: #020617;
  border: none;
  font-size: 18px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.10);
  cursor: pointer;
}

.opened-tile.red {
  color: #dc2626;
}

.opened-tile.blue {
  color: #2563eb;
}

.opened-tile.black {
  color: #020617;
}

.opened-tile.yellow {
  color: #ca8a04;
}

.opened-tile.fake {
  color: #7c3aed;
  border: 1px solid #a855f7;
}

.opened-tile.joker-opened {
  outline: 2px solid #facc15;
  outline-offset: -2px;
}

.hand-summary-box {`;

app = replaceBlock(app, "/* ORTA AÇMA ALANI */", ".hand-summary-box {", newMiddleCss);

/* Profil, gösterge ve özet kutuları orta alanın üstüne binmesin */
app = app.replace(
  /\.my-player-card \{\s*left: 50%;\s*bottom:\s*\d+px;/,
  `.my-player-card {
  left: 50%;
  bottom: 218px;`
);

app = app.replace(
  /\.center-tools \{\s*position: absolute;\s*z-index: 42;\s*right:\s*\d+px;\s*bottom:\s*\d+px;/,
  `.center-tools {
  position: absolute;
  z-index: 42;
  right: 80px;
  bottom: 220px;`
);

app = app.replace(
  /\.hand-summary-box \{\s*position: absolute;\s*z-index: 42;\s*right:\s*\d+px;\s*bottom:\s*\d+px;/,
  `.hand-summary-box {
  position: absolute;
  z-index: 42;
  right: 278px;
  bottom: 218px;`
);

/* Atılan taş kutuları da orta alanı kapatmasın */
app = app.replace(
  /\.bottom-left-discard-zone \{\s*left:\s*\d+px;\s*bottom:\s*\d+px;/,
  `.bottom-left-discard-zone {
  left: 18px;
  bottom: 230px;`
);

app = app.replace(
  /\.bottom-right-discard-zone \{\s*right:\s*\d+px;\s*bottom:\s*\d+px;/,
  `.bottom-right-discard-zone {
  right: 18px;
  bottom: 230px;`
);

/* Mobil düzeni toparla */
app = app.replace(
  /\.open-area \{\s*left: 78px;[\s\S]*?\.opened-tile \{\s*font-size: 12px;\s*\}/,
  `.open-area {
    left: 78px;
    right: 78px;
    top: 58px;
    bottom: 335px;
    gap: 6px;
  }

  .open-area-main {
    gap: 5px;
    padding: 24px 5px 5px;
  }

  .open-area-pairs {
    width: 132px;
    flex-basis: 132px;
    gap: 5px;
    padding: 24px 5px 5px;
  }

  .series-section,
  .pair-section {
    gap: 3px;
  }

  .series-row,
  .pair-row {
    gap: 2px;
  }

  .series-cell,
  .pair-cell {
    border-radius: 3px;
  }

  .opened-tile {
    font-size: 12px;
  }`
);

app = app.replace(
  /(@media \(max-width: 900px\) \{[\s\S]*?\.center-tools \{\s*right:\s*44px;\s*bottom:)\s*\d+px;/,
  "$1 242px;"
);

app = app.replace(
  /(@media \(max-width: 900px\) \{[\s\S]*?\.my-player-card \{\s*bottom:)\s*\d+px;/,
  "$1 230px;"
);

app = app.replace(
  /(@media \(max-width: 900px\) \{[\s\S]*?\.hand-summary-box \{\s*right:\s*150px;\s*bottom:)\s*\d+px;/,
  "$1 238px;"
);

fs.writeFileSync(appPath, app);

console.log("Layout toparlandı.");
console.log("Orta alan geniş kaldı ama ıstaka, profil ve yazılar tekrar aşağıda düzgün duracak.");