const fs = require("fs");

const appPath = "src/App.jsx";
let app = fs.readFileSync(appPath, "utf8");

function replaceBlock(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start === -1) {
    console.log("Başlangıç bulunamadı:", startMarker);
    return source;
  }

  const end = source.indexOf(endMarker, start);
  if (end === -1) {
    console.log("Bitiş bulunamadı:", endMarker);
    return source;
  }

  return source.slice(0, start) + replacement + source.slice(end);
}

/* Ekranı fazla büyüten ayarı geri toparla */
app = app.replace(/min-height:\s*720px;/g, "min-height: 660px;");
app = app.replace(/min-height:\s*760px;/g, "min-height: 710px;");
app = app.replace(/min-height:\s*640px;/g, "min-height: 660px;");
app = app.replace(/min-height:\s*690px;/g, "min-height: 710px;");

/* Orta açma alanını yeniden dengeli tasarla */
const middleCss = `/* ORTA AÇMA ALANI */
.open-area {
  position: absolute;
  left: 104px;
  right: 104px;
  top: 78px;
  bottom: 270px;
  z-index: 5;
  display: flex;
  gap: 10px;
  pointer-events: auto;
}

.open-area-main,
.open-area-pairs {
  position: relative;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid rgba(214, 228, 240, 0.42);
  background: rgba(24, 47, 67, 0.68);
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
  gap: 4px;
  grid-template-rows: repeat(12, 1fr);
}

.series-row {
  display: grid;
  grid-template-columns: repeat(13, 1fr);
  gap: 3px;
  min-height: 0;
}

.pair-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 3px;
  min-height: 0;
}

.series-cell,
.pair-cell {
  min-height: 0;
  border: 1px solid rgba(214, 228, 240, 0.26);
  background: rgba(255, 255, 255, 0.032);
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
  font-size: 17px;
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

app = replaceBlock(app, "/* ORTA AÇMA ALANI */", ".hand-summary-box {", middleCss);

/* Alt kontrol alanlarını tekrar ıstakanın üstüne düzgün koy */
app = app.replace(
  /\.hand-summary-box \{\s*position: absolute;\s*z-index: 42;\s*right:\s*\d+px;\s*bottom:\s*\d+px;/,
  `.hand-summary-box {
  position: absolute;
  z-index: 42;
  right: 278px;
  bottom: 204px;`
);

app = app.replace(
  /\.center-tools \{\s*position: absolute;\s*z-index: 42;\s*right:\s*\d+px;\s*bottom:\s*\d+px;/,
  `.center-tools {
  position: absolute;
  z-index: 42;
  right: 80px;
  bottom: 210px;`
);

app = app.replace(
  /\.my-player-card \{\s*left: 50%;\s*bottom:\s*\d+px;/,
  `.my-player-card {
  left: 50%;
  bottom: 198px;`
);

app = app.replace(
  /\.bottom-left-discard-zone \{\s*left:\s*\d+px;\s*bottom:\s*\d+px;/,
  `.bottom-left-discard-zone {
  left: 18px;
  bottom: 210px;`
);

app = app.replace(
  /\.bottom-right-discard-zone \{\s*right:\s*\d+px;\s*bottom:\s*\d+px;/,
  `.bottom-right-discard-zone {
  right: 18px;
  bottom: 210px;`
);

/* Iştakayı tekrar altta görünür yap */
app = app.replace(
  /\.rack \{\s*position: absolute;\s*z-index: 50;\s*left:\s*\d+px;\s*right:\s*\d+px;\s*bottom:\s*\d+px;/,
  `.rack {
  position: absolute;
  z-index: 80;
  left: 115px;
  right: 22px;
  bottom: 18px;`
);

app = app.replace(
  /\.left-action-stack \{\s*position: absolute;\s*left:\s*\d+px;\s*bottom:\s*\d+px;/,
  `.left-action-stack {
  position: absolute;
  left: 14px;
  bottom: 24px;`
);

/* Taşların sadece yazı gibi akmasını engelle: tile absolute kuralını garantiye al */
if (!app.includes(".free-rack-board > .tile")) {
  app = app.replace(
    `.free-rack-board .tile {
  position: absolute;`,
    `.free-rack-board .tile,
.free-rack-board > .tile {
  position: absolute;`
  );
}

/* Taş yazılarını discard label CSS'inden koru */
app = app.replace(/\.table-discard-zone span \{/g, ".table-discard-zone > span {");

if (!app.includes(".table-discard-zone .tile span")) {
  app = app.replace(
    `.center-static-tile {`,
    `.table-discard-zone .tile span {
  position: static !important;
  transform: none !important;
  color: inherit !important;
  background: transparent !important;
  padding: 0 !important;
  border-radius: 0 !important;
  font-size: inherit !important;
  font-weight: 900 !important;
}

.center-static-tile {`
  );
}

/* Mobil düzeni de toparla */
app = app.replace(
  /\.open-area \{\s*left: 78px;[\s\S]*?\.opened-tile \{\s*font-size: 12px;\s*\}/,
  `.open-area {
    left: 82px;
    right: 82px;
    top: 78px;
    bottom: 305px;
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
  "$1 222px;"
);

app = app.replace(
  /(@media \(max-width: 900px\) \{[\s\S]*?\.my-player-card \{\s*bottom:)\s*\d+px;/,
  "$1 206px;"
);

app = app.replace(
  /(@media \(max-width: 900px\) \{[\s\S]*?\.hand-summary-box \{\s*right:\s*150px;\s*bottom:)\s*\d+px;/,
  "$1 214px;"
);

app = app.replace(
  /(@media \(max-width: 900px\) \{[\s\S]*?\.rack \{\s*left:\s*88px;\s*right:\s*8px;\s*bottom:)\s*\d+px;/,
  "$1 8px;"
);

fs.writeFileSync(appPath, app);

console.log("Ekran toparlandı.");
console.log("Orta alan korunuyor, ıstaka ve kontroller tekrar düzgün yere alındı.");