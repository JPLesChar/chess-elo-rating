/* Basic PIN protection for Match entry. Not secure authentication. */
(() => {
  "use strict";

  const DEFAULT_PIN = "1234";
  const PIN_KEY = "chessClubRecordGamePin";
  const recordButton = document.querySelector('[data-section="record"]');
  const gameForm = document.getElementById("gameForm");
  const changePinButton = document.getElementById("changePinButton");
  const pinDialog = document.getElementById("pinDialog");
  const pinForm = document.getElementById("pinForm");
  const pinInput = document.getElementById("pinInput");
  const newPinInput = document.getElementById("newPinInput");
  const confirmPinInput = document.getElementById("confirmPinInput");
  const pinDialogTitle = document.getElementById("pinDialogTitle");
  const newPinLabel = document.getElementById("pinNewLabel");
  const confirmPinLabel = document.getElementById("pinConfirmLabel");
  let pinVerified = false;
  let changingPin = false;

  function getPin() {
    return localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function resetPinForm() {
    pinForm.reset();
    changingPin = false;
    newPinLabel.hidden = true;
    confirmPinLabel.hidden = true;
    newPinInput.required = false;
    confirmPinInput.required = false;
  }

  function openAccessDialog() {
    resetPinForm();
    pinDialogTitle.textContent = "Enter PIN";
    pinDialog.showModal();
    pinInput.focus();
  }

  function openChangePinDialog() {
    resetPinForm();
    changingPin = true;
    pinDialogTitle.textContent = "Change PIN";
    pinDialog.showModal();
    pinInput.focus();
  }

  function closePinDialog() {
    pinDialog.close();
    resetPinForm();
  }

  recordButton.addEventListener("click", event => {
    if (pinVerified) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openAccessDialog();
  }, true);

  pinForm.addEventListener("submit", event => {
    event.preventDefault();

    if (changingPin) {
      if (pinInput.value !== getPin()) {
        showToast("Current PIN is incorrect.");
        pinInput.select();
        return;
      }

      if (newPinLabel.hidden) {
        pinDialogTitle.textContent = "Set New PIN";
        pinInput.value = "";
        newPinLabel.hidden = false;
        confirmPinLabel.hidden = false;
        newPinInput.required = true;
        confirmPinInput.required = true;
        newPinInput.focus();
        return;
      }

      const nextPin = newPinInput.value;
      if (!/^\d{4,8}$/.test(nextPin)) {
        showToast("PIN must contain 4 to 8 digits.");
        newPinInput.focus();
        return;
      }
      if (nextPin !== confirmPinInput.value) {
        showToast("New PIN entries do not match.");
        confirmPinInput.select();
        return;
      }
      localStorage.setItem(PIN_KEY, nextPin);
      closePinDialog();
      showToast("PIN changed successfully.");
      return;
    }

    if (pinInput.value !== getPin()) {
      showToast("Incorrect PIN.");
      pinInput.select();
      return;
    }

    pinVerified = true;
    closePinDialog();
    document.querySelectorAll(".nav-button").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".section").forEach(section => section.classList.remove("active"));
    recordButton.classList.add("active");
    document.getElementById("record").classList.add("active");
  });

  gameForm.addEventListener("submit", event => {
    if (pinVerified) return;
    event.preventDefault();
    openAccessDialog();
  }, true);

  changePinButton.addEventListener("click", () => {
    if (!pinVerified) {
      openAccessDialog();
      return;
    }
    openChangePinDialog();
  });

  document.getElementById("cancelPinDialog").addEventListener("click", closePinDialog);
  document.getElementById("cancelPinButton").addEventListener("click", closePinDialog);

  pinVerified = false;
})();
