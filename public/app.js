const categories = ["Immobilier", "Vehicules", "High-Tech", "Mode", "Collections", "Maison", "Insolite"];
const state = {
  player: JSON.parse(localStorage.getItem("marketPlayer") || "null"),
  account: JSON.parse(localStorage.getItem("marketAccount") || "null"),
  room: null,
  poll: null,
  timer: null,
  processedRounds: new Set(JSON.parse(localStorage.getItem("marketProcessedRounds") || "[]")),
  adminUnlocked: sessionStorage.getItem("marketAdminUnlocked") === "true",
  adminListings: [],
  trashListings: [],
  selectedListings: new Set(),
  selectedTrash: new Set(),
  processedGameWins: new Set(JSON.parse(localStorage.getItem("marketProcessedGameWins") || "[]")),
  finalRenderKey: null,
  imageListingId: null,
  imageIndex: 0,
  wheelRotation: 0
};

const $ = (id) => document.getElementById(id);
const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
let authMode = "login";

function isHost() {
  return Boolean(state.room && state.player?.id === state.room.hostId);
}

function roundTimeFromForm() {
  if ($("roundTime").value !== "custom") return Number($("roundTime").value) || 30;
  const value = Number($("customRoundTime").value) || 45;
  return Math.min(300, Math.max(5, Math.round(value)));
}

function autoNextSeconds(round) {
  return Math.max(0, Math.ceil(((round?.revealedAt || Date.now()) + 20000 - Date.now()) / 1000));
}

function showMenu(name) {
  $("mainMenu").classList.toggle("hidden", name !== "main");
  $("playMenu").classList.toggle("hidden", name !== "play");
  $("importMenu").classList.toggle("hidden", name !== "import");
  $("adminMenu").classList.toggle("hidden", name !== "admin");
  $("wheelMenu").classList.toggle("hidden", name !== "wheel");
  if (name === "wheel") renderWheel();
}

function goHome() {
  clearInterval(state.poll);
  state.room = null;
  $("game").classList.add("hidden");
  $("home").classList.remove("hidden");
  showMenu("main");
  $("status").textContent = "Menu principal";
  renderAccount();
}

function initCategories() {
  $("categories").innerHTML = categories
    .map((cat) => `<label class="chip"><input type="checkbox" value="${cat}" checked />${cat}</label>`)
    .join("");
}

async function refreshCatalogStatus() {
  try {
    const status = await api("/api/listings/status");
    $("catalogStatus").textContent = `Catalogue serveur partagé : ${status.authorized} annonce(s) jouable(s), dont ${status.imported} importée(s). Visible pour tous les joueurs après validation admin.`;
  } catch (error) {
    $("catalogStatus").textContent = "Catalogue serveur partagé : impossible à lire.";
  }
}

async function refreshAdminListings() {
  try {
    const [activeData, trashData] = await Promise.all([api("/api/listings"), api("/api/listings?trash=1")]);
    state.adminListings = activeData.listings;
    state.trashListings = trashData.listings;
    state.selectedListings.clear();
    state.selectedTrash.clear();
    renderAdminListings();
  } catch (error) {
    $("adminListings").innerHTML = `<p class="note">${error.message}</p>`;
  }
}

function sortedAndFilteredListings() {
  const filter = $("listingFilter").value;
  const sort = $("listingSort").value;
  let rows = [...state.adminListings];
  if (filter === "rated") rows = rows.filter((listing) => listing.rating > 0);
  if (filter === "unrated") rows = rows.filter((listing) => !listing.rating);
  if (filter === "4plus") rows = rows.filter((listing) => listing.rating >= 4);

  rows.sort((a, b) => {
    if (sort === "date-asc") return new Date(a.createdAt) - new Date(b.createdAt);
    if (sort === "rating-desc") return (b.rating || 0) - (a.rating || 0);
    if (sort === "rating-asc") return (a.rating || 0) - (b.rating || 0);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return rows;
}

function listingRow(listing, mode) {
  const checked = mode === "trash" ? state.selectedTrash.has(listing.id) : state.selectedListings.has(listing.id);
  const date = listing.createdAt ? new Date(listing.createdAt).toLocaleDateString("fr-FR") : "Sans date";
  const pending = listing.validationStatus === "pending";
  return `
    <div class="directory-item ${mode === "trash" ? "trashed" : ""}">
      <input type="checkbox" data-select-${mode}="${listing.id}" ${checked ? "checked" : ""} />
      <img src="${listing.images[0]}" alt="" />
      <div>
        <strong>${listing.title}</strong>
        <span>${listing.category} · ${listing.location} · ${date}</span>
        <small class="validation-pill ${pending ? "pending" : "approved"}">${pending ? "En attente admin" : "Validée"}${listing.importerName ? ` · ${listing.importerName}` : ""}</small>
      </div>
      <select class="rating-control" data-rating="${listing.id}" ${mode === "trash" ? "disabled" : ""}>
        ${[0, 1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${Number(listing.rating) === value ? "selected" : ""}>${value ? `${value}/5` : "Note"}</option>`).join("")}
      </select>
      <button class="tiny secondary preview-listing" type="button" data-preview="${listing.id}" data-preview-mode="${mode}">Prévisualiser</button>
      ${mode !== "trash" && pending ? `<button class="tiny validate-import" type="button" data-validate="${listing.id}">Valider +100$</button>` : ""}
    </div>`;
}

function renderAdminListings() {
  const activeRows = sortedAndFilteredListings();
  $("directoryCount").textContent = activeRows.length;
  $("trashCount").textContent = state.trashListings.length;
  $("adminStats").textContent = `Catalogue serveur : ${state.adminListings.length} active(s), ${state.trashListings.length} en corbeille`;
  $("adminListings").innerHTML = activeRows.length ? activeRows.map((listing) => listingRow(listing, "active")).join("") : `<p class="note">Aucune annonce ne correspond au tri actuel.</p>`;
  $("trashListings").innerHTML = state.trashListings.length ? state.trashListings.map((listing) => listingRow(listing, "trash")).join("") : `<p class="note">La corbeille est vide.</p>`;
}

function applyDirectoryHeight(value = $("directoryHeight")?.value || 520) {
  const height = Math.max(280, Math.min(820, Number(value) || 520));
  document.documentElement.style.setProperty("--directory-list-height", `${height}px`);
  if ($("directoryHeight")) $("directoryHeight").value = height;
  if ($("directoryHeightValue")) $("directoryHeightValue").textContent = `${height}px`;
  localStorage.setItem("marketDirectoryHeight", String(height));
}

function previewListing(id, mode = "active", imageIndex = 0) {
  const source = mode === "trash" ? state.trashListings : state.adminListings;
  const listing = source.find((item) => item.id === id);
  if (!listing) return;
  const images = Array.isArray(listing.images) ? listing.images.filter(Boolean) : [];
  const selectedImage = images[imageIndex] || images[0] || "";
  $("previewEyebrow").textContent = `${listing.category} · ${listing.source}`;
  $("previewTitle").textContent = listing.title;
  $("previewImage").src = selectedImage;
  $("previewPrice").textContent = `Prix réel : ${euro.format(listing.actualPrice || 0)}`;
  $("previewLocation").textContent = listing.location || "Localisation inconnue";
  $("previewDescription").textContent = listing.description || "Aucune description détectée.";
  $("previewMeta").innerHTML = Object.entries(listing.metadata || {})
    .map(([key, value]) => `<div><span>${key}</span><strong>${value}</strong></div>`)
    .join("") || `<div><span>Statut</span><strong>${listing.validationStatus === "pending" ? "En attente" : "Validée"}</strong></div>`;
  $("previewThumbs").innerHTML = images
    .map((image, index) => `<button type="button" class="${image === selectedImage ? "active" : ""}" data-preview-thumb="${listing.id}" data-preview-mode="${mode}" data-preview-image="${index}"><img src="${image}" alt="" /></button>`)
    .join("");
  $("listingPreviewModal").classList.remove("hidden");
}

function closePreview() {
  $("listingPreviewModal").classList.add("hidden");
}

function selectedIds(kind) {
  return [...(kind === "trash" ? state.selectedTrash : state.selectedListings)];
}

async function bulkListingAction(path, ids, extra = {}) {
  if (!ids.length && !extra.all) {
    $("status").textContent = "Aucune annonce sélectionnée";
    return;
  }
  await api(path, { method: "POST", body: JSON.stringify({ ids, ...extra }) });
  await refreshAdminListings();
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}

function showError(error) {
  $("status").textContent = error.message || String(error);
}

function storedUsers() {
  return JSON.parse(localStorage.getItem("marketUsers") || "{}");
}

function saveUsers(users) {
  localStorage.setItem("marketUsers", JSON.stringify(users));
}

function saveAccount(account) {
  account.money = Number(account.money) || 0;
  account.closestWins = Number(account.closestWins) || 0;
  account.wins = Number(account.wins) || 0;
  account.guesses = Number(account.guesses) || 0;
  account.goldTickets = Number(account.goldTickets) || 0;
  state.account = account;
  localStorage.setItem("marketAccount", JSON.stringify(account));
  if (account.email) {
    const users = storedUsers();
    users[account.email] = account;
    saveUsers(users);
    fetch("/api/accounts/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account)
    }).catch(() => {});
  }
  renderAccount();
  if ($("wheelMenu") && !$("wheelMenu").classList.contains("hidden")) renderWheel();
}

function openAuth(mode = "login") {
  authMode = mode;
  $("authModal").classList.remove("hidden");
  $("authMessage").textContent = "";
  renderAuthMode();
  setTimeout(() => $("authEmail").focus(), 0);
}

function closeAuth() {
  $("authModal").classList.add("hidden");
  $("authForm").reset();
}

function renderAuthMode() {
  const isRegister = authMode === "register";
  $("authTitle").textContent = isRegister ? "Créer un compte" : "Connexion";
  $("authSubmit").textContent = isRegister ? "Créer le compte" : "Se connecter";
  $("loginTab").classList.toggle("active", !isRegister);
  $("registerTab").classList.toggle("active", isRegister);
  document.querySelector(".register-only").classList.toggle("hidden", !isRegister);
}

function renderAccount() {
  const account = state.account;
  const isAdmin = account?.username === "MMADMIN";
  if ($("openAdmin")) $("openAdmin").classList.toggle("hidden", !isAdmin);
  if (!account) {
    $("accountCard").innerHTML = `
      <div class="account-login">
        <strong>Compte joueur</strong>
        <button id="openAuth" type="button">S'inscrire / s'identifier</button>
      </div>`;
    $("openAuth").addEventListener("click", () => openAuth("login"));
    return;
  }

  const ratio = account.guesses ? Math.round((account.closestWins / account.guesses) * 100) : 0;
  if ($("createName")) $("createName").value = account.username;
  if ($("joinName")) $("joinName").value = account.username;
  $("accountCard").innerHTML = `
    <div class="account-name">
      <strong>${account.username}</strong>
      <button class="tiny secondary" id="logoutAccount" type="button">Sortir</button>
    </div>
    <div class="account-stats">
      <span>Argent ${account.money || 0}$</span>
      <span>Tickets d'or ${account.goldTickets || 0}</span>
      <span>Ratio ${ratio}%</span>
      <span>Victoires ${account.wins || 0}</span>
    </div>`;
  $("logoutAccount").addEventListener("click", () => {
    localStorage.removeItem("marketAccount");
    state.account = null;
    renderAccount();
  });
}

function savePlayer(player) {
  state.player = player;
  localStorage.setItem("marketPlayer", JSON.stringify(player));
}

function syncAccountFromRoom(room) {
  if (!state.account || !state.player) return;
  const current = room.players?.find((player) => player.id === state.player.id);
  if (!current) return;
  state.account.money = Math.max(state.account.money || 0, current.wallet || 0);
  state.account.wins = Math.max(state.account.wins || 0, current.wins || 0);
  saveAccount(state.account);
}

function recordRoundStats(round) {
  if (!state.account || !state.player || !round?.revealed) return;
  const key = `${state.room.id}-${round.number}`;
  if (state.processedRounds.has(key)) return;
  const myRank = round.results.findIndex((result) => result.playerId === state.player.id);
  if (myRank < 0) return;
  state.processedRounds.add(key);
  state.account.guesses = (state.account.guesses || 0) + 1;
  if (myRank === 0) state.account.closestWins = (state.account.closestWins || 0) + 1;
  localStorage.setItem("marketProcessedRounds", JSON.stringify([...state.processedRounds]));
  saveAccount(state.account);
}

function awardFinalWin(room) {
  if (!state.account || !state.player || room.status !== "finished") return;
  const winner = room.leaderboard?.[0];
  if (!winner || winner.id !== state.player.id) return;
  const key = `${room.id}-${room.sessionNumber || 0}`;
  if (state.processedGameWins.has(key)) return;
  state.processedGameWins.add(key);
  state.account.goldTickets = (state.account.goldTickets || 0) + 1;
  localStorage.setItem("marketProcessedGameWins", JSON.stringify([...state.processedGameWins]));
  saveAccount(state.account);
  $("status").textContent = "Partie gagnée : +1 ticket d'or";
}

function applyImportReward(reward) {
  if (!reward?.email) return;
  const users = storedUsers();
  const account = users[reward.email];
  if (account) {
    account.money = (Number(account.money) || 0) + (Number(reward.amount) || 0);
    users[reward.email] = account;
    saveUsers(users);
    if (state.account?.email === reward.email) saveAccount(account);
  }
  $("status").textContent = `${reward.username || reward.email} reçoit +${reward.amount}$ pour l'import validé.`;
}

function renderWheel() {
  const tickets = state.account?.goldTickets || 0;
  $("wheelTickets").textContent = `${tickets} ticket${tickets > 1 ? "s" : ""} d'or`;
  $("spinWheel").disabled = !state.account || tickets < 1;
  if (!state.account) $("wheelResult").textContent = "Connecte-toi à un compte joueur pour utiliser la roue.";
  else if (tickets < 1) $("wheelResult").textContent = "Gagne une partie pour recevoir 1 ticket d'or.";
}

function selectedCategories() {
  return [...$("categories").querySelectorAll("input:checked")].map((input) => input.value);
}

function setRoom(room) {
  state.room = room;
  $("home").classList.add("hidden");
  $("game").classList.remove("hidden");
  render();
  startPolling();
}

function startPolling() {
  clearInterval(state.poll);
  state.poll = setInterval(async () => {
    if (!state.room) return;
    try {
      const data = await api(`/api/rooms/${state.room.id}?playerId=${state.player?.id || ""}`);
      if (state.player && !data.room.players.some((player) => player.id === state.player.id)) {
        goHome();
        $("status").textContent = "Tu as été expulsé ou banni du salon.";
        return;
      }
      state.room = data.room;
      render();
    } catch (err) {
      $("status").textContent = err.message;
    }
  }, 1000);
}

function render() {
  const room = state.room;
  if (!room) return;
  syncAccountFromRoom(room);
  const host = isHost();
  const restartSeconds = Math.max(0, Math.ceil(((room.restartAt || 0) - Date.now()) / 1000));
  $("status").textContent =
    room.status === "lobby"
      ? "Dans le salon"
      : room.status === "finished"
        ? "Partie terminée"
        : room.status === "restarting"
          ? `Relance dans ${restartSeconds}s`
          : "Partie en cours";
  $("roomId").textContent = room.id;
  $("players").innerHTML = room.players
    .map(
      (p) => `
      <div class="player ${p.id === room.hostId ? "host-player" : ""}">
        <img src="${p.avatar}" alt="" />
        <div class="player-main"><strong>${p.name}</strong><span>${Math.round(p.score)} pts · ${p.wallet}$</span></div>
        <strong class="player-badge">${p.id === room.hostId ? "Hôte" : `${p.wins}`}</strong>
        ${host && p.id !== room.hostId ? `
          <div class="player-actions">
            <button type="button" class="tiny secondary" data-kick="${p.id}">Expulser</button>
            <button type="button" class="tiny danger-soft" data-ban="${p.id}">Bannir</button>
          </div>` : ""}
      </div>`
    )
    .join("");

  $("lobby").classList.toggle("hidden", room.status !== "lobby");
  $("round").classList.toggle("hidden", room.status !== "playing" || room.round?.revealed);
  $("results").classList.toggle("hidden", !room.round?.revealed);
  $("restarting").classList.toggle("hidden", room.status !== "restarting");
  $("finished").classList.toggle("hidden", room.status !== "finished");
  $("startGame").disabled = room.status !== "lobby";
  $("startGame").classList.toggle("hidden", !host);
  $("addBots").classList.toggle("hidden", !host || room.status !== "lobby");
  $("nextRound").textContent = room.roundIndex >= room.settings.rounds ? "Voir le classement final" : "Manche suivante";
  $("nextRound").classList.toggle("hidden", !host || !room.round?.revealed);
  $("restartSession").classList.toggle("hidden", room.status !== "finished" || !host);
  $("restartTimer").textContent = restartSeconds;
  if (room.status !== "finished") state.finalRenderKey = null;

  if (room.round && !room.round.revealed) renderRound(room.round);
  if (room.round?.revealed) {
    recordRoundStats(room.round);
    renderResults(room.round);
  }
  if (room.status === "finished") renderFinal(room);
}

function renderRound(round) {
  const listing = round.listing;
  const images = Array.isArray(listing.images) ? listing.images.filter(Boolean) : [];
  if (state.imageListingId !== listing.id) {
    state.imageListingId = listing.id;
    state.imageIndex = 0;
  }
  if (state.imageIndex >= images.length) state.imageIndex = 0;
  $("listingImage").src = images[state.imageIndex] || "";
  $("listingImage").alt = `Photo ${state.imageIndex + 1} de l'annonce ${listing.title}`;
  $("prevImage").classList.toggle("hidden", images.length <= 1);
  $("nextImage").classList.toggle("hidden", images.length <= 1);
  $("imageCount").classList.toggle("hidden", images.length <= 1);
  $("imageCount").textContent = `${state.imageIndex + 1} / ${images.length || 1}`;
  $("listingCategory").textContent = `${listing.category} · ${listing.source} · manche ${round.number}`;
  $("listingTitle").textContent = listing.title;
  $("listingDescription").textContent = state.room.settings.mode === "Expert" ? "Description masquée en mode Expert." : listing.description;
  $("listingLocation").textContent = listing.location;
  $("listingMeta").innerHTML = Object.entries(listing.metadata)
    .slice(0, state.room.settings.mode === "Expert" ? 2 : 8)
    .map(([key, value]) => `<div><span>${key}</span><strong>${value}</strong></div>`)
    .join("");
  const alreadyGuessed = round.guesses.some((g) => g.playerId === state.player?.id);
  $("guessInput").disabled = alreadyGuessed;
  $("guessForm").querySelector("button").disabled = alreadyGuessed;
  $("guessForm").querySelector("button").textContent = alreadyGuessed ? "Estimation envoyée" : "Valider";
  tickTimer(round.endsAt);
}

function moveListingImage(direction) {
  const images = state.room?.round?.listing?.images?.filter(Boolean) || [];
  if (images.length <= 1) return;
  state.imageIndex = (state.imageIndex + direction + images.length) % images.length;
  renderRound(state.room.round);
}

function tickTimer(endsAt) {
  clearInterval(state.timer);
  const update = () => {
    $("timer").textContent = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  };
  update();
  state.timer = setInterval(update, 250);
}

function renderResults(round) {
  const rating = round.listingRating || { percent: 0, count: 0 };
  const seconds = autoNextSeconds(round);
  const selectedRating = Number(localStorage.getItem(`listingVote:${round.listing.id}`) || 0);
  $("listingRatingPercent").textContent = rating.count ? `${rating.percent}%` : "--%";
  $("listingRatingCount").textContent = rating.count
    ? `${rating.count} note${rating.count > 1 ? "s" : ""} · moyenne globale`
    : "Aucune note pour le moment";
  renderRatingButtons(round.listing.id, selectedRating);
  $("realPrice").textContent = `Prix réel : ${euro.format(round.listing.actualPrice)}`;
  $("ranking").innerHTML = round.results
    .map(
      (r, index) => `
      <div class="rank-row">
        <strong>#${index + 1}</strong>
        <strong>${r.playerName}</strong>
        <span>Estimation ${euro.format(r.value)}</span>
        <span>Écart ${euro.format(r.error)}</span>
        <span>Précision ${Math.round(r.score)}%</span>
        <strong>+${r.prize}$</strong>
      </div>`
    )
    .join("");
  $("autoNextHint").textContent = isHost()
    ? `Manche suivante automatique dans ${seconds}s. L'hôte peut passer maintenant.`
    : `Manche suivante automatique dans ${seconds}s.`;
}

function renderRatingButtons(listingId, selectedRating = 0) {
  $("ratingButtons").innerHTML = [1, 2, 3, 4, 5]
    .map(
      (rating) =>
        `<button type="button" class="tiny ${selectedRating === rating ? "selected" : ""}" data-listing-id="${listingId}" data-vote-rating="${rating}">${rating}</button>`
    )
    .join("");
}

function renderFinal(room) {
  awardFinalWin(room);
  const renderKey = `${room.id}-${room.sessionNumber || 0}-${room.leaderboard.map((p) => `${p.id}:${Math.round(p.score)}`).join("|")}`;
  if (state.finalRenderKey === renderKey) return;
  state.finalRenderKey = renderKey;
  const maxScore = Math.max(1, ...room.leaderboard.map((p) => p.score || 0));
  $("finalRanking").innerHTML = `
    <div class="final-chart">
      ${room.leaderboard
    .map(
      (p, index) => {
        const percent = Math.max(6, Math.round(((p.score || 0) / maxScore) * 100));
        return `
        <div class="final-bar-row ${index === 0 ? "winner" : ""}" style="--bar-width: ${percent}%; --delay: ${index * 110}ms">
          <div class="final-rank">#${index + 1}</div>
          <div class="final-player">
            <strong>${p.name}</strong>
            <span>${p.wins} victoire${p.wins > 1 ? "s" : ""} · ${p.wallet}$ · ${p.xp} XP</span>
          </div>
          <div class="final-track" aria-hidden="true">
            <div class="final-bar"></div>
          </div>
          <strong class="final-score">${Math.round(p.score)} pts</strong>
        </div>`;
      }
    )
    .join("")}
    </div>`;
}

$("createRoom").addEventListener("click", async () => {
  try {
    const mode = $("mode").value;
    const settings = {
      rounds: Number($("rounds").value),
      roundTime: roundTimeFromForm(),
      mode,
      categories: selectedCategories()
    };
    const data = await api("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ name: $("createName").value, settings })
    });
    savePlayer(data.player);
    setRoom(data.room);
  } catch (error) {
    showError(error);
  }
});

$("joinRoom").addEventListener("click", async () => {
  try {
    const code = $("roomCode").value.trim().toUpperCase();
    const data = await api(`/api/rooms/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ name: $("joinName").value })
    });
    savePlayer(data.player);
    setRoom(data.room);
  } catch (error) {
    showError(error);
  }
});

$("addBots").addEventListener("click", async () => {
  try {
    const data = await api(`/api/rooms/${state.room.id}/bots`, {
      method: "POST",
      body: JSON.stringify({ playerId: state.player?.id })
    });
    state.room = data.room;
    render();
  } catch (error) {
    showError(error);
  }
});

$("startGame").addEventListener("click", async () => {
  try {
    const data = await api(`/api/rooms/${state.room.id}/start`, {
      method: "POST",
      body: JSON.stringify({ playerId: state.player?.id })
    });
    state.room = data.room;
    render();
  } catch (error) {
    showError(error);
  }
});

$("guessForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await api(`/api/rooms/${state.room.id}/guess`, {
      method: "POST",
      body: JSON.stringify({ playerId: state.player.id, value: $("guessInput").value })
    });
    $("guessInput").value = "";
    state.room = data.room;
    render();
  } catch (error) {
    showError(error);
  }
});

$("restartSession").addEventListener("click", async () => {
  try {
    const data = await api(`/api/rooms/${state.room.id}/restart`, {
      method: "POST",
      body: JSON.stringify({ playerId: state.player?.id })
    });
    state.room = data.room;
    render();
  } catch (error) {
    showError(error);
  }
});

$("ratingButtons").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-vote-rating]");
  if (!button || !state.player) return;
  const listingId = button.dataset.listingId;
  const rating = Number(button.dataset.voteRating);
  try {
    const data = await api("/api/listings/vote", {
      method: "POST",
      body: JSON.stringify({ listingId, playerId: state.player.id, rating })
    });
    localStorage.setItem(`listingVote:${listingId}`, String(rating));
    if (state.room?.round?.listing?.id === listingId) state.room.round.listingRating = data.rating;
    $("listingRatingPercent").textContent = data.rating.count ? `${data.rating.percent}%` : "--%";
    $("listingRatingCount").textContent = `${data.rating.count} note${data.rating.count > 1 ? "s" : ""} · moyenne globale`;
    renderRatingButtons(listingId, rating);
  } catch (error) {
    showError(error);
  }
});

$("prevImage").addEventListener("click", () => moveListingImage(-1));
$("nextImage").addEventListener("click", () => moveListingImage(1));

$("nextRound").addEventListener("click", async () => {
  try {
    const data = await api(`/api/rooms/${state.room.id}/next`, {
      method: "POST",
      body: JSON.stringify({ playerId: state.player?.id })
    });
    state.room = data.room;
    render();
  } catch (error) {
    showError(error);
  }
});

$("players").addEventListener("click", async (event) => {
  const kickButton = event.target.closest("[data-kick]");
  const banButton = event.target.closest("[data-ban]");
  const targetId = kickButton?.dataset.kick || banButton?.dataset.ban;
  if (!targetId || !state.room) return;
  try {
    const action = banButton ? "ban" : "kick";
    const data = await api(`/api/rooms/${state.room.id}/${action}`, {
      method: "POST",
      body: JSON.stringify({ playerId: state.player?.id, targetId })
    });
    state.room = data.room;
    render();
  } catch (error) {
    showError(error);
  }
});

$("roundTime").addEventListener("change", () => {
  $("customTimeWrap").classList.toggle("hidden", $("roundTime").value !== "custom");
});

$("openPlay").addEventListener("click", () => showMenu("play"));
$("openImport").addEventListener("click", () => {
  if (!state.account) {
    $("status").textContent = "Connecte-toi pour importer une annonce et recevoir la récompense.";
    openAuth("login");
    return;
  }
  showMenu("import");
});
$("openWheel").addEventListener("click", () => {
  if (!state.account) {
    $("status").textContent = "Connecte-toi pour accéder à la Roue de la chance";
    openAuth("login");
    return;
  }
  showMenu("wheel");
});
$("openAdmin").addEventListener("click", () => {
  if (state.account?.username !== "MMADMIN") {
    $("status").textContent = "Admin réservé au compte MMADMIN";
    showMenu("main");
    return;
  }
  showMenu("admin");
  $("adminGate").classList.toggle("hidden", state.adminUnlocked);
  $("adminDashboard").classList.toggle("hidden", !state.adminUnlocked);
  if (state.adminUnlocked) refreshAdminListings();
});
$("backFromPlay").addEventListener("click", () => showMenu("main"));
$("backFromImport").addEventListener("click", () => showMenu("main"));
$("backFromAdmin").addEventListener("click", () => showMenu("main"));
$("backFromWheel").addEventListener("click", () => showMenu("main"));
$("homeButton").addEventListener("click", goHome);

$("adminGate").addEventListener("submit", async (event) => {
  event.preventDefault();
  if ($("adminCode").value !== "1010") {
    $("status").textContent = "Code admin incorrect";
    return;
  }
  state.adminUnlocked = true;
  sessionStorage.setItem("marketAdminUnlocked", "true");
  $("adminGate").classList.add("hidden");
  $("adminDashboard").classList.remove("hidden");
  $("status").textContent = "Admin connecté";
  await refreshAdminListings();
});

$("refreshListings").addEventListener("click", refreshAdminListings);
$("listingSort").addEventListener("change", renderAdminListings);
$("listingFilter").addEventListener("change", renderAdminListings);
$("directoryHeight").addEventListener("input", (event) => applyDirectoryHeight(event.target.value));
$("selectAllListings").addEventListener("click", () => {
  const rows = sortedAndFilteredListings();
  const allSelected = rows.length && rows.every((listing) => state.selectedListings.has(listing.id));
  rows.forEach((listing) => {
    if (allSelected) state.selectedListings.delete(listing.id);
    else state.selectedListings.add(listing.id);
  });
  renderAdminListings();
});

$("adminListings").addEventListener("change", async (event) => {
  const selectId = event.target.getAttribute("data-select-active");
  const ratingId = event.target.getAttribute("data-rating");
  if (selectId) {
    if (event.target.checked) state.selectedListings.add(selectId);
    else state.selectedListings.delete(selectId);
  }
  if (ratingId) {
    await api("/api/listings/rating", {
      method: "POST",
      body: JSON.stringify({ id: ratingId, rating: event.target.value })
    });
    const listing = state.adminListings.find((item) => item.id === ratingId);
    if (listing) listing.rating = Number(event.target.value);
    renderAdminListings();
  }
});

$("adminListings").addEventListener("click", async (event) => {
  const previewId = event.target.closest("[data-preview]")?.dataset.preview;
  if (previewId) {
    previewListing(previewId, event.target.closest("[data-preview]")?.dataset.previewMode || "active");
    return;
  }
  const validateId = event.target.closest("[data-validate]")?.dataset.validate;
  if (!validateId) return;
  try {
    const data = await api("/api/listings/validate", {
      method: "POST",
      body: JSON.stringify({ id: validateId })
    });
    applyImportReward(data.reward);
    await refreshAdminListings();
    await refreshCatalogStatus();
  } catch (error) {
    showError(error);
  }
});

$("trashListings").addEventListener("change", (event) => {
  const selectId = event.target.getAttribute("data-select-trash");
  if (!selectId) return;
  if (event.target.checked) state.selectedTrash.add(selectId);
  else state.selectedTrash.delete(selectId);
});

$("trashListings").addEventListener("click", (event) => {
  const previewId = event.target.closest("[data-preview]")?.dataset.preview;
  if (previewId) previewListing(previewId, event.target.closest("[data-preview]")?.dataset.previewMode || "trash");
});

$("previewThumbs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-preview-thumb]");
  if (!button) return;
  previewListing(button.dataset.previewThumb, button.dataset.previewMode, Number(button.dataset.previewImage) || 0);
});

$("closePreview").addEventListener("click", closePreview);
$("listingPreviewModal").addEventListener("click", (event) => {
  if (event.target.id === "listingPreviewModal") closePreview();
});

$("trashSelected").addEventListener("click", () => bulkListingAction("/api/listings/trash", selectedIds("active")));
$("restoreSelected").addEventListener("click", () => bulkListingAction("/api/listings/restore", selectedIds("trash")));
$("deleteSelected").addEventListener("click", () => bulkListingAction("/api/listings/delete", selectedIds("trash")));
$("deleteAllTrash").addEventListener("click", () => {
  if (!state.trashListings.length) {
    $("status").textContent = "La corbeille est déjà vide";
    return;
  }
  if (confirm("Supprimer définitivement toutes les annonces dans la corbeille ?")) {
    bulkListingAction("/api/listings/delete", [], { all: true });
  }
});

$("closeAuth").addEventListener("click", closeAuth);
$("authModal").addEventListener("click", (event) => {
  if (event.target.id === "authModal") closeAuth();
});
$("loginTab").addEventListener("click", () => {
  authMode = "login";
  renderAuthMode();
});
$("registerTab").addEventListener("click", () => {
  authMode = "register";
  renderAuthMode();
});
$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("authEmail").value.trim().toLowerCase();
  const password = $("authPassword").value;
  const users = storedUsers();

  if (authMode === "register") {
    const username = $("authUsername").value.trim() || email.split("@")[0] || "Joueur";
    try {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, username, password })
      });
      users[email] = { ...data.account, password };
      saveUsers(users);
      saveAccount(data.account);
      $("status").textContent = "Compte créé";
      closeAuth();
    } catch (error) {
      $("authMessage").textContent = error.message;
    }
    return;
  }

  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, username: users[email]?.username })
    });
    users[email] = { ...data.account, password };
    saveUsers(users);
    saveAccount(data.account);
    $("status").textContent = "Connecté";
    closeAuth();
  } catch (error) {
    const localAccount = users[email];
    if (localAccount && localAccount.password === password) {
      saveAccount(localAccount);
      $("status").textContent = "Connecté";
      closeAuth();
      return;
    }
    $("authMessage").textContent = error.message || "Email ou mot de passe incorrect.";
  }
});

$("adminNotebook").value = localStorage.getItem("marketAdminNotebook") || "";
$("saveNotebook").addEventListener("click", () => {
  localStorage.setItem("marketAdminNotebook", $("adminNotebook").value);
  $("status").textContent = "Bloc note sauvegardé";
});

$("htmlImportForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.account) {
    $("status").textContent = "Connecte-toi avant d'envoyer une annonce.";
    openAuth("login");
    return;
  }
  try {
    $("status").textContent = "Extraction depuis le HTML en cours...";
    const data = await api("/api/listings/import-html", {
      method: "POST",
      body: JSON.stringify({
        html: $("htmlImportSource").value,
        importerEmail: state.account?.email || "",
        importerName: state.account?.username || ""
      })
    });
    $("status").textContent = `Annonce "${data.listing.title}" envoyée en attente de validation admin.`;
    $("htmlImportForm").reset();
    await refreshCatalogStatus();
  } catch (error) {
    showError(error);
  }
});

initCategories();
refreshCatalogStatus();
renderAccount();
applyDirectoryHeight(localStorage.getItem("marketDirectoryHeight") || 520);

$("spinWheel").addEventListener("click", () => {
  if (!state.account) {
    openAuth("login");
    return;
  }
  if ((state.account.goldTickets || 0) < 1) {
    $("wheelResult").textContent = "Il te faut 1 ticket d'or pour lancer la roue.";
    return;
  }
  const amounts = [200, 250, 300, 350, 400, 450, 500, 550, 600];
  const amount = amounts[Math.floor(Math.random() * amounts.length)];
  state.account.goldTickets -= 1;
  state.account.money = (state.account.money || 0) + amount;
  state.wheelRotation += 1080 + Math.floor(Math.random() * 720);
  $("chanceWheel").style.transform = `rotate(${state.wheelRotation}deg)`;
  $("wheelResult").textContent = `La roue s'arrête sur ${amount}$ : gain ajouté au compte.`;
  saveAccount(state.account);
});
