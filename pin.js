/* Client-side admin-mode gate for this browser-only app. This is not secure authentication. */
(() => {
  "use strict";

  const DEFAULT_PIN = "1234";
  const PIN_KEY = "chessClubRecordGamePin";
  const loginButton = document.getElementById("adminLoginButton");
  const changePinButton = document.getElementById("changePinButton");
  const pinDialog = document.getElementById("pinDialog");
  const pinForm = document.getElementById("pinForm");
  const pinInput = document.getElementById("pinInput");
  const newPinInput = document.getElementById("newPinInput");
  const confirmPinInput = document.getElementById("confirmPinInput");
  const title = document.getElementById("pinDialogTitle");
  const newPinLabel = document.getElementById("pinNewLabel");
  const confirmPinLabel = document.getElementById("pinConfirmLabel");
  const gameForm = document.getElementById("gameForm");
  const recordNotice = document.getElementById("recordReadOnlyNotice");
  const playersTable = document.getElementById("playerTable");
  const historyTable = document.getElementById("historyTable");
  let isAdmin = false;
  let isChangingPin = false;

  function currentPin() {
    return localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
  }

  function toast(message) {
    const node = document.getElementById("toast");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
  }

  function resetPinForm() {
    pinForm.reset();
    isChangingPin = false;
    newPinLabel.hidden = true;
    confirmPinLabel.hidden = true;
    newPinInput.required = false;
    confirmPinInput.required = false;
  }

  function openLogin() {
    resetPinForm();
    title.textContent = "Admin Login";
    pinDialog.showModal();
    pinInput.focus();
  }

  function openChangePin() {
    resetPinForm();
    isChangingPin = true;
    title.textContent = "Change Admin PIN";
    pinDialog.showModal();
    pinInput.focus();
  }

  function updateReadOnlyUI() {
    loginButton.textContent = isAdmin ? "Admin Logout" : "Admin Login";
    changePinButton.hidden = !isAdmin;
    recordNotice.hidden = isAdmin;
    gameForm.querySelectorAll("input, select, button").forEach(control => { control.disabled = !isAdmin; });

    const addPlayerButton = document.getElementById("addPlayerButton");
    const importButton = document.getElementById("importButton");
    const importFile = document.getElementById("importFile");
    const undoButton = document.getElementById("undoButton");
    if (addPlayerButton) addPlayerButton.hidden = !isAdmin;
    if (importButton) importButton.hidden = !isAdmin;
    if (importFile) importFile.disabled = !isAdmin;
    if (undoButton) undoButton.hidden = !isAdmin;

    const playerActionHeader = document.querySelector("#players thead th:last-child");
    if (playerActionHeader) playerActionHeader.hidden = !isAdmin;
    playersTable.querySelectorAll("tr").forEach(row => {
      if (row.cells.length) row.cells[row.cells.length - 1].hidden = !isAdmin;
    });
    historyTable.querySelectorAll("[data-edit-game], [data-delete-game]").forEach(button => { button.hidden = !isAdmin; });
  }

  function rejectUnlessAdmin(event) {
    if (isAdmin) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    openLogin();
    return true;
  }

  loginButton.addEventListener("click", () => {
    if (isAdmin) {
      isAdmin = false;
      updateReadOnlyUI();
      toast("Admin logged out. Read-only mode enabled.");
    } else openLogin();
  });

  changePinButton.addEventListener("click", () => {
    if (isAdmin) openChangePin();
    else openLogin();
  });

  document.addEventListener("click", event => {
    const target = event.target;
    const mutating = target.closest("#addPlayerButton, #importButton, #undoButton, [data-edit-player], [data-delete-player], [data-edit-game], [data-delete-game]");
    if (mutating) rejectUnlessAdmin(event);
  }, true);

  ["gameForm", "playerForm", "gameEditForm"].forEach(id => {
    document.getElementById(id).addEventListener("submit", event => rejectUnlessAdmin(event), true);
  });
  document.getElementById("importFile").addEventListener("change", event => rejectUnlessAdmin(event), true);

  pinForm.addEventListener("submit", event => {
    event.preventDefault();
    if (isChangingPin) {
      if (pinInput.value !== currentPin()) {
        toast("Current PIN is incorrect.");
        pinInput.select();
        return;
      }
      if (newPinLabel.hidden) {
        title.textContent = "Set New Admin PIN";
        pinInput.value = "";
        newPinLabel.hidden = false;
        confirmPinLabel.hidden = false;
        newPinInput.required = true;
        confirmPinInput.required = true;
        newPinInput.focus();
        return;
      }
      const next = newPinInput.value;
      if (!/^\d{4,8}$/.test(next)) {
        toast("PIN must be 4 to 8 digits.");
        newPinInput.focus();
        return;
      }
      if (next !== confirmPinInput.value) {
        toast("New PIN entries do not match.");
        confirmPinInput.select();
        return;
      }
      localStorage.setItem(PIN_KEY, next);
      pinDialog.close();
      resetPinForm();
      toast("Admin PIN changed.");
      return;
    }

    if (pinInput.value !== currentPin()) {
      toast("Incorrect PIN.");
      pinInput.select();
      return;
    }
    isAdmin = true;
    pinDialog.close();
    resetPinForm();
    updateReadOnlyUI();
    toast("Admin mode enabled.");
  });

  function closePinDialog() {
    pinDialog.close();
    resetPinForm();
  }
  document.getElementById("cancelPinDialog").addEventListener("click", closePinDialog);
  document.getElementById("cancelPinButton").addEventListener("click", closePinDialog);

  new MutationObserver(updateReadOnlyUI).observe(playersTable, { childList: true, subtree: true });
  new MutationObserver(updateReadOnlyUI).observe(historyTable, { childList: true, subtree: true });
  updateReadOnlyUI();
})();
