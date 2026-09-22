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
    partybeamScreen: document.getElementById("partybeamScreen"),
    viewportMeta: document.getElementById("viewportMeta"),
    playersGrid: document.getElementById("playersGrid"),
    playersSummary: document.getElementById("playersSummary"),
    continueButton: document.getElementById("continueButton"),
    stateOverlay: document.getElementById("stateOverlay"),
    stateCard: document.getElementById("stateCard"),
    devToggle: document.getElementById("devToggle"),
    devPanel: document.getElementById("devPanel"),
    devClose: document.getElementById("devClose"),
    remoteToggle: document.getElementById("remoteToggle"),
    remotePanel: document.getElementById("remotePanel"),
    remoteClose: document.getElementById("remoteClose"),
    remoteFocusLabel: document.getElementById("remoteFocusLabel"),
    uiState: document.getElementById("uiState"),
    continueEnabled: document.getElementById("continueEnabled"),
    downloadQrCode: document.getElementById("downloadQrCode"),
    joinQrCode: document.getElementById("joinQrCode"),
    toast: document.getElementById("playgroundToast"),
    settingsButton: document.getElementById("settingsButton"),
    manageGamesButton: document.getElementById("manageGamesButton")
  };

  let toastTimer = null;
  let remoteFocusTarget = null;
  let browserFocusInsideScreen = false;

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
      scale = Math.min(1, available.width / logicalWidth, available.height / logicalHeight);
    }

    const displayWidth = Math.max(1, Math.floor(logicalWidth * scale));
    const displayHeight = Math.max(1, Math.floor(logicalHeight * scale));

    elements.previewCanvas.style.width = logicalWidth + "px";
    elements.previewCanvas.style.height = logicalHeight + "px";
    elements.previewCanvas.style.transform = "scale(" + scale + ")";
    elements.previewCanvas.dataset.device = resolveDevice(logicalWidth);
    updatePlayerGridColumns();

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

  function updatePlayerGridColumns() {
    const totalSlots = state.players + 1;
    const minimumColumns = elements.previewCanvas.dataset.device === "phone" ? 2 : 4;
    const columns = Math.max(minimumColumns, Math.ceil(totalSlots / 2));

    elements.playersGrid.style.setProperty("--player-columns", String(columns));
  }

  function renderPlayers() {
    elements.playersGrid.replaceChildren();
    updatePlayerGridColumns();

    for (let index = 0; index < state.players; index += 1) {
      const fallbackName = "Player " + (index + 1);
      elements.playersGrid.appendChild(createPlayerSlot(playerNames[index] || fallbackName, true));
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
    elements.continueButton.setAttribute("aria-disabled", String(elements.continueButton.disabled));
    window.requestAnimationFrame(ensureRemoteFocus);
  }

  function getTvFocusableElements() {
    const focusables = [];

    if (!elements.settingsButton.disabled) {
      focusables.push(elements.settingsButton);
    }

    if (!elements.stateOverlay.hidden) {
      const retryButton = elements.stateCard.querySelector(".state-retry:not(:disabled)");
      if (retryButton) {
        focusables.push(retryButton);
      }
      return focusables;
    }

    [elements.continueButton, elements.manageGamesButton].forEach((element) => {
      if (element && !element.disabled) {
        focusables.push(element);
      }
    });

    return focusables;
  }

  function getRemoteLabel(element) {
    if (!element) {
      return "None";
    }

    const label = element.getAttribute("aria-label") || element.textContent || element.id;
    return label.replace(/\s+/g, " ").trim();
  }

  function renderRemoteFocusVisual() {
    document.querySelectorAll(".remote-focused").forEach((focused) => {
      focused.classList.remove("remote-focused");
    });

    if (remoteFocusTarget && !browserFocusInsideScreen) {
      remoteFocusTarget.classList.add("remote-focused");
    }

    elements.remoteFocusLabel.textContent = getRemoteLabel(remoteFocusTarget);
  }

  function setRemoteFocus(element) {
    remoteFocusTarget = element || null;
    renderRemoteFocusVisual();
  }

  function ensureRemoteFocus() {
    const focusables = getTvFocusableElements();

    if (remoteFocusTarget && focusables.includes(remoteFocusTarget)) {
      setRemoteFocus(remoteFocusTarget);
      return;
    }

    const preferred = focusables.find((element) => element === elements.continueButton)
      || focusables.find((element) => element.classList.contains("state-retry"))
      || focusables[0]
      || null;

    setRemoteFocus(preferred);
  }

  function getCenter(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function getDirectionalTarget(origin, direction) {
    const focusables = getTvFocusableElements();

    if (!origin || !focusables.includes(origin)) {
      return null;
    }

    const current = getCenter(origin);
    const candidates = focusables
      .filter((element) => element !== origin)
      .map((element) => {
        const center = getCenter(element);
        const dx = center.x - current.x;
        const dy = center.y - current.y;

        let primary;
        let secondary;
        let valid = false;

        if (direction === "up") {
          valid = dy < -1;
          primary = -dy;
          secondary = Math.abs(dx);
        } else if (direction === "down") {
          valid = dy > 1;
          primary = dy;
          secondary = Math.abs(dx);
        } else if (direction === "left") {
          valid = dx < -1;
          primary = -dx;
          secondary = Math.abs(dy);
        } else {
          valid = dx > 1;
          primary = dx;
          secondary = Math.abs(dy);
        }

        return {
          element,
          valid,
          score: primary + secondary * 2.25
        };
      })
      .filter((candidate) => candidate.valid)
      .sort((a, b) => a.score - b.score);

    return candidates.length > 0 ? candidates[0].element : null;
  }

  function moveRemoteFocus(direction) {
    const focusables = getTvFocusableElements();

    if (focusables.length === 0) {
      setRemoteFocus(null);
      return;
    }

    if (!remoteFocusTarget || !focusables.includes(remoteFocusTarget)) {
      ensureRemoteFocus();
      return;
    }

    const target = getDirectionalTarget(remoteFocusTarget, direction);
    if (target) {
      setRemoteFocus(target);
    }
  }

  function moveBrowserFocus(direction) {
    const activeElement = document.activeElement;
    const focusables = getTvFocusableElements();

    if (!focusables.includes(activeElement)) {
      return;
    }

    const target = getDirectionalTarget(activeElement, direction);
    if (!target) {
      return;
    }

    setRemoteFocus(target);
    target.focus({ preventScroll: true });
  }

  function activateRemoteFocus() {
    ensureRemoteFocus();

    if (remoteFocusTarget && !remoteFocusTarget.disabled) {
      remoteFocusTarget.click();
    }
  }

  function handleRemoteCommand(command) {
    if (["up", "down", "left", "right"].includes(command)) {
      moveRemoteFocus(command);
      return;
    }

    if (command === "ok") {
      activateRemoteFocus();
      return;
    }

    if (command === "home") {
      const focusables = getTvFocusableElements();
      const homeTarget = focusables.find((element) => element === elements.continueButton)
        || focusables.find((element) => element.classList.contains("state-retry"))
        || focusables[0]
        || null;
      setRemoteFocus(homeTarget);
      showToast("Home pressed · playground only");
      return;
    }

    if (command === "back") {
      showToast("Back pressed · playground only");
    }
  }

  function render() {
    renderPlayers();
    renderState();
    applyViewport();
    ensureRemoteFocus();
  }

  function setDevPanel(open) {
    const focusWasInside = elements.devPanel.contains(document.activeElement);

    if (open) {
      setRemotePanel(false);
    }

    elements.devPanel.hidden = !open;
    elements.devToggle.setAttribute("aria-expanded", String(open));

    if (open) {
      elements.devClose.focus();
    } else if (focusWasInside) {
      elements.devToggle.focus();
    }
  }

  function setRemotePanel(open) {
    const focusWasInside = elements.remotePanel.contains(document.activeElement);

    if (open) {
      elements.devPanel.hidden = true;
      elements.devToggle.setAttribute("aria-expanded", "false");
    }

    elements.remotePanel.hidden = !open;
    elements.remoteToggle.setAttribute("aria-expanded", String(open));

    if (open) {
      ensureRemoteFocus();
      if (document.activeElement === elements.remoteToggle) {
        elements.remoteToggle.blur();
      }
    } else if (focusWasInside) {
      elements.remoteToggle.focus();
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
    const svgNamespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNamespace, "svg");
    svg.setAttribute("viewBox", "0 0 21 21");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("shape-rendering", "crispEdges");

    const background = document.createElementNS(svgNamespace, "rect");
    background.setAttribute("width", "21");
    background.setAttribute("height", "21");
    background.setAttribute("fill", "#fff");

    const path = document.createElementNS(svgNamespace, "path");
    const modules = [];

    for (let row = 0; row < 21; row += 1) {
      for (let column = 0; column < 21; column += 1) {
        if (qrValue(row, column, seed)) {
          modules.push("M" + column + " " + row + "h1v1h-1z");
        }
      }
    }

    path.setAttribute("d", modules.join(""));
    path.setAttribute("fill", "#090b0e");
    svg.append(background, path);
    target.replaceChildren(svg);
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

  elements.remoteToggle.addEventListener("click", () => {
    setRemotePanel(elements.remotePanel.hidden);
  });

  elements.remoteClose.addEventListener("click", () => {
    setRemotePanel(false);
  });

  document.querySelectorAll("[data-remote-key]").forEach((button) => {
    button.addEventListener("click", () => {
      handleRemoteCommand(button.dataset.remoteKey);
      button.blur();
    });
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

  elements.partybeamScreen.addEventListener("focusin", (event) => {
    const focusables = getTvFocusableElements();

    if (!focusables.includes(event.target)) {
      return;
    }

    browserFocusInsideScreen = true;
    setRemoteFocus(event.target);
  });

  elements.partybeamScreen.addEventListener("focusout", () => {
    window.setTimeout(() => {
      browserFocusInsideScreen = elements.partybeamScreen.contains(document.activeElement);
      renderRemoteFocusVisual();
    }, 0);
  });

  document.addEventListener("keydown", (event) => {
    const tagName = document.activeElement && document.activeElement.tagName;
    const typing = tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA";

    if (event.key === "Escape") {
      if (!elements.devPanel.hidden) {
        setDevPanel(false);
        return;
      }

      if (!elements.remotePanel.hidden) {
        setRemotePanel(false);
        return;
      }
    }

    if (typing) {
      return;
    }

    const activeElement = document.activeElement;
    const screenHasFocus = activeElement && elements.partybeamScreen.contains(activeElement);
    const neutralFocus = !activeElement || activeElement === document.body;

    const commandByKey = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      Enter: "ok",
      Backspace: "back",
      Home: "home"
    };

    const command = commandByKey[event.key];
    if (!command) {
      return;
    }

    if (screenHasFocus) {
      if (["up", "down", "left", "right"].includes(command)) {
        event.preventDefault();
        moveBrowserFocus(command);
      }
      return;
    }

    if (neutralFocus) {
      event.preventDefault();
      handleRemoteCommand(command);
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
