(() => {
  "use strict";

  const viewportPresets = {
    tv4k: { width: 3840, height: 2160, label: "TV 3840×2160" },
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

  const realGameCovers = [
    { title: "Grimcellar", image: "assets/covers/grimcellar.png" },
    { title: "Reflex", image: "assets/covers/reflex.png" },
    { title: "Quiz Blast", image: "assets/covers/quizblast.png" },
    { title: "Kingdom Run", image: "assets/covers/kingdomrun.png" },
    { title: "Turbo Orbit", image: "assets/covers/turboorbit.png" },
    { title: "Midnight Files", image: "assets/covers/midnight.png" },
    { title: "Panic Kitchen", image: "assets/covers/panickitchen.png" }
  ];
  const favoriteGameNumbers = new Set(["01", "03", "06", "08", "12", "17", "23"]);
  const downloadedGameNumbers = new Set(["01", "02", "04", "07", "10", "14", "18", "21", "25"]);
  const prereleaseGameNumbers = new Set(["06", "07"]);

  const state = {
    viewport: "tv1080",
    previousViewport: "tv1080",
    players: 6,
    uiState: "normal",
    continueEnabled: true,
    screen: "lobby",
    settingsOpen: false,
    settingsCategory: "general",
    gameDetailsOpen: false,
    gamePreparationState: "not-downloaded",
    gameDownloadProgress: 0,
    catalogFilters: {
      favorites: false,
      downloaded: false,
      compatible: false
    },
    catalogSearch: "",
    catalogSearchEditing: false,
    showPrereleaseGames: false
  };

  const elements = {
    playgroundShell: document.querySelector(".playground-shell"),
    previewStage: document.getElementById("previewStage"),
    previewViewport: document.getElementById("previewViewport"),
    previewCanvas: document.getElementById("previewCanvas"),
    partybeamScreen: document.getElementById("partybeamScreen"),
    viewportMeta: document.getElementById("viewportMeta"),
    lobbyScreen: document.getElementById("lobbyScreen"),
    catalogScreen: document.getElementById("catalogScreen"),
    gameLaunchScreen: document.getElementById("gameLaunchScreen"),
    catalogPlayersList: document.getElementById("catalogPlayersList"),
    catalogPlayersSummary: document.getElementById("catalogPlayersSummary"),
    catalogScroll: document.getElementById("catalogScroll"),
    gameCoverGrid: document.getElementById("gameCoverGrid"),
    catalogFilterButtons: Array.from(document.querySelectorAll("[data-catalog-filter]")),
    catalogSearchInput: document.getElementById("catalogSearchInput"),
    catalogEmptyState: document.getElementById("catalogEmptyState"),
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
    gameDetailsOverlay: document.getElementById("gameDetailsOverlay"),
    gameDetailsPanel: document.getElementById("gameDetailsPanel"),
    gameDetailsCloseButton: document.getElementById("gameDetailsCloseButton"),
    gameDetailsTitle: document.getElementById("gameDetailsTitle"),
    gameDetailsPlayers: document.getElementById("gameDetailsPlayers"),
    gameDetailsCover: document.querySelector(".game-details-cover"),
    gameDetailsCoverNumber: document.getElementById("gameDetailsCoverNumber"),
    gameDetailsCoverTitle: document.getElementById("gameDetailsCoverTitle"),
    gameDetailsActionButton: document.getElementById("gameDetailsActionButton"),
    gameDownloadProgress: document.getElementById("gameDownloadProgress"),
    gameDownloadProgressTrack: document.getElementById("gameDownloadProgressTrack"),
    gameDownloadProgressFill: document.getElementById("gameDownloadProgressFill"),
    gameDownloadPercent: document.getElementById("gameDownloadPercent"),
    gameDownloadSize: document.getElementById("gameDownloadSize"),
    gameDownloadError: document.getElementById("gameDownloadError"),
    gamePreparationState: document.getElementById("gamePreparationState"),
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
  let remoteFocusAnimationTarget = null;
  let settingsOpenedWithBrowserFocus = false;
  let gameDetailsOpenedWithBrowserFocus = false;
  let gameDetailsOrigin = null;
  let gameDownloadTimer = null;
  let gameLaunchTimer = null;

  const GAME_LAUNCH_MOCK_DURATION_MS = 5000;

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

  function getSimplifiedFlowFocusTarget() {
    const flowOverlay = document.getElementById("pbSimpleFlow");
    const activeElement = document.activeElement;

    if (
      !flowOverlay
      || flowOverlay.hidden
      || flowOverlay.getAttribute("aria-hidden") === "true"
      || !activeElement
      || !flowOverlay.contains(activeElement)
      || !activeElement.matches('button:not([disabled]), input:not([disabled]), select:not([disabled]), [role="button"]:not([aria-disabled="true"])')
    ) {
      return null;
    }

    return activeElement;
  }

  function getRemoteFocusLogicalTarget() {
    return getSimplifiedFlowFocusTarget() || remoteFocusTarget;
  }

  function getRemoteFocusVisualTarget() {
    const logicalTarget = getRemoteFocusLogicalTarget();
    if (logicalTarget === elements.catalogSearchInput) {
      return logicalTarget.closest(".catalog-search") || logicalTarget;
    }

    return logicalTarget;
  }

  function getAnimatedRemoteFocusTarget() {
    if (
      reducedMotionQuery.matches
      || elements.partybeamScreen.classList.contains("settings-reduced-motion")
    ) {
      return null;
    }

    const visualTarget = getRemoteFocusVisualTarget();
    if (!visualTarget || !visualTarget.classList.contains("remote-focused")) {
      return null;
    }

    return visualTarget;
  }

  function stopRemoteFocusAnimation() {
    if (remoteFocusAnimationFrame !== null) {
      window.cancelAnimationFrame(remoteFocusAnimationFrame);
      remoteFocusAnimationFrame = null;
    }
    if (remoteFocusAnimationTarget) {
      remoteFocusAnimationTarget.style.removeProperty("--remote-focus-angle");
    }
    remoteFocusAnimationTarget = null;
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

    if (remoteFocusAnimationTarget !== activeTarget) {
      if (remoteFocusAnimationTarget) {
        remoteFocusAnimationTarget.style.removeProperty("--remote-focus-angle");
      }
      remoteFocusAnimationTarget = activeTarget;
      invalidateRemoteFocusGeometry();
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
    elements.playgroundShell.classList.toggle("is-full-preview", Boolean(preset.full));
    const available = getStageSpace();

    let logicalWidth;
    let logicalHeight;
    let scale;

    const logicalPreset = preset.full
      ? viewportPresets[state.previousViewport] || viewportPresets.tv1080
      : preset;

    logicalWidth = logicalPreset.width;
    logicalHeight = logicalPreset.height;
    scale = Math.min(1, available.width / logicalWidth, available.height / logicalHeight);

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
    elements.viewportMeta.textContent = logicalWidth + " × " + logicalHeight + " · " + percentage + "%";

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

  function isGameCompatible(cover) {
    return state.players <= Number(cover.dataset.maxPlayers);
  }

  function matchesCatalogFilters(cover) {
    const searchQuery = state.catalogSearch.trim().toLocaleLowerCase();
    const gameTitle = (cover.dataset.gameTitle || "").toLocaleLowerCase();

    if (searchQuery && !gameTitle.includes(searchQuery)) {
      return false;
    }

    if (cover.dataset.prerelease === "true" && !state.showPrereleaseGames) {
      return false;
    }

    if (state.catalogFilters.favorites && cover.dataset.favorite !== "true") {
      return false;
    }

    if (state.catalogFilters.downloaded && cover.dataset.downloaded !== "true") {
      return false;
    }

    if (state.catalogFilters.compatible && !isGameCompatible(cover)) {
      return false;
    }

    return true;
  }

  function syncCatalogFilterButtons() {
    elements.catalogFilterButtons.forEach((button) => {
      const filterName = button.dataset.catalogFilter;
      const active = Boolean(state.catalogFilters[filterName]);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function applyCatalogFilters() {
    const covers = Array.from(elements.gameCoverGrid.querySelectorAll(".game-cover"));

    covers.forEach((cover) => {
      cover.hidden = !matchesCatalogFilters(cover);
    });

    const visibleCovers = covers.filter((cover) => !cover.hidden);
    elements.catalogEmptyState.hidden = visibleCovers.length > 0;
    const activeElement = document.activeElement;
    const remoteCoverWasHidden = remoteFocusTarget
      && remoteFocusTarget.classList.contains("game-cover")
      && remoteFocusTarget.hidden;
    const browserCoverWasHidden = activeElement
      && activeElement.classList
      && activeElement.classList.contains("game-cover")
      && activeElement.hidden;

    if (remoteCoverWasHidden || browserCoverWasHidden) {
      const fallback = visibleCovers[0]
        || elements.catalogSearchInput
        || elements.catalogFilterButtons.find((button) => button.classList.contains("is-active"))
        || elements.catalogFilterButtons[0]
        || elements.settingsButton;

      setRemoteFocus(fallback);

      if (browserCoverWasHidden && fallback) {
        fallback.focus({ preventScroll: true });
      }
    }

    window.requestAnimationFrame(() => {
      updateCatalogScrollEdgeFade();
      ensureCatalogTargetVisible(remoteFocusTarget);
    });
  }

  function toggleCatalogFilter(filterName) {
    if (!Object.prototype.hasOwnProperty.call(state.catalogFilters, filterName)) {
      return;
    }

    state.catalogFilters[filterName] = !state.catalogFilters[filterName];
    syncCatalogFilterButtons();
    applyCatalogFilters();
  }

  function updateGameCompatibility() {
    elements.gameCoverGrid.querySelectorAll(".game-cover").forEach((cover) => {
      const maximumPlayers = Number(cover.dataset.maxPlayers);
      const incompatible = !isGameCompatible(cover);
      cover.classList.toggle("game-cover--incompatible", incompatible);

      const compatibility = cover.querySelector(".game-cover-compatibility");
      if (compatibility) {
        compatibility.hidden = !incompatible;
      }

      const number = cover.dataset.gameNumber;
      const title = cover.dataset.gameTitle || ("Placeholder Game " + number);
      const prereleaseLabel = cover.dataset.prerelease === "true" ? " Pre-release build." : "";
      cover.setAttribute(
        "aria-label",
        incompatible
          ? title + "." + prereleaseLabel + " Not everyone can play. Supports up to " + maximumPlayers + " players."
          : title + "." + prereleaseLabel + " Compatible with the current party."
      );
    });

    applyCatalogFilters();
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
      cover.dataset.favorite = String(favoriteGameNumbers.has(gameNumber));
      cover.dataset.downloaded = String(downloadedGameNumbers.has(gameNumber));
      cover.dataset.prerelease = String(prereleaseGameNumbers.has(gameNumber));

      const realGame = realGameCovers[index] || null;
      cover.dataset.gameTitle = realGame ? realGame.title : "Placeholder Game " + gameNumber;

      if (realGame) {
        cover.classList.add("game-cover--image");
        cover.dataset.coverImage = realGame.image;
      }

      const art = document.createElement("span");
      art.className = "game-cover-art";

      const number = document.createElement("span");
      number.className = "game-cover-number";
      number.textContent = gameNumber;

      const placeholder = document.createElement("span");
      placeholder.className = "game-cover-placeholder-label";
      placeholder.textContent = "PLACEHOLDER";

      if (cover.dataset.coverImage) {
        const image = document.createElement("img");
        image.className = "game-cover-image";
        image.src = cover.dataset.coverImage;
        image.alt = "";
        image.decoding = "async";
        art.appendChild(image);
      } else {
        art.append(number, placeholder);
      }

      const compatibility = document.createElement("span");
      compatibility.className = "game-cover-compatibility";
      compatibility.hidden = true;

      const warning = document.createElement("strong");
      warning.innerHTML = `
        <svg class="game-cover-compatibility__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3 22 20H2L12 3Z"></path>
          <path d="M12 9v5"></path>
          <path d="M12 17.5h.01"></path>
        </svg>
        <span>NOT EVERYONE CAN PLAY</span>
      `;

      const detail = document.createElement("span");
      detail.textContent = "Supports up to " + maximumPlayers + " players";

      compatibility.append(warning, detail);

      if (cover.dataset.prerelease === "true") {
        const prereleaseBadge = document.createElement("span");
        prereleaseBadge.className = "game-cover-prerelease";
        prereleaseBadge.textContent = "PRE-RELEASE";
        prereleaseBadge.setAttribute("aria-hidden", "true");
        cover.append(art, prereleaseBadge, compatibility);
      } else {
        cover.append(art, compatibility);
      }
      cover.addEventListener("click", () => {
        openGameDetails(cover);
      });

      elements.gameCoverGrid.appendChild(cover);
    });

    syncCatalogFilterButtons();
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

    if (state.screen === "game-loading") {
      return focusables;
    }

    if (state.gameDetailsOpen) {
      return getGameDetailsFocusableElements();
    }

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
      elements.catalogFilterButtons.forEach((button) => {
        if (!button.disabled) {
          focusables.push(button);
        }
      });
      if (elements.catalogSearchInput && !elements.catalogSearchInput.disabled) {
        focusables.push(elements.catalogSearchInput);
      }
      elements.gameCoverGrid.querySelectorAll(".game-cover:not(:disabled):not([hidden])").forEach((cover) => {
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
    const logicalTarget = getRemoteFocusLogicalTarget();
    const visualTarget = getRemoteFocusVisualTarget();

    document.querySelectorAll(".remote-focused").forEach((focused) => {
      focused.classList.remove("remote-focused");
    });

    if (visualTarget) {
      visualTarget.classList.add("remote-focused");
    }

    elements.remoteFocusLabel.textContent = getRemoteLabel(logicalTarget);
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

  function getDirectionalTarget(origin, direction) {
    const focusables = getTvFocusableElements();
    return window.PartyBeamSpatialNavigation?.findDirectionalTarget(
      origin,
      direction,
      focusables
    ) || null;
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

  function setCatalogSearchEditing(editing, options = {}) {
    const active = Boolean(editing);
    const shouldFocus = options.focus !== false;
    const input = elements.catalogSearchInput;
    const container = input.closest(".catalog-search");

    state.catalogSearchEditing = active;
    input.readOnly = !active;
    input.setAttribute("aria-readonly", String(!active));
    input.classList.toggle("is-editing", active);
    container?.classList.toggle("is-editing", active);

    if (shouldFocus) {
      setRemoteFocus(input);
      input.focus({ preventScroll: true });
    }

    if (active) {
      const caret = input.value.length;
      input.setSelectionRange?.(caret, caret);
    }
  }

  function activateRemoteFocus() {
    ensureRemoteFocus();

    if (remoteFocusTarget && !remoteFocusTarget.disabled) {
      if (remoteFocusTarget === elements.catalogSearchInput) {
        setCatalogSearchEditing(true);
        return;
      }

      remoteFocusTarget.click();
    }
  }

  function handleRemoteCommand(command) {
    if (state.screen === "game-loading") {
      return;
    }

    if (state.catalogSearchEditing) {
      if (command === "back") {
        setCatalogSearchEditing(false);
      } else if (command === "ok") {
        elements.catalogSearchInput.focus({ preventScroll: true });
      }
      return;
    }

    if (state.gameDetailsOpen) {
      if (command === "back") {
        closeGameDetails();
        return;
      }

      if (command === "home") {
        setRemoteFocus(elements.gameDetailsActionButton);
        return;
      }
    }

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

  function getGameDetailsFocusableElements() {
    return Array.from(
      elements.gameDetailsOverlay.querySelectorAll(
        "button:not(:disabled), [tabindex]:not([tabindex=\"-1\"])"
      )
    ).filter((element) => !element.closest("[hidden]") && element.getClientRects().length > 0);
  }

  function setGameDetailsBackgroundInert(inert) {
    Array.from(elements.partybeamScreen.children).forEach((child) => {
      if (child !== elements.gameDetailsOverlay) {
        child.inert = inert;
      }
    });
  }

  function stopGameDownloadSimulation() {
    if (gameDownloadTimer !== null) {
      window.clearInterval(gameDownloadTimer);
      gameDownloadTimer = null;
    }
  }

  function renderGamePreparationState() {
    const preparationState = state.gamePreparationState;
    const downloading = preparationState === "downloading";
    const error = preparationState === "error";
    const ready = preparationState === "ready";
    const progress = Math.max(0, Math.min(100, Math.round(state.gameDownloadProgress)));

    elements.gameDetailsOverlay.dataset.preparationState = preparationState;
    elements.gameDownloadProgress.hidden = !downloading;
    elements.gameDownloadError.hidden = !error;
    elements.gameDownloadPercent.textContent = progress + "%";
    elements.gameDownloadProgressTrack.setAttribute("aria-valuenow", String(progress));
    elements.gameDownloadProgressFill.style.width = progress + "%";
    elements.gameDownloadSize.textContent = Math.round(200 * progress / 100) + " MB / 200 MB";

    const actionLabel = downloading
      ? "CANCEL"
      : ready
        ? "START GAME"
        : error
          ? "RETRY"
          : "DOWNLOAD GAME";

    elements.gameDetailsActionButton.textContent = actionLabel;
    elements.gameDetailsActionButton.classList.toggle("is-cancel", downloading);

    if (elements.gamePreparationState && elements.gamePreparationState.value !== preparationState) {
      elements.gamePreparationState.value = preparationState;
    }
  }

  function setGamePreparationState(preparationState, progress) {
    stopGameDownloadSimulation();
    state.gamePreparationState = preparationState;
    state.gameDownloadProgress = typeof progress === "number"
      ? progress
      : preparationState === "downloading"
        ? 42
        : preparationState === "ready"
          ? 100
          : 0;
    renderGamePreparationState();
  }

  function startGameDownloadSimulation() {
    stopGameDownloadSimulation();
    state.gamePreparationState = "downloading";
    state.gameDownloadProgress = 0;
    renderGamePreparationState();

    gameDownloadTimer = window.setInterval(() => {
      state.gameDownloadProgress = Math.min(100, state.gameDownloadProgress + 5);

      if (state.gameDownloadProgress >= 100) {
        stopGameDownloadSimulation();
        state.gamePreparationState = "ready";
      }

      renderGamePreparationState();
    }, 120);
  }

  function stopGameLaunchSimulation() {
    if (gameLaunchTimer !== null) {
      window.clearTimeout(gameLaunchTimer);
      gameLaunchTimer = null;
    }
  }

  function hideGameLaunchScreen() {
    stopGameLaunchSimulation();
    elements.gameLaunchScreen.hidden = true;
    elements.gameLaunchScreen.setAttribute("aria-hidden", "true");
    elements.partybeamScreen.classList.remove("is-game-launching");
  }

  function showGameLaunchScreen() {
    if (state.gameDetailsOpen) {
      closeGameDetails();
    }

    releaseBrowserFocusForScreenTransition();
    stopGameLaunchSimulation();

    state.screen = "game-loading";
    elements.lobbyScreen.hidden = true;
    elements.catalogScreen.hidden = true;
    elements.footer.hidden = true;
    elements.gameLaunchScreen.hidden = false;
    elements.gameLaunchScreen.setAttribute("aria-hidden", "false");
    elements.partybeamScreen.classList.remove("is-catalog");
    elements.partybeamScreen.classList.add("is-game-launching");
    elements.partybeamScreen.setAttribute("aria-label", "Loading selected PartyBeam game");
    setRemoteFocus(null);

    gameLaunchTimer = window.setTimeout(() => {
      showLobby();
    }, GAME_LAUNCH_MOCK_DURATION_MS);
  }

  function updateGameDetailsCopy(origin) {
    const gameNumber = origin.dataset.gameNumber || "01";
    const maximumPlayers = Number(origin.dataset.maxPlayers) || 6;
    const gameTitle = origin.dataset.gameTitle || ("Placeholder Game " + gameNumber);

    elements.gameDetailsTitle.textContent = gameTitle.toUpperCase();
    elements.gameDetailsPlayers.textContent = "1–" + maximumPlayers + " players";
    elements.gameDetailsCoverNumber.textContent = gameNumber;
    elements.gameDetailsCoverTitle.textContent = gameTitle.toUpperCase();

    const coverImage = origin.dataset.coverImage || "";
    elements.gameDetailsCover.classList.toggle("game-details-cover--image", Boolean(coverImage));
    elements.gameDetailsCover.style.backgroundImage = coverImage ? `url("${coverImage}")` : "";

    elements.gameDetailsActionButton.setAttribute("aria-label", "Game action for " + gameTitle);
  }

  function openGameDetails(origin) {
    if (state.gameDetailsOpen || !origin) {
      return;
    }

    gameDetailsOrigin = origin;
    gameDetailsOpenedWithBrowserFocus = document.activeElement === origin;
    state.gameDetailsOpen = true;
    updateGameDetailsCopy(origin);
    renderGamePreparationState();

    elements.gameDetailsOverlay.hidden = false;
    elements.gameDetailsOverlay.setAttribute("aria-hidden", "false");
    elements.partybeamScreen.classList.add("is-game-details-open");
    setGameDetailsBackgroundInert(true);

    const initialTarget = elements.gameDetailsActionButton;
    setRemoteFocus(initialTarget);

    if (gameDetailsOpenedWithBrowserFocus) {
      initialTarget.focus({ preventScroll: true });
    } else {
      browserFocusInsideScreen = false;
      renderRemoteFocusVisual();
    }
  }

  function closeGameDetails() {
    if (!state.gameDetailsOpen) {
      return;
    }

    const origin = gameDetailsOrigin || elements.gameCoverGrid.querySelector(".game-cover:not([hidden])");
    state.gameDetailsOpen = false;
    setGameDetailsBackgroundInert(false);
    elements.gameDetailsOverlay.hidden = true;
    elements.gameDetailsOverlay.setAttribute("aria-hidden", "true");
    elements.partybeamScreen.classList.remove("is-game-details-open");

    setRemoteFocus(origin);

    if (gameDetailsOpenedWithBrowserFocus && origin) {
      origin.focus({ preventScroll: true });
    } else {
      const activeElement = document.activeElement;
      if (activeElement && elements.gameDetailsOverlay.contains(activeElement)) {
        activeElement.blur();
      }
      browserFocusInsideScreen = false;
      renderRemoteFocusVisual();
    }

    gameDetailsOpenedWithBrowserFocus = false;
    gameDetailsOrigin = null;
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

    if (button.dataset.settingToggle === "show-prerelease-games") {
      state.showPrereleaseGames = enabled;
      applyCatalogFilters();
    }
  }

  function updateMasterVolume(value) {
    const numericValue = Math.max(0, Math.min(100, Number(value)));
    elements.masterVolume.value = String(numericValue);
    elements.masterVolumeValue.value = numericValue + "%";
    elements.masterVolume.setAttribute("aria-valuetext", numericValue + " percent");
  }

  function showCatalog() {
    hideGameLaunchScreen();
    setCatalogSearchEditing(false, { focus: false });
    releaseBrowserFocusForScreenTransition();

    state.screen = "catalog";
    elements.lobbyScreen.hidden = true;
    elements.catalogScreen.hidden = false;
    elements.footer.hidden = true;
    elements.partybeamScreen.classList.add("is-catalog");
    elements.partybeamScreen.setAttribute("aria-label", "PartyBeam game catalog");
    elements.catalogScroll.scrollTop = 0;

    const firstCover = elements.gameCoverGrid.querySelector(".game-cover:not([hidden])");
    setRemoteFocus(firstCover || elements.catalogFilterButtons[0]);
    updateCatalogScrollEdgeFade();
  }

  function showLobby() {
    hideGameLaunchScreen();
    setCatalogSearchEditing(false, { focus: false });
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
      const nextViewport = button.dataset.viewport;

      if (nextViewport === "full" && state.viewport !== "full") {
        state.previousViewport = state.viewport;
        setDevPanel(false);
        setRemotePanel(false);
      }

      state.viewport = nextViewport;
      applyViewport();

      if (nextViewport === "full") {
        button.blur();
      }
    });
  });

  document.querySelectorAll("[data-players]").forEach((button) => {
    button.addEventListener("click", () => {
      state.players = Number(button.dataset.players);
      renderPlayers();
    });
  });

  elements.catalogFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      toggleCatalogFilter(button.dataset.catalogFilter);
    });
  });

  elements.catalogSearchInput.addEventListener("input", (event) => {
    state.catalogSearch = event.target.value;
    applyCatalogFilters();
  });

  elements.uiState.addEventListener("change", (event) => {
    state.uiState = event.target.value;
    renderState();
  });

  elements.gamePreparationState.addEventListener("change", (event) => {
    setGamePreparationState(event.target.value);
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

  elements.gameDetailsCloseButton.addEventListener("click", closeGameDetails);
  elements.gameDetailsActionButton.addEventListener("click", () => {
    if (state.gamePreparationState === "downloading") {
      setGamePreparationState("not-downloaded", 0);
      return;
    }

    if (state.gamePreparationState === "ready") {
      showGameLaunchScreen();
      return;
    }

    startGameDownloadSimulation();
  });

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
    if (state.gameDetailsOpen && !elements.gameDetailsOverlay.contains(event.target)) {
      const fallback = getGameDetailsFocusableElements()[0];
      if (fallback) {
        fallback.focus({ preventScroll: true });
      }
      return;
    }

    if (state.settingsOpen && !elements.settingsOverlay.contains(event.target)) {
      const fallback = getSettingsFocusableElements()[0];
      if (fallback) {
        fallback.focus({ preventScroll: true });
      }
    }
  });

  elements.partybeamScreen.addEventListener("focusin", (event) => {
    const simplifiedFlow = document.getElementById("pbSimpleFlow");
    if (simplifiedFlow && !simplifiedFlow.hidden && simplifiedFlow.contains(event.target)) {
      browserFocusInsideScreen = true;
      renderRemoteFocusVisual();
      return;
    }

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
    const activeElement = document.activeElement;
    const tagName = activeElement && activeElement.tagName;
    const searchHasFocus = activeElement === elements.catalogSearchInput;
    const searchIsEditing = searchHasFocus && state.catalogSearchEditing;
    const typing = (tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA")
      && (!searchHasFocus || state.catalogSearchEditing);

    if (searchIsEditing) {
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        setCatalogSearchEditing(false);
      }
      return;
    }

    if (event.key === "Escape") {
      if (state.gameDetailsOpen) {
        event.preventDefault();
        closeGameDetails();
        return;
      }

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

      if (state.viewport === "full") {
        event.preventDefault();
        state.viewport = state.previousViewport;
        applyViewport();
        return;
      }
    }

    if (state.gameDetailsOpen && event.key === "Tab") {
      const focusables = getGameDetailsFocusableElements();
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
      if (command === "ok" && activeElement === elements.catalogSearchInput) {
        event.preventDefault();
        setCatalogSearchEditing(true);
        return;
      }

      if (["up", "down", "left", "right"].includes(command)) {
        event.preventDefault();
        moveBrowserFocus(command);
        return;
      }

      if (command === "back" && state.gameDetailsOpen) {
        event.preventDefault();
        closeGameDetails();
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
  renderGamePreparationState();
  render();
})();
