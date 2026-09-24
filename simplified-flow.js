(() => {
  "use strict";

  const shell = document.getElementById("partybeamScreen");
  const detailsAction = document.getElementById("gameDetailsActionButton");
  const detailsClose = document.getElementById("gameDetailsCloseButton");
  const detailsTitle = document.getElementById("gameDetailsTitle");
  const manageGamesButton = document.getElementById("manageGamesButton");
  const devPanel = document.getElementById("devPanel");

  if (!shell || !detailsAction || !detailsClose || !manageGamesButton || !devPanel) {
    return;
  }

  const flow = {
    view: null,
    title: "Grimcellar",
    selectedPlayers: [],
    previousFocus: null,
    confirmationOrigin: null,
    confirmationGameId: null,
    timers: new Set(),
    compatibilityScenario: "normal",
    storageScenario: "normal",
    games: [
      { id: "grimcellar", title: "Grimcellar", size: 420, installed: true, offline: true, update: false },
      { id: "reflex", title: "Reflex", size: 180, installed: true, offline: false, update: true },
      { id: "quiz-blast", title: "Quiz Blast", size: 260, installed: true, offline: false, update: false },
      { id: "kingdom-run", title: "Kingdom Run", size: 510, installed: true, offline: true, update: false },
      { id: "turbo-orbit", title: "Turbo Orbit", size: 340, installed: true, offline: false, update: false }
    ]
  };

  const overlay = document.createElement("section");
  overlay.className = "pb-simple-flow";
  overlay.id = "pbSimpleFlow";
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = '<div class="pb-simple-flow__surface" id="pbSimpleFlowSurface"></div>';
  shell.appendChild(overlay);

  const surface = overlay.querySelector("#pbSimpleFlowSurface");

  function rememberTimer(timer) {
    flow.timers.add(timer);
    return timer;
  }

  function clearTimers() {
    flow.timers.forEach((timer) => {
      window.clearTimeout(timer);
      window.clearInterval(timer);
    });
    flow.timers.clear();
  }

  function getPlayerNames() {
    const catalogNames = Array.from(
      document.querySelectorAll("#catalogPlayersList .player-slot--connected .player-name")
    ).map((element) => element.textContent.trim()).filter(Boolean);

    if (catalogNames.length > 0) {
      return catalogNames;
    }

    const lobbyNames = Array.from(
      document.querySelectorAll("#playersGrid .player-slot--connected .player-name")
    ).map((element) => element.textContent.trim()).filter(Boolean);

    return lobbyNames.length > 0
      ? lobbyNames
      : ["Paweł", "Ewelinka", "Czarek", "Marta", "Kuba", "Ola"];
  }

  function getActiveFocusRoot() {
    return overlay.querySelector(".pb-confirm") || overlay;
  }

  function getFocusable() {
    const root = getActiveFocusRoot();
    return Array.from(
      root.querySelectorAll('button:not([disabled]):not([hidden]), [tabindex="0"]')
    ).filter((element) => element.offsetParent !== null && !element.closest("[inert]"));
  }

  function focusElement(target) {
    if (!target || typeof target.focus !== "function") {
      return;
    }

    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function focusFirst() {
    window.requestAnimationFrame(() => {
      focusElement(getFocusable()[0]);
    });
  }

  function moveFocus(direction) {
    const focusables = getFocusable();
    if (focusables.length === 0) {
      return;
    }

    const current = focusables.includes(document.activeElement)
      ? document.activeElement
      : focusables[0];

    if (current !== document.activeElement) {
      focusElement(current);
      return;
    }

    const target = window.PartyBeamSpatialNavigation?.findDirectionalTarget(
      current,
      direction,
      focusables
    );

    if (target) {
      focusElement(target);
    }
  }

  function setBackgroundInert(inert) {
    Array.from(shell.children).forEach((child) => {
      if (child !== overlay) {
        child.inert = inert;
      }
    });
  }

  function openOverlay(view) {
    clearTimers();
    flow.view = view;
    if (overlay.hidden) {
      flow.previousFocus = document.activeElement;
    }
    overlay.dataset.view = view;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    shell.classList.add("pb-simple-flow-active");
    setBackgroundInert(true);
  }

  function closeOverlay() {
    clearTimers();
    flow.view = null;
    delete overlay.dataset.view;
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    shell.classList.remove("pb-simple-flow-active");
    setBackgroundInert(false);
    surface.replaceChildren();

    const fallback = flow.previousFocus && document.contains(flow.previousFocus)
      ? flow.previousFocus
      : document.querySelector("#gameCoverGrid .game-cover:not([hidden])") || manageGamesButton;

    if (fallback && typeof fallback.focus === "function") {
      fallback.focus({ preventScroll: true });
    }
  }

  function renderHeader(kicker, title, description, backLabel = "BACK") {
    return `
      <header class="pb-flow-header">
        <div>
          <span class="pb-flow-kicker">${kicker}</span>
          <h1>${title}</h1>
          ${description ? `<p>${description}</p>` : ""}
        </div>
        <button class="pb-flow-back" type="button" data-flow-action="close">${backLabel}</button>
      </header>
    `;
  }

  function renderPreparing(title, options = {}) {
    openOverlay("preparing");
    flow.title = title || flow.title;
    const progress = options.progress ?? 36;

    surface.innerHTML = `
      <div class="pb-flow-screen pb-flow-screen--preparing">
        <div class="pb-preparing-card">
          <img src="assets/icon.png" alt="" aria-hidden="true">
          <span class="pb-flow-kicker">PARTYBEAM</span>
          <h1>Preparing ${flow.title}...</h1>
          <p>Getting everything ready for the room.</p>
          <div class="pb-progress" role="progressbar" aria-label="Preparing game" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
            <span style="width: ${progress}%"></span>
          </div>
        </div>
      </div>
    `;

    let value = progress;
    const bar = surface.querySelector(".pb-progress");
    const fill = bar.querySelector("span");
    const interval = rememberTimer(window.setInterval(() => {
      value = Math.min(96, value + 7);
      fill.style.width = value + "%";
      bar.setAttribute("aria-valuenow", String(value));
    }, 220));

    rememberTimer(window.setTimeout(() => {
      window.clearInterval(interval);
      flow.timers.delete(interval);
      renderGameSession(flow.title);
    }, options.delay ?? 1800));
  }

  function renderPartyChips(selectedNames = null) {
    const players = getPlayerNames();
    return players.map((name) => {
      const selected = !selectedNames || selectedNames.includes(name);
      return `
        <span class="pb-party-chip ${selected ? "is-playing" : "is-watching"}">
          <span>${name}</span>
          <small>${selected ? "PLAYING" : "IN SESSION"}</small>
        </span>
      `;
    }).join("");
  }

  function renderGameSession(title) {
    openOverlay("game");
    flow.title = title || flow.title;
    const selected = flow.selectedPlayers.length > 0 ? flow.selectedPlayers : null;

    surface.innerHTML = `
      <div class="pb-flow-screen pb-flow-screen--game">
        ${renderHeader("GAME SESSION", flow.title, "The downloaded game is running inside PartyBeam.", "EXIT GAME")}
        <section class="pb-game-placeholder" aria-label="Running game">
          <div class="pb-game-placeholder__mark">
            <span>GAME RUNNING</span>
            <strong>${flow.title}</strong>
          </div>
          <p>This surface stands in for the game itself. PartyBeam keeps the party session around it.</p>
          <div class="pb-party-chips" aria-label="Party session players">
            ${renderPartyChips(selected)}
          </div>
        </section>
        <footer class="pb-flow-actions">
          <span class="pb-dev-only-copy">PLAYGROUND ONLY</span>
          <button class="pb-flow-primary" type="button" data-flow-action="finish-game">SIMULATE GAME FINISH</button>
        </footer>
      </div>
    `;
    focusFirst();
  }

  function renderResults(title) {
    openOverlay("results");
    flow.title = title || flow.title;

    surface.innerHTML = `
      <div class="pb-flow-screen pb-flow-screen--results">
        ${renderHeader("GAME OVER", "Nice game!", flow.title + " has finished.", "CLOSE")}
        <section class="pb-results-card" aria-labelledby="pbResultsTitle">
          <span class="pb-results-icon" aria-hidden="true">
  <svg viewBox="0 0 24 24" focusable="false">
    <path d="M12 3 14.8 8.7 21 9.6 16.5 14 17.6 20.2 12 17.3 6.4 20.2 7.5 14 3 9.6 9.2 8.7 12 3Z"></path>
  </svg>
</span>
          <strong id="pbResultsTitle">SESSION COMPLETE</strong>
          <p>Your PartySession stays connected, so the next game is one decision away.</p>
          <div class="pb-party-chips">
            ${renderPartyChips()}
          </div>
        </section>
        <footer class="pb-flow-actions pb-flow-actions--split">
          <button class="pb-flow-secondary" type="button" data-flow-action="choose-game">CHOOSE ANOTHER GAME</button>
          <button class="pb-flow-primary" type="button" data-flow-action="play-again">PLAY AGAIN</button>
        </footer>
      </div>
    `;
    focusFirst();
  }

  function renderBlocked(reason, detail) {
    openOverlay("blocked");
    surface.innerHTML = `
      <div class="pb-flow-screen pb-flow-screen--message">
        ${renderHeader("CAN'T START YET", reason, detail, "BACK")}
        <section class="pb-message-card" aria-labelledby="pbMessageTitle">
          <span class="pb-message-symbol" aria-hidden="true">
  <svg viewBox="0 0 24 24" focusable="false">
    <path d="M12 3 22 20H2L12 3Z"></path>
    <path d="M12 9v5"></path>
    <path d="M12 17.5h.01"></path>
  </svg>
</span>
          <h2 id="pbMessageTitle">${reason}</h2>
          <p>${detail}</p>
          <button class="pb-flow-primary" type="button" data-flow-action="close">CHOOSE ANOTHER GAME</button>
        </section>
      </div>
    `;
    focusFirst();
  }

  function renderIncompatibleNotice() {
    const players = getPlayerNames();
    const incompatible = players[players.length - 1] || "One player";
    flow.selectedPlayers = players.filter((name) => name !== incompatible);
    openOverlay("compatibility-notice");

    surface.innerHTML = `
      <div class="pb-flow-screen pb-flow-screen--message">
        ${renderHeader("PLAYER CHECK", "One player can't join this game", "You can still start with the other connected players.", "BACK")}
        <section class="pb-message-card" aria-labelledby="pbMessageTitle">
          <span class="pb-message-symbol" aria-hidden="true">
  <svg viewBox="0 0 24 24" focusable="false">
    <circle cx="12" cy="12" r="9"></circle>
    <path d="M12 10v6"></path>
    <path d="M12 7.5h.01"></path>
  </svg>
</span>
          <h2 id="pbMessageTitle">${incompatible} can't join this game.</h2>
          <p>This game requires the PartyBeam app. ${incompatible} stays connected to the PartySession.</p>
          <button class="pb-flow-primary" type="button" data-flow-action="continue-after-notice">CONTINUE</button>
        </section>
      </div>
    `;
    focusFirst();
  }

  function renderPlayerSelection() {
    let players = getPlayerNames();
    if (players.length < 5) {
      players = ["Paweł", "Ewelinka", "Czarek", "Marta", "Kuba", "Ola"];
    }

    const maxPlayers = 4;
    flow.selectedPlayers = players.slice(0, maxPlayers);
    openOverlay("player-selection");

    surface.innerHTML = `
      <div class="pb-flow-screen pb-flow-screen--selection">
        ${renderHeader("WHO'S PLAYING?", flow.title + " supports up to " + maxPlayers + " players.", "Choose exactly " + maxPlayers + " players for this game. Everyone else stays in the PartySession.", "BACK")}
        <section class="pb-player-selection" data-max-players="${maxPlayers}" aria-label="Players available for this game">
          ${players.map((name, index) => `
            <button class="pb-player-choice ${index < maxPlayers ? "is-selected" : ""}" type="button" data-player-name="${name}" aria-pressed="${index < maxPlayers}">
              <span class="pb-player-choice__dot"></span>
              <strong>${name}</strong>
              <small>${index < maxPlayers ? "PLAYING" : "IN SESSION"}</small>
            </button>
          `).join("")}
        </section>
        <footer class="pb-flow-actions">
          <span id="pbSelectionCount">${maxPlayers} / ${maxPlayers} selected</span>
          <button class="pb-flow-primary" id="pbSelectionStart" type="button" data-flow-action="confirm-selection">START</button>
        </footer>
      </div>
    `;
    focusFirst();
  }

  function updateSelection() {
    const choices = Array.from(surface.querySelectorAll(".pb-player-choice"));
    const max = Number(surface.querySelector(".pb-player-selection")?.dataset.maxPlayers || 4);
    const selected = choices.filter((choice) => choice.classList.contains("is-selected"));
    const count = surface.querySelector("#pbSelectionCount");
    const start = surface.querySelector("#pbSelectionStart");

    flow.selectedPlayers = selected.map((choice) => choice.dataset.playerName);
    if (count) {
      count.textContent = selected.length + " / " + max + " selected";
    }
    if (start) {
      start.disabled = selected.length !== max;
    }

    choices.forEach((choice) => {
      const active = choice.classList.contains("is-selected");
      choice.setAttribute("aria-pressed", String(active));
      const label = choice.querySelector("small");
      if (label) {
        label.textContent = active ? "PLAYING" : "IN SESSION";
      }
    });
  }

  function startPlayFlow() {
    flow.title = (detailsTitle?.textContent || "Grimcellar").trim();
    flow.selectedPlayers = [];

    if (flow.compatibilityScenario === "below-minimum") {
      renderBlocked(
        flow.title + " needs at least 2 players.",
        "Connect another player, then try again."
      );
      return;
    }

    if (flow.compatibilityScenario === "above-maximum") {
      renderPlayerSelection();
      return;
    }

    if (flow.compatibilityScenario === "incompatible-valid") {
      renderIncompatibleNotice();
      return;
    }

    if (flow.compatibilityScenario === "incompatible-blocked") {
      renderBlocked(
        "Not enough compatible players.",
        "Ewelinka can't join because microphone access is required. " + flow.title + " needs at least 2 compatible players."
      );
      return;
    }

    flow.selectedPlayers = getPlayerNames();
    renderPreparing(flow.title);
  }

  function storageSummary() {
    const used = flow.games
      .filter((game) => game.installed)
      .reduce((sum, game) => sum + game.size, 0);
    const total = flow.storageScenario === "low" ? used + 120 : 3200;
    return {
      used,
      free: Math.max(0, total - used)
    };
  }

  function statusForGame(game) {
    if (!game.installed) {
      return "Not installed";
    }
    if (game.update) {
      return "Update available";
    }
    return game.offline ? "Available offline" : "Not available offline";
  }

  function renderManageGames(options = {}) {
    openOverlay("manage-games");
    const storage = storageSummary();
    const lowSpace = flow.storageScenario === "low";

    surface.innerHTML = `
      <div class="partybeam-system-overlay pb-manage-overlay">
        <section
          class="partybeam-system-panel pb-manage-panel"
          id="pbManagePanel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pbManageTitle"
          aria-describedby="pbManageSubtitle">
          <header class="partybeam-system-header" id="pbManageHeader">
            <div class="partybeam-system-heading">
              <span class="partybeam-system-kicker">PARTYBEAM</span>
              <h2 id="pbManageTitle">MANAGE GAMES</h2>
              <p id="pbManageSubtitle">Manage storage, updates and offline availability.</p>
            </div>
            <button
              class="partybeam-system-close"
              id="pbManageCloseButton"
              type="button"
              data-flow-action="close"
              aria-label="Close Manage Games">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 6l12 12M18 6 6 18"></path>
              </svg>
              <span>Close</span>
            </button>
          </header>

          <div class="pb-manage-main">
            <div class="pb-storage-summary">
              <div>
                <span>STORAGE</span>
                <strong>${(storage.free / 1000).toFixed(1)} GB free</strong>
              </div>
              <div class="pb-storage-meter" aria-label="Approximate storage usage">
                <span style="width: ${Math.min(96, (storage.used / (storage.used + storage.free || 1)) * 100)}%"></span>
              </div>
            </div>

            ${lowSpace ? `
              <aside class="pb-space-warning" role="status">
                <strong>Not enough space</strong>
                <span>Free 350 MB to continue.</span>
                <p>Remove a game you no longer need, then try again.</p>
              </aside>
            ` : ""}

            <section class="pb-manage-list" aria-label="Installed games">
              ${flow.games.map((game) => `
                <article class="pb-manage-game" data-game-id="${game.id}">
                  <div class="pb-manage-game__copy">
                    <strong>${game.title}</strong>
                    <span>${game.installed ? game.size + " MB" : ""}</span>
                    <small>${statusForGame(game)}</small>
                  </div>
                  <div class="pb-manage-game__progress" hidden>
                    <div class="pb-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                      <span style="width:0%"></span>
                    </div>
                    <small>Preparing...</small>
                  </div>
                  <div class="pb-manage-game__actions">
                    ${game.installed && game.update ? '<button type="button" data-game-action="update">UPDATE</button>' : ""}
                    ${game.installed && !game.offline ? '<button type="button" data-game-action="offline">MAKE AVAILABLE OFFLINE</button>' : ""}
                    ${game.installed ? '<button type="button" data-game-action="remove">REMOVE</button>' : ""}
                  </div>
                </article>
              `).join("")}
            </section>
          </div>

          <footer class="partybeam-system-footer">
            <span>Storage changes are applied immediately</span>
            <button
              class="screen-button screen-button--primary partybeam-system-done"
              type="button"
              data-flow-action="close">
              DONE
            </button>
          </footer>
        </section>
      </div>
    `;
    if (options.focusAfterGameId) {
      focusManageAfterRemoval(options.focusAfterGameId);
    } else {
      focusFirst();
    }
  }

  function focusManageAfterRemoval(gameId) {
    const cards = Array.from(surface.querySelectorAll(".pb-manage-game"));
    const removedIndex = Math.max(
      0,
      flow.games.findIndex((game) => game.id === gameId)
    );
    const orderedCards = [
      ...cards.slice(removedIndex + 1),
      ...cards.slice(0, removedIndex).reverse()
    ];
    const target = orderedCards
      .map((card) => card.querySelector("button:not([disabled]):not([hidden])"))
      .find(Boolean)
      || surface.querySelector(".partybeam-system-done")
      || surface.querySelector(".partybeam-system-close");

    focusElement(target);
    window.requestAnimationFrame(() => {
      if (target && document.contains(target) && document.activeElement !== target) {
        focusElement(target);
      }
    });
  }

  function renderRemoveConfirmation(game, origin) {
    flow.confirmationOrigin = origin || document.activeElement;
    flow.confirmationGameId = game.id;

    const managePanel = surface.querySelector("#pbManagePanel");
    if (managePanel) {
      managePanel.inert = true;
      managePanel.setAttribute("aria-hidden", "true");
    }

    const dialog = document.createElement("div");
    dialog.className = "pb-confirm-backdrop";
    dialog.innerHTML = `
      <section class="pb-confirm" role="dialog" aria-modal="true" aria-labelledby="pbConfirmTitle" aria-describedby="pbConfirmDescription">
        <span class="pb-flow-kicker">REMOVE GAME</span>
        <h2 id="pbConfirmTitle">Remove ${game.title}?</h2>
        <p id="pbConfirmDescription">This frees about ${game.size} MB. You can download the game again later.</p>
        <div class="pb-confirm-actions">
          <button type="button" data-confirm-action="keep">KEEP</button>
          <button class="pb-flow-danger" type="button" data-confirm-action="remove" data-game-id="${game.id}">REMOVE</button>
        </div>
      </section>
    `;
    overlay.appendChild(dialog);
    const firstButton = dialog.querySelector("button");
    focusElement(firstButton);
    window.requestAnimationFrame(() => {
      if (dialog.isConnected && !dialog.contains(document.activeElement)) {
        focusElement(firstButton);
      }
    });
  }

  function closeConfirmation({ restoreFocus = true } = {}) {
    const dialog = overlay.querySelector(".pb-confirm-backdrop");
    const managePanel = surface.querySelector("#pbManagePanel");
    const origin = flow.confirmationOrigin;

    if (dialog) {
      dialog.remove();
    }

    if (managePanel) {
      managePanel.inert = false;
      managePanel.removeAttribute("inert");
      managePanel.removeAttribute("aria-hidden");
    }

    flow.confirmationOrigin = null;
    flow.confirmationGameId = null;

    if (!restoreFocus) {
      return;
    }

    if (origin && document.contains(origin) && !origin.disabled) {
      focusElement(origin);
      window.requestAnimationFrame(() => {
        if (document.contains(origin) && document.activeElement !== origin) {
          focusElement(origin);
        }
      });
    } else {
      focusFirst();
    }
  }

  function simulateManageProgress(gameId, action) {
    const game = flow.games.find((item) => item.id === gameId);
    const card = surface.querySelector('[data-game-id="' + gameId + '"]');
    if (!game || !card) {
      return;
    }

    if (flow.storageScenario === "low" && (action === "update" || action === "offline")) {
      const warning = surface.querySelector(".pb-space-warning");
      if (warning) {
        warning.classList.add("is-emphasized");
        warning.scrollIntoView({ block: "nearest" });
        rememberTimer(window.setTimeout(() => warning.classList.remove("is-emphasized"), 900));
      }
      return;
    }

    const actions = card.querySelector(".pb-manage-game__actions");
    const progressWrap = card.querySelector(".pb-manage-game__progress");
    const progress = progressWrap.querySelector(".pb-progress");
    const fill = progress.querySelector("span");
    const label = progressWrap.querySelector("small");
    let value = 8;

    actions.hidden = true;
    progressWrap.hidden = false;
    label.textContent = action === "update" ? "Updating..." : "Preparing for offline play...";

    const interval = rememberTimer(window.setInterval(() => {
      value = Math.min(100, value + 11);
      fill.style.width = value + "%";
      progress.setAttribute("aria-valuenow", String(value));

      if (value >= 100) {
        window.clearInterval(interval);
        flow.timers.delete(interval);
        if (action === "update") {
          game.update = false;
        }
        if (action === "offline") {
          game.offline = true;
        }
        renderManageGames();
      }
    }, 140));
  }

  function addDevControls() {
    const legacyPreparation = document.getElementById("gamePreparationState");
    if (legacyPreparation) {
      const wrapper = legacyPreparation.closest(".dev-field");
      if (wrapper) {
        wrapper.hidden = true;
      }
    }

    const group = document.createElement("div");
    group.className = "pb-dev-extension";
    group.innerHTML = `
      <label class="dev-field">
        <span>Play exception scenario</span>
        <select id="pbCompatibilityScenario">
          <option value="normal">Normal happy path</option>
          <option value="below-minimum">Below minimum players</option>
          <option value="above-maximum">Above maximum players</option>
          <option value="incompatible-valid">1 incompatible, enough remain</option>
          <option value="incompatible-blocked">Incompatible, start blocked</option>
        </select>
      </label>
      <label class="dev-field">
        <span>Storage scenario</span>
        <select id="pbStorageScenario">
          <option value="normal">Normal</option>
          <option value="low">Insufficient space</option>
        </select>
      </label>
      <label class="dev-field">
        <span>Simplified lifecycle</span>
        <select id="pbLifecycleState">
          <option value="">Choose state...</option>
          <option value="preparing">Preparing</option>
          <option value="game">Active game</option>
          <option value="results">Results</option>
          <option value="manage">Manage games</option>
        </select>
      </label>
    `;

    devPanel.insertBefore(group, devPanel.querySelector(".dev-note"));

    group.querySelector("#pbCompatibilityScenario").addEventListener("change", (event) => {
      flow.compatibilityScenario = event.target.value;
    });

    group.querySelector("#pbStorageScenario").addEventListener("change", (event) => {
      flow.storageScenario = event.target.value;
      if (flow.view === "manage-games") {
        renderManageGames();
      }
    });

    group.querySelector("#pbLifecycleState").addEventListener("change", (event) => {
      const value = event.target.value;
      flow.title = (detailsTitle?.textContent || "Grimcellar").trim();
      if (value === "preparing") {
        renderPreparing(flow.title, { delay: 5000 });
      } else if (value === "game") {
        renderGameSession(flow.title);
      } else if (value === "results") {
        renderResults(flow.title);
      } else if (value === "manage") {
        renderManageGames();
      }
      event.target.value = "";
    });
  }

  function forceSimpleDetails() {
    const downloadStatus = document.getElementById("gameDownloadStatus");
    if (downloadStatus) {
      downloadStatus.hidden = true;
    }

    if (detailsAction.textContent.trim() !== "PLAY") {
      detailsAction.textContent = "PLAY";
    }
    detailsAction.setAttribute("aria-label", "Play selected game");
  }

  const detailsObserver = new MutationObserver(forceSimpleDetails);
  detailsObserver.observe(detailsAction, { childList: true, subtree: true, characterData: true });
  forceSimpleDetails();

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) {
      return;
    }

    if (target === detailsAction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      flow.title = (detailsTitle?.textContent || "Grimcellar").trim();
      detailsClose.click();
      startPlayFlow();
      return;
    }

    if (target === manageGamesButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      renderManageGames();
      return;
    }

    if (flow.view && target.matches("[data-remote-key]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      handleRemoteCommand(target.dataset.remoteKey);
    }
  }, true);

  overlay.addEventListener("focusin", (event) => {
    const confirmation = overlay.querySelector(".pb-confirm");
    if (confirmation && !confirmation.contains(event.target)) {
      focusElement(getFocusable()[0]);
    }
  });

  overlay.addEventListener("click", (event) => {
    const playerChoice = event.target.closest(".pb-player-choice");
    if (playerChoice) {
      const selected = playerChoice.classList.contains("is-selected");
      const max = Number(surface.querySelector(".pb-player-selection")?.dataset.maxPlayers || 4);
      const selectedCount = surface.querySelectorAll(".pb-player-choice.is-selected").length;

      if (selected || selectedCount < max) {
        playerChoice.classList.toggle("is-selected");
        updateSelection();
      }
      return;
    }

    const gameButton = event.target.closest("[data-game-action]");
    if (gameButton) {
      const card = gameButton.closest("[data-game-id]");
      const gameId = card?.dataset.gameId;
      const action = gameButton.dataset.gameAction;
      const game = flow.games.find((item) => item.id === gameId);

      if (!game) {
        return;
      }

      if (action === "remove") {
        renderRemoveConfirmation(game, gameButton);
      } else {
        simulateManageProgress(gameId, action);
      }
      return;
    }

    const confirmButton = event.target.closest("[data-confirm-action]");
    if (confirmButton) {
      if (confirmButton.dataset.confirmAction === "keep") {
        closeConfirmation();
        return;
      }

      const gameId = confirmButton.dataset.gameId;
      const game = flow.games.find((item) => item.id === gameId);
      if (game) {
        game.installed = false;
        game.offline = false;
        game.update = false;
      }
      closeConfirmation({ restoreFocus: false });
      renderManageGames({ focusAfterGameId: gameId });
      return;
    }

    const actionButton = event.target.closest("[data-flow-action]");
    if (!actionButton) {
      return;
    }

    switch (actionButton.dataset.flowAction) {
      case "close":
        closeOverlay();
        break;
      case "finish-game":
        renderResults(flow.title);
        break;
      case "play-again":
        flow.selectedPlayers = getPlayerNames();
        renderPreparing(flow.title);
        break;
      case "choose-game":
        closeOverlay();
        break;
      case "continue-after-notice":
        renderPreparing(flow.title);
        break;
      case "confirm-selection":
        renderPreparing(flow.title);
        break;
      default:
        break;
    }
  });

  function handleRemoteCommand(command) {
    if (!flow.view) {
      return false;
    }

    if (command === "left" || command === "up" || command === "right" || command === "down") {
      moveFocus(command);
      return true;
    }

    if (command === "ok") {
      if (document.activeElement && typeof document.activeElement.click === "function") {
        document.activeElement.click();
      }
      return true;
    }

    if (command === "back") {
      if (overlay.querySelector(".pb-confirm-backdrop")) {
        closeConfirmation();
      } else {
        closeOverlay();
      }
      return true;
    }

    if (command === "home") {
      closeOverlay();
      return true;
    }

    return false;
  }

  window.addEventListener("keydown", (event) => {
    if (!flow.view) {
      return;
    }

    const commandByKey = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      Enter: "ok",
      Backspace: "back",
      Escape: "back",
      Home: "home"
    };

    const command = commandByKey[event.key];
    if (!command) {
      if (event.key === "Tab") {
        const focusables = getFocusable();
        if (focusables.length > 0) {
          event.preventDefault();
          const current = focusables.indexOf(document.activeElement);
          const delta = event.shiftKey ? -1 : 1;
          const next = current < 0 ? 0 : (current + delta + focusables.length) % focusables.length;
          focusElement(focusables[next]);
        }
      }
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    handleRemoteCommand(command);
  }, true);

  addDevControls();
})();