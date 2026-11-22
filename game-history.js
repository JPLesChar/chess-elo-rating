/* Match archive editing and date-only game dates for the browser-only app. */
(() => {
  "use strict";

  const STORAGE_KEY = "chessClubEloDataV1";
  const K_FACTOR = 35;
  const historyTable = document.getElementById("historyTable");
  const editDialog = document.getElementById("gameEditDialog");
  const editForm = document.getElementById("gameEditForm");
  let editingGameId = null;

  function loadData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !Array.isArray(saved.players) || !Array.isArray(saved.games)) return null;
      return saved;
    } catch (error) {
      return null;
    }
  }

  function localToday() {
    const today = new Date();
    const pad = number => String(number).padStart(2, "0");
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  }

  function dateInputValue(value) {
    if (!value) return "";
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
  }

  function displayDate(value) {
    if (!value) return "Unknown";
    const dateOnly = dateInputValue(value);
    let date;
    if (dateOnly) {
      const [year, month, day] = dateOnly.split("-").map(Number);
      date = new Date(year, month - 1, day);
    } else {
      date = new Date(value);
    }
    if (Number.isNaN(date.getTime())) return "Unknown";
    const isDateOnly = value.length === 10;
    return date.toLocaleString([], isDateOnly ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" });
  }

  function syncHistoryDates() {
    const data = loadData();
    if (!data || !historyTable) return;
    historyTable.querySelectorAll("tr").forEach(row => {
      const id = row.querySelector("[data-delete-game]")?.dataset.deleteGame;
      const game = data.games.find(item => item.id === id);
      if (game && row.cells.length) row.cells[0].textContent = displayDate(game.date);
    });
  }

  function addEditButtons() {
    if (!historyTable) return;
    historyTable.querySelectorAll("tr").forEach(row => {
      const deleteButton = row.querySelector("[data-delete-game]");
      if (!deleteButton || row.querySelector("[data-edit-game]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "action-link";
      button.dataset.editGame = deleteButton.dataset.deleteGame;
      button.textContent = "Edit";
      button.setAttribute("aria-label", "Edit game");
      deleteButton.parentElement.prepend(button);
    });
    syncHistoryDates();
  }

  function fillPlayerSelect(select, players, selectedId) {
    select.replaceChildren(new Option("Select player", ""));
    [...players].sort((a, b) => a.name.localeCompare(b.name)).forEach(player => {
      select.add(new Option(player.name, player.id));
    });
    select.value = selectedId;
  }

  function openEditor(gameId) {
    const data = loadData();
    const game = data?.games.find(item => item.id === gameId);
    if (!game) return;
    editingGameId = gameId;
    document.getElementById("editGameDate").value = dateInputValue(game.date) || localToday();
    fillPlayerSelect(document.getElementById("editWhitePlayer"), data.players, game.whiteId);
    fillPlayerSelect(document.getElementById("editBlackPlayer"), data.players, game.blackId);
    const result = editForm.querySelector(`input[name="editResult"][value="${CSS.escape(game.result)}"]`);
    if (result) result.checked = true;
    editDialog.showModal();
  }

  function updatePlayerStats(data) {
    const players = new Map(data.players.map(player => [player.id, player]));
    data.players.forEach(player => {
      const startingRating = Number(player.initialRating);
      player.initialRating = Number.isFinite(startingRating) ? startingRating : (Number(player.rating) || 1400);
      player.rating = player.initialRating;
      player.gamesPlayed = 0;
      player.wins = 0;
      player.draws = 0;
      player.losses = 0;
      player.ratingHistory = [player.rating];
      player.highestRating = player.rating;
      player.lowestRating = player.rating;
    });

    data.games.forEach(game => {
      const white = players.get(game.whiteId);
      const black = players.get(game.blackId);
      game.previousWhiteRating = white ? white.rating : game.previousWhiteRating;
      game.previousBlackRating = black ? black.rating : game.previousBlackRating;
      let whiteChange = Number(game.whiteChange) || 0;
      let blackChange = Number(game.blackChange) || 0;

      if (white && black) {
        const whiteExpected = 1 / (1 + Math.pow(10, (black.rating - white.rating) / 400));
        const blackExpected = 1 - whiteExpected;
        const whiteScore = game.result === "1-0" ? 1 : game.result === "½-½" ? 0.5 : 0;
        whiteChange = Math.round(K_FACTOR * (whiteScore - whiteExpected));
        blackChange = Math.round(K_FACTOR * ((1 - whiteScore) - blackExpected));
        game.whiteChange = whiteChange;
        game.blackChange = blackChange;
      }

      if (white) {
        white.rating = Math.round(white.rating + whiteChange);
        white.gamesPlayed++;
        if (game.result === "1-0") white.wins++;
        else if (game.result === "0-1") white.losses++;
        else white.draws++;
        white.ratingHistory.push(white.rating);
        white.highestRating = Math.max(white.highestRating, white.rating);
        white.lowestRating = Math.min(white.lowestRating, white.rating);
      }
      if (black) {
        black.rating = Math.round(black.rating + blackChange);
        black.gamesPlayed++;
        if (game.result === "0-1") black.wins++;
        else if (game.result === "1-0") black.losses++;
        else black.draws++;
        black.ratingHistory.push(black.rating);
        black.highestRating = Math.max(black.highestRating, black.rating);
        black.lowestRating = Math.min(black.lowestRating, black.rating);
      }
    });
  }

  document.getElementById("gameDate").value ||= localToday();
  document.getElementById("gameForm").addEventListener("submit", event => {
    const selectedDate = document.getElementById("gameDate").value;
    const previousCount = loadData()?.games.length ?? 0;
    setTimeout(() => {
      if (!selectedDate) return;
      const data = loadData();
      if (!data || data.games.length <= previousCount) return;
      data.games[data.games.length - 1].date = selectedDate;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      syncHistoryDates();
    }, 0);
  });

  historyTable?.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-game]");
    if (editButton) openEditor(editButton.dataset.editGame);
  });

  editForm.addEventListener("submit", event => {
    event.preventDefault();
    const data = loadData();
    const game = data?.games.find(item => item.id === editingGameId);
    const date = document.getElementById("editGameDate").value;
    const whiteId = document.getElementById("editWhitePlayer").value;
    const blackId = document.getElementById("editBlackPlayer").value;
    const result = editForm.querySelector('input[name="editResult"]:checked')?.value;
    if (!game || !date || !whiteId || !blackId || !result) return;
    if (whiteId === blackId) {
      window.alert("A player cannot play against himself.");
      return;
    }

    game.date = date;
    game.whiteId = whiteId;
    game.blackId = blackId;
    game.result = result;
    updatePlayerStats(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    editDialog.close();
    window.location.reload();
  });

  function closeEditor() {
    editingGameId = null;
    editDialog.close();
  }

  document.getElementById("closeGameEdit").addEventListener("click", closeEditor);
  document.getElementById("cancelGameEdit").addEventListener("click", closeEditor);

  new MutationObserver(addEditButtons).observe(historyTable, { childList: true });
  addEditButtons();
})();
