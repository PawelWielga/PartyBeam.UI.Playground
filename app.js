(() => {
  "use strict";

  const viewportPresets = {
    tv1080: { width: 1920, height: 1080, label: "TV 1920×1080" },
    tv720: { width: 1280, height: 720, label: "TV 1280×720" },
    phone: { width: 390, height: 844, label: "Phone" },
    full: { full: true, label: "Full screen" }
  };

  const playerNames = ["Paweł", "Ewelinka", "Alex", "Marta", "Kuba", "Ola", "Tomek", "Ania"];

  const state = {
    viewport: "tv1080",
    players: 6,
    uiState: "normal",
    continueEnabled: true
  };

  const elements = {
    previewStage: document.getElementById("previewStage"),
    previewViewport: document.getElementById("previewViewport"),
    previewCanvas: document.getElementById("previewCanvas"),
    viewportMeta: document.getElementById("viewportMeta"),
    playersGrid: document.getElementById("playersGrid"),
    playersSummary: document.getElementById("playersSummary"),
    continueButton: document.getElementById("continueButton"),
    stateOverlay: document.getElementById("stateOverlay"),
    stateCard: document.getElementById("stateCard"),
    devToggle: document.getElementById("devToggle"),
    devPanel: document.getElementById("devPanel"),
    devClose: document.getElementById("devClose"),
    uiState: document.getElementById("uiState"),
    continueEnabled: document.getElementById("continueEnabled"),
    downloadQrCode: document.getElementById("downloadQrCode"),
    joinQrCode: document.getElementById("joinQrCode"),
    toast: document.getElementById("playgroundToast"),
    settingsButton: document.getElementById("settingsButton"),
    manageGamesButton: document.getElementById("manageGamesButton")
  };

  let toastTimer = null;

  function getStageSpace() {
    const styles = getComputedStyle(elements.previewStage);
    const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const verticalPadding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);

    return {
      width: Math.max(1, elements.previewStage.clientWidth - horizontalPadding),
      height: Math.max(1, elements.previewStage.clientHeight - verticalPadding)
    };
  }

  function resolveDevice(logicalWidth) {
    if (state.viewport === "phone") {
      return "phone";
    }

    if (state.viewport === "tv720") {
      return "tv720";
    }

    if (state.viewport === "tv1080") {
      return "tv";
    }

    if (logicalWidth < 640) {
      return "phone";
    }

    return logicalWidth < 1500 ? "tv720" : "tv";
  }

  function applyViewport() {
    const preset = viewportPresets[state.viewport];
    const available = getStageSpace();

    let logicalWidth;
    let logicalHeight;
    let scale;

    if (preset.full) {
      logicalWidth = Math.max(280, Math.floor(available.width));
      logicalHeight = Math.max(320, Math.floor(available.height));
      scale = 1;
    } else {
      logicalWidth = preset.width;
      logicalHeight = preset.height;
      scale = Math.min(
        1,
        available.width / logicalWidth,
        available.height / logicalHeight
      );
    }

    const displayWidth = Math.max(1, Math.floor(logicalWidth * scale));
    const displayHeight = Math.max(1, Math.floor(logicalHeight * scale));

    elements.previewCanvas.style.width = logicalWidth + "px";
    elements.previewCanvas.style.height = logicalHeight + "px";
    elements.previewCanvas.style.transform = "scale(" + scale + ")";
    elements.previewCanvas.dataset.device = resolveDevice(logicalWidth);

    elements.previewViewport.style.width = displayWidth + "px";
    elements.previewViewport.style.height = displayHeight + "px";

    const percentage = Math.round(scale * 100);
    elements.viewportMeta.textContent = preset.full
      ? logicalWidth + " × " + logicalHeight + " · live"
      : logicalWidth + " × " + logicalHeight + " · " + percentage + "%";

    document.querySelectorAll("[data-viewport]").forEach((button) => {
      const active = button.dataset.viewport === state.viewport;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function createPlayerSlot(name, connected) {
    const slot = document.createElement("div");
    slot.className = "player-slot " + (connected ? "player-slot--connected" : "player-slot--waiting");

    const status = document.createElement("span");
    status.className = "player-status";
    status.setAttribute("aria-hidden", "true");

    const playerName = document.createElement("span");
    playerName.className = "player-name";
    playerName.textContent = connected ? name : "Waiting...";

    slot.append(status, playerName);
    return slot;
  }

  function renderPlayers() {
    elements.playersGrid.replaceChildren();

    for (let index = 0; index < state.players; index += 1) {
      const fallbackName = "Player " + (index + 1);
      elements.playersGrid.appendChild(
        createPlayerSlot(playerNames[index] || fallbackName, true)
      );
    }

    elements.playersGrid.appendChild(createPlayerSlot("", false));

    if (state.players === 0) {
      elements.playersSummary.textContent = "Waiting for players";
    } else if (state.players === 1) {
      elements.playersSummary.textContent = "1 connected";
    } else {
      elements.playersSummary.textContent = state.players + " connected";
    }

    document.querySelectorAll("[data-players]").forEach((button) => {
      const active = Number(button.dataset.players) === state.players;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function buildLoadingState() {
    const spinner = document.createElement("div");
    spinner.className = "loading-spinner";
    spinner.setAttribute("aria-hidden", "true");

    const heading = document.createElement("h2");
    heading.textContent = "Preparing the lobby";

    const message = document.createElement("p");
    message.textContent = "Loading the latest room state…";

    elements.stateCard.replaceChildren(spinner, heading, message);
  }

  function buildErrorState() {
    const icon = document.createElement("div");
    icon.className = "state-icon";
    icon.textContent = "!";
    icon.setAttribute("aria-hidden", "true");

    const heading = document.createElement("h2");
    heading.textContent = "Something went wrong";

    const message = document.createElement("p");
    message.textContent = "The lobby state could not be loaded. This is a simulated playground error.";

    const retry = document.createElement("button");
    retry.className = "state-retry";
    retry.type = "button";
    retry.textContent = "Retry";
    retry.addEventListener("click", () => {
      state.uiState = "normal";
      elements.uiState.value = "normal";
      renderState();
    });

    elements.stateCard.replaceChildren(icon, heading, message, retry);
  }

  function renderState() {
    const normal = state.uiState === "normal";
    elements.stateOverlay.hidden = normal;

    if (state.uiState === "loading") {
      buildLoadingState();
    } else if (state.uiState === "error") {
      buildErrorState();
    } else {
      elements.stateCard.replaceChildren();
    }

    elements.continueButton.disabled = !state.continueEnabled || !normal;
    elements.continueButton.setAttribute(
      "aria-disabled",
      String(elements.continueButton.disabled)
    );
  }

  function render() {
    renderPlayers();
    renderState();
    applyViewport();
  }

  function setDevPanel(open) {
    const focusWasInside = elements.devPanel.contains(document.activeElement);

    elements.devPanel.hidden = !open;
    elements.devToggle.setAttribute("aria-expanded", String(open));

    if (open) {
      elements.devClose.focus();
    } else if (focusWasInside) {
      elements.devToggle.focus();
    }
  }

  function showToast(message) {
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }

    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 1800);
  }

  function finderValue(row, column, originRow, originColumn) {
    const localRow = row - originRow;
    const localColumn = column - originColumn;

    if (localRow < 0 || localRow > 6 || localColumn < 0 || localColumn > 6) {
      return null;
    }

    const outer = localRow === 0 || localRow === 6 || localColumn === 0 || localColumn === 6;
    const center = localRow >= 2 && localRow <= 4 && localColumn >= 2 && localColumn <= 4;
    return outer || center;
  }

  function qrValue(row, column, seed) {
    const finders = [
      finderValue(row, column, 0, 0),
      finderValue(row, column, 0, 14),
      finderValue(row, column, 14, 0)
    ];

    for (const value of finders) {
      if (value !== null) {
        return value;
      }
    }

    if (row === 6 || column === 6) {
      return (row + column) % 2 === 0;
    }

    const hash = (row * 17 + column * 31 + row * column * 7 + seed * 11 + 13) % 19;
    return hash < 9;
  }

  function renderQrPlaceholder(target, seed) {
    const fragment = document.createDocumentFragment();

    for (let row = 0; row < 21; row += 1) {
      for (let column = 0; column < 21; column += 1) {
        const cell = document.createElement("span");
        cell.className = "qr-cell" + (qrValue(row, column, seed) ? " is-dark" : "");
        fragment.appendChild(cell);
      }
    }

    target.replaceChildren(fragment);
  }

  document.querySelectorAll("[data-viewport]").forEach((button) => {
    button.addEventListener("click", () => {
      state.viewport = button.dataset.viewport;
      applyViewport();
    });
  });

  document.querySelectorAll("[data-players]").forEach((button) => {
    button.addEventListener("click", () => {
      state.players = Number(button.dataset.players);
      renderPlayers();
    });
  });

  elements.uiState.addEventListener("change", (event) => {
    state.uiState = event.target.value;
    renderState();
  });

  elements.continueEnabled.addEventListener("change", (event) => {
    state.continueEnabled = event.target.checked;
    renderState();
  });

  elements.devToggle.addEventListener("click", () => {
    setDevPanel(elements.devPanel.hidden);
  });

  elements.devClose.addEventListener("click", () => {
    setDevPanel(false);
  });

  elements.continueButton.addEventListener("click", () => {
    showToast("Continue clicked · playground only");
  });

  elements.settingsButton.addEventListener("click", () => {
    showToast("Settings clicked · playground only");
  });

  elements.manageGamesButton.addEventListener("click", () => {
    showToast("Manage games clicked · playground only");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.devPanel.hidden) {
      setDevPanel(false);
    }
  });

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(() => applyViewport());
    resizeObserver.observe(elements.previewStage);
  } else {
    window.addEventListener("resize", applyViewport);
  }

  renderQrPlaceholder(elements.downloadQrCode, 3);
  renderQrPlaceholder(elements.joinQrCode, 7);
  render();
})();
