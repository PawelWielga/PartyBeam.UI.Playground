(() => {
  "use strict";

  const viewportPresets = {
    tv1080: { width: 1920, height: 1080, label: "TV 1920×1080" },
    tv720: { width: 1280, height: 720, label: "TV 1280×720" },
    phone: { width: 390, height: 844, label: "Phone" },
    full: { full: true, label: "Full screen" }
  };

  const playerNames = ["Paweł", "Ewelinka", "Alex", "Marta", "Kuba", "Ola", "Tomek", "Ania"];
  const placeholderGameMaxPlayers = [
    8, 4, 6, 3, 8,
    2, 6, 4, 8, 5,
    4, 8, 3, 6, 2,
    8, 4, 5, 6, 3,
    8, 2, 4, 6, 8
  ];

  const state = {
    viewport: "tv1080",
    players: 6,
    uiState: "normal",
    continueEnabled: true,
    screen: "lobby",
    settingsOpen: false,
    settingsCategory: "general"
  };

  const elements = {
    previewStage: document.getElementById("previewStage"),
    previewViewport: document.getElementById("previewViewport"),
    previewCanvas: document.getElementById("previewCanvas"),
    partybeamScreen: document.getElementById("partybeamScreen"),
    viewportMeta: document.getElementById("viewportMeta"),
    lobbyScreen: document.getElementById("lobbyScreen"),
    catalogScreen: document.getElementById("catalogScreen"),
    catalogPlayersList: document.getElementById("catalogPlayersList"),
    catalogPlayersSummary: document.getElementById("catalogPlayersSummary"),
    catalogScroll: document.getElementById("catalogScroll"),
    gameCoverGrid: document.getElementById("gameCoverGrid"),
    footer: document.querySelector(".partybeam-footer"),
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
    settingsOverlay: document.getElementById("settingsOverlay"),
    settingsPanel: document.getElementById("settingsPanel"),
    settingsContent: document.getElementById("settingsContent"),
    settingsCloseButton: document.getElementById("settingsCloseButton"),
    settingsDoneButton: document.getElementById("settingsDoneButton"),
    masterVolume: document.getElementById("masterVolume"),
    masterVolumeValue: document.getElementById("masterVolumeValue"),
    manageGamesButton: document.getElementById("manageGamesButton")
  };

  let toastTimer = null;
  let remoteFocusTarget = null;
  let browserFocusInsideScreen = false;

  const REMOTE_FOCUS_BASE_CYCLE_MS = 1800;
  const REMOTE_FOCUS_PEAK_ANGLE_DEG = 294;
  const REMOTE_FOCUS_EDGE_BLEND = 0.22;
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let remoteFocusAnimationAngleDeg = 0;
  let remoteFocusAnimationLastFrameAt = null;
  let remoteFocusAnimationFrame = null;
  let remoteFocusGeometry = null;
  let settingsOpenedWithBrowserFocus = false;

  function normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
  }

  function getRemoteFocusGeometry(element) {
    const styles = getComputedStyle(element);
    const ringStyles = getComputedStyle(element, "::after");
    const ringInset = parseFloat(styles.getPropertyValue("--remote-focus-ring-inset")) || 0;
    const ringThickness = parseFloat(styles.getPropertyValue("--remote-focus-ring-thickness")) || 0;
    const centerlineOffset = Math.max(0, ringInset - ringThickness / 2);
    const width = element.offsetWidth + centerlineOffset * 2;
    const height = element.offsetHeight + centerlineOffset * 2;
    const outerRadius = parseFloat(ringStyles.borderTopLeftRadius) || 0;
    const radius = Math.min(
      Math.max(0, outerRadius - ringThickness / 2),
      width / 2,
      height / 2
    );

    return { width, height, radius };
  }

  function invalidateRemoteFocusGeometry() {
    remoteFocusGeometry = null;
    remoteFocusAnimationAngleDeg = 0;
    remoteFocusAnimationLastFrameAt = null;
  }

  function smoothstep01(value) {
    const clamped = Math.min(1, Math.max(0, value));
    return clamped * clamped * (3 - 2 * clamped);
  }

  function getRemoteFocusEdgeSpeedMultiplier(width, height, angleDeg) {
    const halfWidth = Math.max(width / 2, Number.EPSILON);
    const halfHeight = Math.max(height / 2, Number.EPSILON);
    const angle = normalizeDegrees(angleDeg) * Math.PI / 180;

    // A conic gradient turns at a constant angular rate, which makes the
    // highlight race across the short edges of a wide button. Keep the
    // original pace on the long edges and slow only the short ones.
    const verticalEdgeMetric = Math.abs(Math.sin(angle)) / halfWidth;
    const horizontalEdgeMetric = Math.abs(Math.cos(angle)) / halfHeight;
    const dominance = (verticalEdgeMetric - horizontalEdgeMetric)
      / Math.max(verticalEdgeMetric + horizontalEdgeMetric, Number.EPSILON);
    const verticalBlend = smoothstep01(
      (dominance + REMOTE_FOCUS_EDGE_BLEND) / (2 * REMOTE_FOCUS_EDGE_BLEND)
    );

    const horizontalMultiplier = width >= height ? 1 : width / height;
    const verticalMultiplier = height >= width ? 1 : height / width;

    return horizontalMultiplier
      + (verticalMultiplier - horizontalMultiplier) * verticalBlend;
  }

  function getAnimatedRemoteFocusTarget() {
    if (
      reducedMotionQuery.matches
      || elements.partybeamScreen.classList.contains("settings-reduced-motion")
      || browserFocusInsideScreen
    ) {
      return null;
    }

    if (!remoteFocusTarget || !remoteFocusTarget.classList.contains("remote-focused")) {
      return null;
    }

    return remoteFocusTarget;
  }

  function stopRemoteFocusAnimation() {
    if (remoteFocusAnimationFrame !== null) {
      window.cancelAnimationFrame(remoteFocusAnimationFrame);
      remoteFocusAnimationFrame = null;
    }
    remoteFocusAnimationAngleDeg = 0;
    remoteFocusAnimationLastFrameAt = null;
    remoteFocusGeometry = null;
  }

  function animateRemoteFocus(timestamp) {
    remoteFocusAnimationFrame = null;

    const activeTarget = getAnimatedRemoteFocusTarget();
    if (!activeTarget) {
      remoteFocusAnimationLastFrameAt = null;
      return;
    }

    const { width, height } = remoteFocusGeometry
      || (remoteFocusGeometry = getRemoteFocusGeometry(activeTarget));
    if (width <= 0 || height <= 0) {
      remoteFocusAnimationLastFrameAt = null;
      return;
    }

    if (remoteFocusAnimationLastFrameAt === null) {
      remoteFocusAnimationLastFrameAt = timestamp;
    } else {
      const deltaMs = Math.max(0, timestamp - remoteFocusAnimationLastFrameAt);
      const baseDegrees = 360 * deltaMs / REMOTE_FOCUS_BASE_CYCLE_MS;
      const speedMultiplier = getRemoteFocusEdgeSpeedMultiplier(
        width,
        height,
        remoteFocusAnimationAngleDeg
      );

      remoteFocusAnimationAngleDeg = normalizeDegrees(
        remoteFocusAnimationAngleDeg + baseDegrees * speedMultiplier
      );
      remoteFocusAnimationLastFrameAt = timestamp;
    }

    const gradientAngle = normalizeDegrees(
      remoteFocusAnimationAngleDeg - REMOTE_FOCUS_PEAK_ANGLE_DEG
    );

    activeTarget.style.setProperty("--remote-focus-angle", `${gradientAngle}deg`);
    remoteFocusAnimationFrame = window.requestAnimationFrame(animateRemoteFocus);
  }

  function syncRemoteFocusAnimation() {
    if (!getAnimatedRemoteFocusTarget()) {
      stopRemoteFocusAnimation();
      return;
    }

    if (remoteFocusAnimationFrame === null) {
      remoteFocusAnimationFrame = window.requestAnimationFrame(animateRemoteFocus);
    }
  }

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

    invalidateRemoteFocusGeometry();
    syncRemoteFocusAnimation();
    updateCatalogScrollEdgeFade();
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

  function getConnectedSummary() {
    if (state.players === 0) {
      return "Waiting for players";
    }

    if (state.players === 1) {
      return "1 connected";
    }

    return state.players + " connected";
  }

  function renderCatalogPlayers() {
    elements.catalogPlayersList.replaceChildren();

    for (let index = 0; index < state.players; index += 1) {
      const fallbackName = "Player " + (index + 1);
      elements.catalogPlayersList.appendChild(createPlayerSlot(playerNames[index] || fallbackName, true));
    }

    elements.catalogPlayersList.appendChild(createPlayerSlot("", false));
    elements.catalogPlayersSummary.textContent = getConnectedSummary();
  }

  function updateGameCompatibility() {
    elements.gameCoverGrid.querySelectorAll(".game-cover").forEach((cover) => {
      const maximumPlayers = Number(cover.dataset.maxPlayers);
      const incompatible = state.players > maximumPlayers;
      cover.classList.toggle("game-cover--incompatible", incompatible);

      const compatibility = cover.querySelector(".game-cover-compatibility");
      if (compatibility) {
        compatibility.hidden = !incompatible;
      }

      const number = cover.dataset.gameNumber;
      cover.setAttribute(
        "aria-label",
        incompatible
          ? "Placeholder game " + number + ". Not everyone can play. Supports up to " + maximumPlayers + " players."
          : "Placeholder game " + number + ". Compatible with the current party."
      );
    });
  }

  function renderGameCovers() {
    elements.gameCoverGrid.replaceChildren();

    placeholderGameMaxPlayers.forEach((maximumPlayers, index) => {
      const gameNumber = String(index + 1).padStart(2, "0");
      const cover = document.createElement("button");
      cover.type = "button";
      cover.className = "game-cover game-cover--variant-" + (index % 6);
      cover.dataset.maxPlayers = String(maximumPlayers);
      cover.dataset.gameNumber = gameNumber;

      const art = document.createElement("span");
      art.className = "game-cover-art";

      const number = document.createElement("span");
      number.className = "game-cover-number";
      number.textContent = gameNumber;

      const placeholder = document.createElement("span");
      placeholder.className = "game-cover-placeholder-label";
      placeholder.textContent = "PLACEHOLDER";

      const compatibility = document.createElement("span");
      compatibility.className = "game-cover-compatibility";
      compatibility.hidden = true;

      const warning = document.createElement("strong");
      warning.textContent = "⚠ NOT EVERYONE CAN PLAY";

      const detail = document.createElement("span");
      detail.textContent = "Supports up to " + maximumPlayers + " players";

      compatibility.append(warning, detail);
      art.append(number, placeholder);
      cover.append(art, compatibility);
      cover.addEventListener("click", () => {
        showToast("Game details screen · next step");
      });

      elements.gameCoverGrid.appendChild(cover);
    });

    updateGameCompatibility();
  }

  function renderPlayers() {
    elements.playersGrid.replaceChildren();
    updatePlayerGridColumns();

    for (let index = 0; index < state.players; index += 1) {
      const fallbackName = "Player " + (index + 1);
      elements.playersGrid.appendChild(createPlayerSlot(playerNames[index] || fallbackName, true));
    }

    elements.playersGrid.appendChild(createPlayerSlot("", false));
    elements.playersSummary.textContent = getConnectedSummary();
    renderCatalogPlayers();
    updateGameCompatibility();

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

    if (state.settingsOpen) {
      return getSettingsFocusableElements();
    }

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

    if (state.screen === "catalog") {
      elements.gameCoverGrid.querySelectorAll(".game-cover:not(:disabled)").forEach((cover) => {
        focusables.push(cover);
      });
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
    syncRemoteFocusAnimation();
  }

  function updateCatalogScrollEdgeFade() {
    const scroller = elements.catalogScroll;

    if (state.screen !== "catalog" || scroller.clientHeight <= 0) {
      scroller.classList.remove("is-clipped-top", "is-clipped-bottom");
      return;
    }

    const maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const scrollTop = Math.min(maxScrollTop, Math.max(0, scroller.scrollTop));
    const edgeEpsilon = 1;

    scroller.classList.toggle("is-clipped-top", scrollTop > edgeEpsilon);
    scroller.classList.toggle(
      "is-clipped-bottom",
      scrollTop < maxScrollTop - edgeEpsilon
    );
  }

  function ensureCatalogTargetVisible(element) {
    if (
      state.screen !== "catalog"
      || !element
      || !element.classList.contains("game-cover")
    ) {
      return;
    }

    const containerRect = elements.catalogScroll.getBoundingClientRect();
    const targetRect = element.getBoundingClientRect();
    const targetCenter = targetRect.top + targetRect.height / 2;
    const viewportCenter = containerRect.top + containerRect.height / 2;
    const maxScrollTop = Math.max(
      0,
      elements.catalogScroll.scrollHeight - elements.catalogScroll.clientHeight
    );
    const centeredScrollTop = elements.catalogScroll.scrollTop + targetCenter - viewportCenter;

    elements.catalogScroll.scrollTop = Math.min(
      maxScrollTop,
      Math.max(0, centeredScrollTop)
    );
    updateCatalogScrollEdgeFade();
  }

  function setRemoteFocus(element) {
    const nextTarget = element || null;

    if (remoteFocusTarget !== nextTarget) {
      if (remoteFocusTarget) {
        remoteFocusTarget.style.removeProperty("--remote-focus-angle");
      }
      invalidateRemoteFocusGeometry();
    }

    remoteFocusTarget = nextTarget;
    ensureCatalogTargetVisible(remoteFocusTarget);
    renderRemoteFocusVisual();
  }

  function ensureRemoteFocus() {
    const focusables = getTvFocusableElements();

    if (remoteFocusTarget && focusables.includes(remoteFocusTarget)) {
      setRemoteFocus(remoteFocusTarget);
      return;
    }

    const preferred = state.screen === "catalog"
      ? focusables.find((element) => element.classList.contains("game-cover"))
        || focusables.find((element) => element.classList.contains("state-retry"))
        || focusables[0]
        || null
      : focusables.find((element) => element === elements.continueButton)
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
    ensureCatalogTargetVisible(target);
  }

  function activateRemoteFocus() {
    ensureRemoteFocus();

    if (remoteFocusTarget && !remoteFocusTarget.disabled) {
      remoteFocusTarget.click();
    }
  }

  function handleRemoteCommand(command) {
    if (state.settingsOpen) {
      if (command === "back") {
        closeSettings();
        return;
      }

      if (command === "home") {
        const firstCategory = elements.settingsOverlay.querySelector("[data-settings-category]");
        setRemoteFocus(firstCategory || elements.settingsCloseButton);
        return;
      }

      if (
        remoteFocusTarget === elements.masterVolume
        && (command === "left" || command === "right")
      ) {
        const delta = command === "left" ? -5 : 5;
        updateMasterVolume(Number(elements.masterVolume.value) + delta);
        return;
      }
    }

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
      const homeTarget = state.screen === "catalog"
        ? focusables.find((element) => element.classList.contains("game-cover")) || focusables[0] || null
        : focusables.find((element) => element === elements.continueButton)
          || focusables.find((element) => element.classList.contains("state-retry"))
          || focusables[0]
          || null;
      setRemoteFocus(homeTarget);
      showToast("Home pressed · playground only");
      return;
    }

    if (command === "back") {
      if (state.screen === "catalog") {
        showLobby();
        return;
      }

      showToast("Back pressed · playground only");
    }
  }

  function releaseBrowserFocusForScreenTransition() {
    const activeElement = document.activeElement;

    if (activeElement && elements.partybeamScreen.contains(activeElement)) {
      activeElement.blur();
    }

    browserFocusInsideScreen = false;
  }

  function getSettingsFocusableElements() {
    return Array.from(
      elements.settingsOverlay.querySelectorAll(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex=\"-1\"])"
      )
    ).filter((element) => !element.closest("[hidden]") && element.getClientRects().length > 0);
  }

  function setSettingsBackgroundInert(inert) {
    Array.from(elements.partybeamScreen.children).forEach((child) => {
      if (child !== elements.settingsOverlay) {
        child.inert = inert;
      }
    });
  }

  function selectSettingsCategory(category) {
    const requested = elements.settingsOverlay.querySelector(
      '[data-settings-category="' + category + '"]'
    );
    const selected = requested
      ? category
      : "general";

    state.settingsCategory = selected;

    elements.settingsOverlay.querySelectorAll("[data-settings-category]").forEach((button) => {
      const active = button.dataset.settingsCategory === selected;
      button.classList.toggle("is-active", active);
      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    elements.settingsOverlay.querySelectorAll("[data-settings-section]").forEach((section) => {
      section.hidden = section.dataset.settingsSection !== selected;
    });

    elements.settingsContent.scrollTop = 0;
    window.requestAnimationFrame(() => {
      invalidateRemoteFocusGeometry();
      syncRemoteFocusAnimation();
    });
  }

  function openSettings() {
    if (state.settingsOpen) {
      return;
    }

    settingsOpenedWithBrowserFocus = document.activeElement === elements.settingsButton;
    state.settingsOpen = true;
    elements.settingsOverlay.hidden = false;
    elements.settingsOverlay.setAttribute("aria-hidden", "false");
    elements.partybeamScreen.classList.add("is-settings-open");
    setSettingsBackgroundInert(true);
    selectSettingsCategory(state.settingsCategory);

    const initialTarget = elements.settingsOverlay.querySelector(
      '[data-settings-category="' + state.settingsCategory + '"]'
    ) || elements.settingsCloseButton;

    setRemoteFocus(initialTarget);

    if (settingsOpenedWithBrowserFocus) {
      initialTarget.focus({ preventScroll: true });
    } else {
      browserFocusInsideScreen = false;
      renderRemoteFocusVisual();
    }
  }

  function closeSettings() {
    if (!state.settingsOpen) {
      return;
    }

    state.settingsOpen = false;
    setSettingsBackgroundInert(false);
    elements.settingsOverlay.hidden = true;
    elements.settingsOverlay.setAttribute("aria-hidden", "true");
    elements.partybeamScreen.classList.remove("is-settings-open");

    setRemoteFocus(elements.settingsButton);

    if (settingsOpenedWithBrowserFocus) {
      elements.settingsButton.focus({ preventScroll: true });
    } else {
      const activeElement = document.activeElement;
      if (activeElement && elements.settingsOverlay.contains(activeElement)) {
        activeElement.blur();
      }
      browserFocusInsideScreen = false;
      renderRemoteFocusVisual();
    }

    settingsOpenedWithBrowserFocus = false;
  }

  function setToggleState(button, enabled) {
    button.classList.toggle("is-on", enabled);
    button.setAttribute("aria-checked", String(enabled));
    const stateLabel = button.querySelector(".settings-toggle-state");
    if (stateLabel) {
      stateLabel.textContent = enabled ? "On" : "Off";
    }

    if (button.dataset.settingToggle === "reduced-motion") {
      elements.partybeamScreen.classList.toggle("settings-reduced-motion", enabled);
      invalidateRemoteFocusGeometry();
      renderRemoteFocusVisual();
    }
  }

  function updateMasterVolume(value) {
    const numericValue = Math.max(0, Math.min(100, Number(value)));
    elements.masterVolume.value = String(numericValue);
    elements.masterVolumeValue.value = numericValue + "%";
    elements.masterVolume.setAttribute("aria-valuetext", numericValue + " percent");
  }

  function showCatalog() {
    releaseBrowserFocusForScreenTransition();

    state.screen = "catalog";
    elements.lobbyScreen.hidden = true;
    elements.catalogScreen.hidden = false;
    elements.footer.hidden = true;
    elements.partybeamScreen.classList.add("is-catalog");
    elements.partybeamScreen.setAttribute("aria-label", "PartyBeam game catalog");
    elements.catalogScroll.scrollTop = 0;

    const firstCover = elements.gameCoverGrid.querySelector(".game-cover");
    setRemoteFocus(firstCover);
    updateCatalogScrollEdgeFade();
  }

  function showLobby() {
    releaseBrowserFocusForScreenTransition();

    state.screen = "lobby";
    elements.catalogScreen.hidden = true;
    elements.lobbyScreen.hidden = false;
    elements.footer.hidden = false;
    elements.partybeamScreen.classList.remove("is-catalog");
    elements.partybeamScreen.setAttribute("aria-label", "PartyBeam lobby screen");

    setRemoteFocus(elements.continueButton);
  }

  function render() {
    renderGameCovers();
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
    showCatalog();
  });

  elements.settingsButton.addEventListener("click", openSettings);

  elements.settingsCloseButton.addEventListener("click", closeSettings);
  elements.settingsDoneButton.addEventListener("click", closeSettings);

  elements.settingsOverlay.querySelectorAll("[data-settings-category]").forEach((button) => {
    button.addEventListener("click", () => {
      selectSettingsCategory(button.dataset.settingsCategory);
    });
  });

  elements.settingsOverlay.querySelectorAll("[data-setting-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      setToggleState(button, button.getAttribute("aria-checked") !== "true");
    });
  });

  elements.settingsOverlay.querySelectorAll("[data-setting-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const setting = button.dataset.settingChoice;
      elements.settingsOverlay.querySelectorAll(
        '[data-setting-choice="' + setting + '"]'
      ).forEach((choice) => {
        const selected = choice === button;
        choice.classList.toggle("is-selected", selected);
        choice.setAttribute("aria-pressed", String(selected));
      });
    });
  });

  elements.masterVolume.addEventListener("input", () => {
    updateMasterVolume(elements.masterVolume.value);
  });

  elements.manageGamesButton.addEventListener("click", () => {
    showToast("Manage games clicked · playground only");
  });

  elements.catalogScroll.addEventListener("scroll", updateCatalogScrollEdgeFade, {
    passive: true
  });

  document.addEventListener("focusin", (event) => {
    if (!state.settingsOpen || elements.settingsOverlay.contains(event.target)) {
      return;
    }

    const fallback = getSettingsFocusableElements()[0];
    if (fallback) {
      fallback.focus({ preventScroll: true });
    }
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
      if (state.settingsOpen) {
        event.preventDefault();
        closeSettings();
        return;
      }

      if (!elements.devPanel.hidden) {
        setDevPanel(false);
        return;
      }

      if (!elements.remotePanel.hidden) {
        setRemotePanel(false);
        return;
      }
    }

    if (state.settingsOpen && event.key === "Tab") {
      const focusables = getSettingsFocusableElements();
      if (focusables.length > 0) {
        event.preventDefault();
        const activeIndex = focusables.indexOf(document.activeElement);
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = activeIndex < 0
          ? 0
          : (activeIndex + direction + focusables.length) % focusables.length;
        const target = focusables[nextIndex];
        setRemoteFocus(target);
        target.focus({ preventScroll: true });
      }
      return;
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
        return;
      }

      if (command === "back" && state.settingsOpen) {
        event.preventDefault();
        closeSettings();
        return;
      }

      if (command === "back" && state.screen === "catalog") {
        event.preventDefault();
        showLobby();
      }
      return;
    }

    if (neutralFocus) {
      event.preventDefault();
      handleRemoteCommand(command);
    }
  });

  const handleReducedMotionChange = () => {
    renderRemoteFocusVisual();
  };

  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
  } else if (typeof reducedMotionQuery.addListener === "function") {
    reducedMotionQuery.addListener(handleReducedMotionChange);
  }

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(() => applyViewport());
    resizeObserver.observe(elements.previewStage);
  } else {
    window.addEventListener("resize", applyViewport);
  }

  renderQrPlaceholder(elements.downloadQrCode, 3);
  renderQrPlaceholder(elements.joinQrCode, 7);
  updateMasterVolume(elements.masterVolume.value);
  render();
})();
