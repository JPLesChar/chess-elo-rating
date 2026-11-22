/* Chess Club Elo Rating — static, browser-only application */
(() => {
  "use strict";

  const STORAGE_KEY = "chessClubEloDataV1";
  const K_FACTOR = 35;
  const DEFAULT_RATING = 1400;
  let data = loadData();
  let editingPlayerId = null;
  const charts = {};

  // Normalize a data object and guarantee every player has complete statistics/history.
  function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { players: [], games: [], settings: { theme: "light" } };
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.players) || !Array.isArray(parsed.games)) throw new Error("Invalid saved data");
      parsed.settings ||= { theme: "light" };
      normalizeAll(parsed.players);
      return parsed;
    } catch (error) {
      console.warn("Could not restore saved data:", error);
      return { players: [], games: [], settings: { theme: "light" } };
    }
  }

  function normalizeAll(players) {
    players.forEach(player => {
      player.gamesPlayed = Number(player.gamesPlayed) || 0;
      player.wins = Number(player.wins) || 0;
      player.draws = Number(player.draws) || 0;
      player.losses = Number(player.losses) || 0;
      player.ratingHistory = Array.isArray(player.ratingHistory) ? player.ratingHistory : [Number(player.rating) || DEFAULT_RATING];
      player.highestRating = Number.isFinite(Number(player.highestRating)) ? Number(player.highestRating) : Math.max(...player.ratingHistory);
      player.lowestRating = Number.isFinite(Number(player.lowestRating)) ? Number(player.lowestRating) : Math.min(...player.ratingHistory);
    });
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function createId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function formatDate(isoDate) {
    const date = new Date(isoDate);
    return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  function getPlayer(id) {
    return data.players.find(player => player.id === id);
  }

  function sortedPlayers() {
    return [...data.players].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  }

  function expectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  function renderAll() {
    renderPlayers();
    renderDashboard();
    renderGameSelects();
    renderHistory();
    renderRatingCharts();
  }

  function renderPlayers() {
    const search = document.getElementById("playerSearch").value.trim().toLowerCase();
    const players = sortedPlayers().filter(player => player.name.toLowerCase().includes(search));
    document.getElementById("playerTable").innerHTML = players.length ? players.map((player, index) => `
      <tr><td><span class="rank">${index + 1}</span></td><td><strong>${escapeHtml(player.name)}</strong></td><td class="rating">${player.rating}</td><td>${player.gamesPlayed}</td><td>${player.wins}</td><td>${player.draws}</td><td>${player.losses}</td><td><button class="action-link" data-edit-player="${player.id}" type="button">Edit</button><button class="action-link danger" data-delete-player="${player.id}" type="button">Delete</button></td></tr>`).join("") : `<tr><td colspan="8">No players found.</td></tr>`;
  }

  function renderDashboard() {
    const active = [...data.players].sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0];
    const highest = sortedPlayers()[0];
    const gain = [...data.players].sort((a, b) => (b.rating - b.initialRating) - (a.rating - a.initialRating))[0];
    const loss = [...data.players].sort((a, b) => (a.rating - a.initialRating) - (b.rating - b.initialRating))[0];
    const gainValue = gain ? gain.rating - gain.initialRating : 0;
    const lossValue = loss ? loss.rating - loss.initialRating : 0;
    const cards = [
      ["Total players", data.players.length], ["Total games", data.games.length],
      ["Most active player", active ? `${active.name} (${active.gamesPlayed})` : "—"],
      ["Highest rated player", highest ? `${highest.name} (${highest.rating})` : "—"],
      ["Biggest rating gain", gain && gainValue >= 0 ? `${gain.name} (+${gainValue})` : "—"],
      ["Biggest rating loss", loss && lossValue < 0 ? `${loss.name} (${lossValue})` : "—"]
    ];
    document.getElementById("statsGrid").innerHTML = cards.map(([label, value]) => `<article class="stat-card"><span>${label}</span><strong>${escapeHtml(value)}</strong></article>`).join("");
    document.getElementById("topPlayers").innerHTML = sortedPlayers().slice(0, 5).map((player, index) => `<div style="display:grid;grid-template-columns:50px 1fr auto;padding:14px 20px;border-bottom:1px solid var(--border)"><span class="rank">${index + 1}</span><strong>${escapeHtml(player.name)}</strong><strong>${player.rating}</strong></div>`).join("") || `<div style="padding:20px;color:var(--muted)">Add players to begin.</div>`;
  }

  function renderGameSelects() {
    const white = document.getElementById("whitePlayer");
    const black = document.getElementById("blackPlayer");
    const whiteValue = white.value;
    const blackValue = black.value;
    const options = `<option value="">Select player</option>` + sortedPlayers().map(player => `<option value="${player.id}">${escapeHtml(player.name)} — ${player.rating}</option>`).join("");
    white.innerHTML = options;
    black.innerHTML = options;
    if ([...white.options].some(option => option.value === whiteValue)) white.value = whiteValue;
    if ([...black.options].some(option => option.value === blackValue)) black.value = blackValue;
  }

  function renderHistory() {
    const tbody = document.getElementById("historyTable");
    tbody.innerHTML = data.games.length ? [...data.games].reverse().map(game => {
      const white = getPlayer(game.whiteId);
      const black = getPlayer(game.blackId);
      const whiteChange = game.whiteChange;
      const blackChange = game.blackChange;
      const changeClass = value => value >= 0 ? "positive" : "negative";
      return `<tr><td>${formatDate(game.date)}</td><td>${escapeHtml(white?.name || "Deleted player")}</td><td>${escapeHtml(black?.name || "Deleted player")}</td><td><strong>${game.result}</strong></td><td><span class="${changeClass(whiteChange)}">${whiteChange >= 0 ? "+" : ""}${whiteChange}</span> / <span class="${changeClass(blackChange)}">${blackChange >= 0 ? "+" : ""}${blackChange}</span></td><td><button class="action-link danger" data-delete-game="${game.id}" type="button">Delete</button></td></tr>`;
    }).join("") : `<tr><td colspan="6">No games recorded.</td></tr>`;
  }

  function renderRatingCharts() {
    Object.values(charts).forEach(chart => chart.destroy());
    Object.keys(charts).forEach(key => delete charts[key]);
    const grid = document.getElementById("ratingCards");
    grid.innerHTML = sortedPlayers().length ? sortedPlayers().map(player => `
      <article class="rating-card"><div class="rating-card-header"><div><h2>${escapeHtml(player.name)}</h2><div class="range-line">Highest ${player.highestRating} · Lowest ${player.lowestRating}</div></div><strong class="rating">${player.rating}</strong></div><canvas id="chart-${player.id}" aria-label="Rating progression for ${escapeHtml(player.name)}"></canvas></article>`).join("") : `<div class="panel" style="grid-column:1/-1;padding:20px;color:var(--muted)">Add players to create rating charts.</div>`;

    if (typeof Chart === "undefined") return;
    const dark = document.documentElement.dataset.theme === "dark";
    sortedPlayers().forEach((player, index) => {
      const canvas = document.getElementById(`chart-${player.id}`);
      if (!canvas) return;
      charts[player.id] = new Chart(canvas, { type: "line", data: { labels: player.ratingHistory.map((_, i) => i === 0 ? "Start" : `Game ${i}`), datasets: [{ data: player.ratingHistory, borderColor: index % 2 ? "#d1a65f" : "#b85b50", backgroundColor: dark ? "rgba(184,91,80,.12)" : "rgba(123,45,38,.10)", fill: true, tension: .25, pointRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: dark ? "#aaa79f" : "#77736b" }, grid: { color: dark ? "#3b3b35" : "#ddd8ce" } }, y: { ticks: { color: dark ? "#aaa79f" : "#77736b" }, grid: { color: dark ? "#3b3b35" : "#ddd8ce" } } } } });
    });
  }

  function openPlayerDialog(player = null) {
    editingPlayerId = player?.id || null;
    document.getElementById("playerDialogTitle").textContent = player ? "Edit Player" : "Add Player";
    document.getElementById("playerName").value = player?.name || "";
    document.getElementById("playerRating").value = player?.rating ?? DEFAULT_RATING;
    document.getElementById("playerDialog").showModal();
  }

  function closePlayerDialog() {
    document.getElementById("playerDialog").close();
    editingPlayerId = null;
  }

  document.getElementById("playerForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = document.getElementById("playerName").value.trim();
    const rating = Math.round(Number(document.getElementById("playerRating").value));
    if (!name) return showToast("Enter a player name.");
    if (!Number.isFinite(rating) || rating < 100 || rating > 4000) return showToast("Rating must be between 100 and 4000.");
    if (editingPlayerId) {
      const player = getPlayer(editingPlayerId);
      if (!player) return;
      player.name = name;
      player.rating = rating;
      if (player.ratingHistory.length === 1) player.ratingHistory[0] = rating;
      player.initialRating = rating;
      player.highestRating = Math.max(player.highestRating, rating);
      player.lowestRating = Math.min(player.lowestRating, rating);
      showToast("Player updated.");
    } else {
      data.players.push({ id: createId("player"), name, rating, initialRating: rating, gamesPlayed: 0, wins: 0, draws: 0, losses: 0, ratingHistory: [rating], highestRating: rating, lowestRating: rating });
      showToast("Player added.");
    }
    saveData();
    closePlayerDialog();
    renderAll();
  });

  document.getElementById("gameForm").addEventListener("submit", event => {
    event.preventEvent?.();
    event.preventDefault();
    const whiteId = document.getElementById("whitePlayer").value;
    const blackId = document.getElementById("blackPlayer").value;
    const result = document.querySelector('input[name="result"]:checked')?.value;
    if (!whiteId || !blackId || !result) return showToast("Complete every field.");
    if (whiteId === blackId) return showToast("A player cannot play himself.");
    const white = getPlayer(whiteId);
    const black = getPlayer(blackId);
    if (!white || !black) return showToast("Both players must exist.");

    const whiteExpected = expectedScore(white.rating, black.rating);
    const blackExpected = expectedScore(black.rating, white.rating);
    const whiteScore = result === "1-0" ? 1 : result === "½-½" ? .5 : 0;
    const blackScore = 1 - whiteScore;
    const whiteChange = Math.round(K_FACTOR * (whiteScore - whiteExpected));
    const blackChange = Math.round(K_FACTOR * (blackScore - blackExpected));

    // Preserve the exact old state in the game record so deletion and undo are reliable.
    const previousWhiteRating = white.rating;
    const previousBlackRating = black.rating;
    white.rating = Math.round(white.rating + whiteChange);
    black.rating = Math.round(black.rating + blackChange);
    white.gamesPlayed++; black.gamesPlayed++;
    if (whiteScore === 1) { white.wins++; black.losses++; } else if (whiteScore === 0) { black.wins++; white.losses++; } else { white.draws++; black.draws++; }
    white.ratingHistory.push(white.rating); black.ratingHistory.push(black.rating);
    white.highestRating = Math.max(white.highestRating, white.rating); white.lowestRating = Math.min(white.lowestRating, white.rating);
    black.highestRating = Math.max(black.highestRating, black.rating); black.lowestRating = Math.min(black.lowestRating, black.rating);

    data.games.push({ id: createId("game"), date: new Date().toISOString(), whiteId, blackId, result, whiteChange, blackChange, previousWhiteRating, previousBlackRating });
    saveData();
    event.target.reset();
    renderAll();
    showToast("Game recorded successfully.");
  });

  function reverseGame(game) {
    const white = getPlayer(game.whiteId);
    const black = getPlayer(game.blackId);
    if (white) {
      white.rating = game.previousWhiteRating;
      white.gamesPlayed = Math.max(0, white.gamesPlayed - 1);
      if (game.result === "1-0") white.wins = Math.max(0, white.wins - 1); else if (game.result === "0-1") white.losses = Math.max(0, white.losses - 1); else white.draws = Math.max(0, white.draws - 1);
      white.ratingHistory.pop();
      recalibratePlayerExtremes(white);
    }
    if (black) {
      black.rating = game.previousBlackRating;
      black.gamesPlayed = Math.max(0, black.gamesPlayed - 1);
      if (game.result === "0-1") black.wins = Math.max(0, black.wins - 1); else if (game.result === "1-0") black.losses = Math.max(0, black.losses - 1); else black.draws = Math.max(0, black.draws - 1);
      black.ratingHistory.pop();
      recalibratePlayerExtremes(black);
    }
  }

  function recalibratePlayerExtremes(player) {
    const history = player.ratingHistory.length ? player.ratingHistory : [player.rating];
    player.highestRating = Math.max(...history);
    player.lowestRating = Math.min(...history);
  }

  document.getElementById("undoButton").addEventListener("click", () => {
    if (!data.games.length) return showToast("There is no game to undo.");
    if (!confirm("Undo the last recorded game?")) return;
    reverseGame(data.games[data.games.length - 1]);
    data.games.pop();
    saveData();
    renderAll();
    showToast("Last game undone.");
  });

  document.getElementById("historyTable").addEventListener("click", event => {
    const button = event.target.closest("[data-delete-game]");
    if (!button) return;
    if (!confirm("Delete this game and reverse its rating changes?")) return;
    const index = data.games.findIndex(game => game.id === button.dataset.deleteGame);
    if (index < 0) return;
    reverseGame(data.games[index]);
    data.games.splice(index, 1);
    saveData();
    renderAll();
    showToast("Game deleted and ratings restored.");
  });

  document.getElementById("playerTable").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-player]");
    const remove = event.target.closest("[data-delete-player]");
    if (edit) openPlayerDialog(getPlayer(edit.dataset.editPlayer));
    if (remove) {
      const player = getPlayer(remove.dataset.deletePlayer);
      if (!player || !confirm(`Delete ${player.name}? Their games will remain in history.`)) return;
      data.players = data.players.filter(item => item.id !== player.id);
      saveData();
      renderAll();
      showToast("Player deleted.");
    }
  });

  document.getElementById("addPlayerButton").addEventListener("click", () => openPlayerDialog());
  document.getElementById("closePlayerDialog").addEventListener("click", closePlayerDialog);
  document.getElementById("cancelPlayerDialog").addEventListener("click", closePlayerDialog);
  document.getElementById("playerSearch").addEventListener("input", renderPlayers);

  document.querySelectorAll(".nav-button").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".nav-button").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".section").forEach(section => section.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.section).classList.add("active");
    if (button.dataset.section === "ratings") renderRatingCharts();
  }));

  function setTheme(theme) {
    if (theme === "dark") document.documentElement.dataset.theme = "dark"; else delete document.documentElement.dataset.theme;
    data.settings.theme = theme;
    document.getElementById("themeToggle").textContent = theme === "dark" ? "☀" : "☾";
    saveData();
  }
  document.getElementById("themeToggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

  document.getElementById("exportButton").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chess-club-elo-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Data exported.");
  });

  document.getElementById("importButton").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported || !Array.isArray(imported.players) || !Array.isArray(imported.games)) throw new Error("The file must contain players and games arrays.");
      const ids = new Set();
      for (const player of imported.players) {
        if (!player.id || typeof player.id !== "string" || typeof player.name !== "string" || !player.name.trim()) throw new Error("Invalid player record.");
        if (ids.has(player.id)) throw new Error("Duplicate player IDs found.");
        ids.add(player.id);
        if (!Number.isFinite(Number(player.rating)) || Number(player.rating) < 100 || Number(player.rating) > 4000) throw new Error("Invalid player rating.");
        player.rating = Math.round(Number(player.rating));
        player.initialRating = Number.isFinite(Number(player.initialRating)) ? Math.round(Number(player.initialRating)) : player.rating;
      }
      for (const game of imported.games) {
        if (!game.id || !["1-0", "½-½", "0-1"].includes(game.result) || !ids.has(game.whiteId) || !ids.has(game.blackId) || game.whiteId === game.blackId) throw new Error("Invalid game record or unknown player ID.");
        if (!Number.isFinite(Number(game.whiteChange)) || !Number.isFinite(Number(game.blackChange))) throw new Error("Invalid rating change in game history.");
      }
      if (!confirm("Importing replaces all current data. Continue?")) return;
      imported.settings = imported.settings && typeof imported.settings.theme === "string" ? imported.settings : { theme: "light" };
      normalizeAll(imported.players);
      data = imported;
      saveData();
      setTheme(data.settings.theme === "dark" ? "dark" : "light");
      renderAll();
      showToast("Data imported successfully.");
    } catch (error) {
      showToast(error.message || "Could not import this file.");
    } finally {
      event.target.value = "";
    }
  });

  setTheme(data.settings?.theme === "dark" ? "dark" : "light");
  renderAll();
})();
