const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 4173;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const IMPORTED_LISTINGS_FILE = path.join(DATA_DIR, "leboncoin-listings.json");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const GLOBAL_STATS_FILE = path.join(DATA_DIR, "global-stats.json");
const ALLOW_DEMO_LISTINGS = process.env.ALLOW_DEMO_LISTINGS === "true";
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const BOOTSTRAP_ADMIN_EMAIL = String(process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_EMAILS = new Set(
  [ADMIN_EMAIL, BOOTSTRAP_ADMIN_EMAIL, ...String(process.env.ADMIN_EMAILS || "").split(",")]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || "MMADMIN").trim() || "MMADMIN";
const BOOTSTRAP_ADMIN_USERNAME = String(process.env.BOOTSTRAP_ADMIN_USERNAME || "MASTER1").trim() || "MASTER1";
const BOOTSTRAP_ADMIN_PASSWORD = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || "");

const baseListings = [
  {
    id: "immo-1",
    source: "Dataset demo",
    category: "Immobilier",
    title: "Appartement lumineux avec balcon",
    description: "Trois pieces renovees, proche tramway, cuisine equipee et cave incluse.",
    location: "Nantes, quartier approximatif",
    actualPrice: 286000,
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80"
    ],
    metadata: {
      Surface: "68 m2",
      Pieces: "3",
      Type: "Appartement",
      Energie: "C"
    }
  },
  {
    id: "auto-1",
    source: "Dataset demo",
    category: "Vehicules",
    title: "Citadine hybride tres propre",
    description: "Entretien suivi, pneus recents, quelques rayures de stationnement.",
    location: "Lyon, region approximative",
    actualPrice: 12900,
    images: [
      "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1200&q=80"
    ],
    metadata: {
      Marque: "Toyota",
      Modele: "Yaris",
      Annee: "2019",
      Kilometrage: "64 000 km",
      Carburant: "Hybride",
      Boite: "Automatique"
    }
  },
  {
    id: "tech-1",
    source: "Dataset demo",
    category: "High-Tech",
    title: "PC gaming RTX, ecran inclus",
    description: "Tour montee maison, tres bon etat, vendue avec clavier mecanique.",
    location: "Toulouse",
    actualPrice: 1180,
    images: [
      "https://images.unsplash.com/photo-1580418149728-34d5c4501879?auto=format&fit=crop&w=1200&q=80"
    ],
    metadata: {
      Etat: "Tres bon",
      Processeur: "Ryzen 7",
      GPU: "RTX 3070",
      RAM: "32 Go"
    }
  },
  {
    id: "mode-1",
    source: "Dataset demo",
    category: "Mode",
    title: "Sneakers edition limitee",
    description: "Portee deux fois, boite originale, facture disponible.",
    location: "Paris",
    actualPrice: 340,
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80"
    ],
    metadata: {
      Marque: "Nike",
      Taille: "42",
      Etat: "Excellent"
    }
  },
  {
    id: "collect-1",
    source: "Dataset demo",
    category: "Collections",
    title: "Lot de cartes retro sous classeur",
    description: "Collection familiale, plusieurs cartes brillantes, etat variable.",
    location: "Bordeaux",
    actualPrice: 760,
    images: [
      "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=1200&q=80"
    ],
    metadata: {
      Type: "Cartes",
      Etat: "Mixte",
      Quantite: "Environ 180"
    }
  },
  {
    id: "maison-1",
    source: "Dataset demo",
    category: "Maison",
    title: "Canape convertible velours",
    description: "A recuperer sur place, confortable, petites traces d'usage.",
    location: "Rennes",
    actualPrice: 420,
    images: [
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80"
    ],
    metadata: {
      Matiere: "Velours",
      Places: "3",
      Etat: "Bon"
    }
  },
  {
    id: "insolite-1",
    source: "Dataset demo",
    category: "Insolite",
    title: "Ancien distributeur de bonbons",
    description: "Objet decoratif fonctionnel, parfait pour boutique ou collection.",
    location: "Lille",
    actualPrice: 95,
    images: [
      "https://images.unsplash.com/photo-1599599810694-b5b37304c041?auto=format&fit=crop&w=1200&q=80"
    ],
    metadata: {
      Etat: "Fonctionnel",
      Hauteur: "72 cm",
      Style: "Vintage"
    }
  }
];

function buildDemoListings() {
  const blueprints = {
    Immobilier: {
      query: "apartment,house,interior",
      titles: ["Studio proche centre", "Maison familiale avec jardin", "Appartement dernier etage", "Loft renove", "T2 avec terrasse"],
      prices: [92000, 148000, 212000, 298000, 435000, 610000],
      metadata: [
        { Surface: "31 m2", Pieces: "1", Type: "Studio", Energie: "D" },
        { Surface: "82 m2", Pieces: "4", Type: "Maison", Energie: "C" },
        { Surface: "55 m2", Pieces: "2", Type: "Appartement", Energie: "B" },
        { Surface: "118 m2", Pieces: "5", Type: "Loft", Energie: "E" }
      ]
    },
    Vehicules: {
      query: "car,motorcycle,vehicle",
      titles: ["Compacte diesel entretenue", "SUV familial automatique", "Moto roadster faible kilometrage", "Utilitaire propre", "Cabriolet plaisir"],
      prices: [3900, 7800, 12600, 18900, 26500, 41900],
      metadata: [
        { Marque: "Renault", Modele: "Clio", Annee: "2018", Kilometrage: "91 000 km", Carburant: "Essence" },
        { Marque: "Peugeot", Modele: "3008", Annee: "2020", Kilometrage: "58 000 km", Carburant: "Diesel" },
        { Marque: "Yamaha", Modele: "MT-07", Annee: "2021", Kilometrage: "12 500 km", Carburant: "Essence" }
      ]
    },
    "High-Tech": {
      query: "laptop,gaming,console,smartphone",
      titles: ["Smartphone recent debloque", "Console avec deux manettes", "Laptop pro leger", "Carte graphique gaming", "Setup streaming complet"],
      prices: [180, 320, 560, 890, 1240, 1880],
      metadata: [
        { Etat: "Bon", Stockage: "128 Go", Garantie: "Non" },
        { Etat: "Excellent", Accessoires: "Chargeur, boite", Garantie: "Oui" },
        { Etat: "Tres bon", RAM: "16 Go", Stockage: "1 To" }
      ]
    },
    Mode: {
      query: "sneakers,watch,bag,fashion",
      titles: ["Sneakers collector", "Montre automatique", "Sac cuir premium", "Veste designer", "Lunettes de soleil luxe"],
      prices: [45, 120, 260, 480, 850, 1450],
      metadata: [
        { Marque: "Nike", Taille: "43", Etat: "Bon" },
        { Marque: "Seiko", Taille: "Unique", Etat: "Excellent" },
        { Marque: "Coach", Taille: "M", Etat: "Tres bon" }
      ]
    },
    Collections: {
      query: "pokemon,lego,retro,gaming,cards",
      titles: ["Lot cartes anciennes", "Set briques collector", "Console retro en boite", "Figurines sous blister", "Jeux vintage"],
      prices: [35, 95, 180, 420, 760, 1350],
      metadata: [
        { Type: "Cartes", Etat: "Variable", Quantite: "Lot" },
        { Type: "LEGO", Etat: "Complet", Boite: "Oui" },
        { Type: "Retro gaming", Etat: "Teste", Notice: "Non" }
      ]
    },
    Maison: {
      query: "furniture,garden,tools,appliance",
      titles: ["Table bois massif", "Robot cuisine complet", "Tondeuse thermique", "Canape convertible", "Lot outillage atelier"],
      prices: [60, 140, 280, 520, 910, 1600],
      metadata: [
        { Etat: "Bon", Matiere: "Bois", Retrait: "Sur place" },
        { Etat: "Tres bon", Garantie: "Non", Accessoires: "Inclus" },
        { Etat: "Usage normal", Marque: "Bosch", Retrait: "Sur place" }
      ]
    },
    Insolite: {
      query: "vintage,unusual,object,neon",
      titles: ["Objet publicitaire vintage", "Machine arcade maison", "Enseigne lumineuse", "Statue decorative", "Lot mystere de brocante"],
      prices: [25, 70, 155, 310, 690, 990],
      metadata: [
        { Etat: "Fonctionnel", Style: "Vintage", Rarete: "Peu commun" },
        { Etat: "A nettoyer", Style: "Industriel", Hauteur: "80 cm" },
        { Etat: "Bon", Style: "Brocante", Origine: "France" }
      ]
    }
  };

  const cities = ["Paris", "Lyon", "Marseille", "Toulouse", "Nantes", "Bordeaux", "Lille", "Rennes", "Nice", "Dijon", "Tours", "Montpellier"];
  const descriptions = [
    "Annonce de demonstration avec photos, informations partielles et prix masque pendant la manche.",
    "Vendeur indique un usage normal et une disponibilite rapide. Details volontairement limites pour le jeu.",
    "Produit visible sur rendez-vous, quelques traces possibles selon les photos.",
    "Annonce recente du catalogue demo et normalisee comme un flux marketplace."
  ];

  return Object.entries(blueprints).flatMap(([category, data]) =>
    Array.from({ length: 18 }, (_, index) => {
      const price = data.prices[index % data.prices.length] + ((index * 37) % 11) * Math.max(5, Math.round(data.prices[index % data.prices.length] * 0.03));
      const title = data.titles[index % data.titles.length];
      const city = cities[(index + category.length) % cities.length];
      const query = encodeURIComponent(data.query);
      return {
        id: `demo-${category.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${index + 1}`,
        source: "Catalogue demo etendu",
        category,
        title: `${title} #${index + 1}`,
        description: descriptions[index % descriptions.length],
        location: `${city}, zone approximative`,
        actualPrice: price,
        images: [`https://source.unsplash.com/1200x800/?${query}&sig=${category}-${index}`],
        metadata: data.metadata[index % data.metadata.length]
      };
    })
  );
}

const listings = [...baseListings, ...buildDemoListings()];

const rooms = new Map();
const players = new Map();
let authorizedListings = [];
let feedListings = [];
let importedListings = [];
let accounts = {};
let dbPool = null;
let globalStats = { totalGamesPlayed: 0 };
let activityFeed = [];
const listingVotes = new Map();
let authorizedListingsUpdatedAt = null;

function id(prefix = "") {
  return `${prefix}${crypto.randomBytes(4).toString("hex")}`;
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function initDatabase() {
  if (!DATABASE_URL) return;
  try {
    const { Pool } = require("pg");
    dbPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
    });
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS global_stats (
        metric TEXT PRIMARY KEY,
        value BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("PostgreSQL persistence enabled");
  } catch (error) {
    dbPool = null;
    console.warn(`PostgreSQL persistence disabled: ${error.message}`);
  }
}

async function loadServerState(key) {
  if (!dbPool) return null;
  const result = await dbPool.query("SELECT payload FROM app_state WHERE key = $1", [key]);
  return result.rows[0]?.payload || null;
}

async function saveServerState(key, payload) {
  if (!dbPool) return false;
  await dbPool.query(
    `INSERT INTO app_state (key, payload, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key)
     DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [key, JSON.stringify(payload)]
  );
  return true;
}

async function loadGlobalStats() {
  if (dbPool) {
    const result = await dbPool.query("SELECT value FROM global_stats WHERE metric = $1", ["total_games_played"]);
    globalStats.totalGamesPlayed = Number(result.rows[0]?.value) || 0;
    return;
  }

  try {
    const payload = JSON.parse(await fs.promises.readFile(GLOBAL_STATS_FILE, "utf8"));
    globalStats.totalGamesPlayed = Number(payload.totalGamesPlayed) || 0;
  } catch (error) {
    if (error.code !== "ENOENT") console.warn(`Could not load global stats: ${error.message}`);
  }
}

async function saveGlobalStats() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  await fs.promises.writeFile(GLOBAL_STATS_FILE, JSON.stringify(globalStats, null, 2), "utf8");
}

async function incrementGlobalGamesPlayed() {
  globalStats.totalGamesPlayed += 1;
  if (dbPool) {
    const result = await dbPool.query(
      `INSERT INTO global_stats (metric, value, updated_at)
       VALUES ($1, 1, NOW())
       ON CONFLICT (metric)
       DO UPDATE SET value = global_stats.value + 1, updated_at = NOW()
       RETURNING value`,
      ["total_games_played"]
    );
    globalStats.totalGamesPlayed = Number(result.rows[0]?.value) || globalStats.totalGamesPlayed;
    return globalStats.totalGamesPlayed;
  }

  await saveGlobalStats();
  return globalStats.totalGamesPlayed;
}

async function loadActivityFeed() {
  const stored = await loadServerState("activity-feed");
  if (stored) {
    const rows = Array.isArray(stored) ? stored : stored.items;
    activityFeed = Array.isArray(rows) ? rows.slice(0, 80) : [];
    return;
  }
}

async function saveActivityFeed() {
  await saveServerState("activity-feed", { items: activityFeed });
}

async function pushFeed(type, username, detail = "") {
  if (!username) return;
  activityFeed.unshift({
    id: id("feed_"),
    type,
    username: String(username).slice(0, 24),
    detail: String(detail || "").slice(0, 90),
    createdAt: new Date().toISOString()
  });
  activityFeed = activityFeed.slice(0, 80);
  await saveActivityFeed();
}

function publicAccount(account) {
  if (!account) return null;
  return {
    email: account.email,
    username: account.username,
    isAdmin: ADMIN_EMAILS.has(account.email),
    sessionToken: account.sessionToken || "",
    money: Number(account.money) || 0,
    closestWins: Number(account.closestWins) || 0,
    wins: Number(account.wins) || 0,
    guesses: Number(account.guesses) || 0,
    goldTickets: Number(account.goldTickets) || 0
  };
}

function publicMember(account) {
  const bannedUntil = account.bannedUntil || "";
  const isPermanent = bannedUntil === "forever";
  const isTimed = bannedUntil && !isPermanent && new Date(bannedUntil).getTime() > Date.now();
  return {
    email: account.email,
    username: account.username,
    isAdmin: ADMIN_EMAILS.has(account.email),
    money: Number(account.money) || 0,
    closestWins: Number(account.closestWins) || 0,
    wins: Number(account.wins) || 0,
    guesses: Number(account.guesses) || 0,
    goldTickets: Number(account.goldTickets) || 0,
    createdAt: account.createdAt || "",
    bannedUntil,
    banReason: account.banReason || "",
    isBanned: Boolean(isPermanent || isTimed)
  };
}

function normalizeAccount(raw = {}) {
  const email = String(raw.email || "").trim().toLowerCase();
  const username = ADMIN_EMAILS.has(email) ? (raw.username || ADMIN_USERNAME) : String(raw.username || email.split("@")[0] || "Joueur").slice(0, 18);
  return {
    email,
    username,
    password: String(raw.password || ""),
    passwordHash: String(raw.passwordHash || raw.password_hash || ""),
    sessionToken: String(raw.sessionToken || raw.session_token || ""),
    createdAt: String(raw.createdAt || raw.created_at || new Date().toISOString()),
    bannedUntil: String(raw.bannedUntil || raw.banned_until || ""),
    banReason: String(raw.banReason || raw.ban_reason || ""),
    money: Number(raw.money) || 0,
    closestWins: Number(raw.closestWins) || 0,
    wins: Number(raw.wins) || 0,
    guesses: Number(raw.guesses) || 0,
    goldTickets: Number(raw.goldTickets) || 0,
    processedEvents: raw.processedEvents && typeof raw.processedEvents === "object" ? raw.processedEvents : {}
  };
}

function newSessionToken() {
  return crypto.randomBytes(24).toString("hex");
}

function verifySession(account, token) {
  return Boolean(account?.sessionToken && token && account.sessionToken === String(token));
}

function isAccountBanned(account) {
  if (!account?.bannedUntil) return false;
  if (account.bannedUntil === "forever") return true;
  const until = new Date(account.bannedUntil).getTime();
  if (Number.isNaN(until)) return false;
  if (until > Date.now()) return true;
  account.bannedUntil = "";
  account.banReason = "";
  saveAccounts().catch((error) => console.warn(`Could not clear expired ban: ${error.message}`));
  return false;
}

function adminFromBody(body = {}) {
  const email = String(body.adminEmail || body.email || "").trim().toLowerCase();
  const account = accounts[email];
  if (!account || !ADMIN_EMAILS.has(account.email) || !verifySession(account, body.sessionToken)) return null;
  return account;
}

function adminFromQuery(url) {
  const email = String(url.searchParams.get("adminEmail") || "").trim().toLowerCase();
  const account = accounts[email];
  if (!account || !ADMIN_EMAILS.has(account.email) || !verifySession(account, url.searchParams.get("sessionToken"))) return null;
  return account;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(account, password) {
  const candidate = String(password || "");
  if (account.passwordHash) {
    const [salt, expected] = account.passwordHash.split(":");
    if (!salt || !expected) return false;
    const actual = crypto.scryptSync(candidate, salt, 64);
    const expectedBuffer = Buffer.from(expected, "hex");
    return expectedBuffer.length === actual.length && crypto.timingSafeEqual(expectedBuffer, actual);
  }
  return Boolean(account.password && account.password === candidate);
}

function migratePasswordHash(account, password) {
  if (account.passwordHash) return false;
  account.passwordHash = hashPassword(password);
  account.password = "";
  return true;
}

async function migrateStoredAccountPasswords() {
  let changed = false;
  Object.values(accounts).forEach((account) => {
    if (account.password && !account.passwordHash) {
      account.passwordHash = hashPassword(account.password);
      account.password = "";
      changed = true;
    }
  });
  if (changed) {
    await saveAccounts();
    console.log("Migrated legacy account passwords to hashes");
  }
}

async function ensureBootstrapAdmin() {
  if (!BOOTSTRAP_ADMIN_EMAIL || !BOOTSTRAP_ADMIN_PASSWORD) return;
  if (BOOTSTRAP_ADMIN_PASSWORD.length < 10) {
    console.warn("Bootstrap admin ignored: password must be at least 10 characters");
    return;
  }
  const existing = accounts[BOOTSTRAP_ADMIN_EMAIL];
  if (existing) {
    let changed = false;
    if (existing.username !== BOOTSTRAP_ADMIN_USERNAME) {
      existing.username = BOOTSTRAP_ADMIN_USERNAME;
      changed = true;
    }
    existing.passwordHash = hashPassword(BOOTSTRAP_ADMIN_PASSWORD);
    existing.password = "";
    changed = true;
    if (changed) await saveAccounts();
    return;
  }

  accounts[BOOTSTRAP_ADMIN_EMAIL] = normalizeAccount({
    email: BOOTSTRAP_ADMIN_EMAIL,
    username: BOOTSTRAP_ADMIN_USERNAME,
    passwordHash: hashPassword(BOOTSTRAP_ADMIN_PASSWORD)
  });
  await saveAccounts();
  console.log(`Bootstrap admin created: ${BOOTSTRAP_ADMIN_USERNAME}`);
}

function eventAlreadyApplied(account, eventId) {
  if (!eventId) return false;
  account.processedEvents ||= {};
  if (account.processedEvents[eventId]) return true;
  account.processedEvents[eventId] = new Date().toISOString();
  const entries = Object.entries(account.processedEvents).slice(-500);
  account.processedEvents = Object.fromEntries(entries);
  return false;
}

async function loadAccounts() {
  const stored = await loadServerState("accounts");
  if (stored) {
    accounts = Object.fromEntries(
      Object.entries(stored.accounts || stored || {})
        .map(([email, account]) => [email.toLowerCase(), normalizeAccount({ ...account, email: account.email || email })])
        .filter(([email]) => email)
    );
    console.log(`Loaded ${Object.keys(accounts).length} player accounts from PostgreSQL`);
    await migrateStoredAccountPasswords();
    return;
  }

  try {
    const payload = JSON.parse(await fs.promises.readFile(ACCOUNTS_FILE, "utf8"));
    accounts = Object.fromEntries(
      Object.entries(payload.accounts || payload || {})
        .map(([email, account]) => [email.toLowerCase(), normalizeAccount({ ...account, email: account.email || email })])
        .filter(([email]) => email)
    );
    console.log(`Loaded ${Object.keys(accounts).length} player accounts`);
    await migrateStoredAccountPasswords();
    if (dbPool) await saveAccounts();
  } catch (error) {
    if (error.code !== "ENOENT") console.warn(`Could not load accounts: ${error.message}`);
  }
}

async function saveAccounts() {
  if (await saveServerState("accounts", { accounts })) return;
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  await fs.promises.writeFile(ACCOUNTS_FILE, JSON.stringify({ accounts }, null, 2), "utf8");
}

async function creditAccount(email, amount) {
  const key = String(email || "").trim().toLowerCase();
  if (!key || !accounts[key]) return null;
  accounts[key].money = (Number(accounts[key].money) || 0) + amount;
  await saveAccounts();
  return publicAccount(accounts[key]);
}

function publicListing(listing) {
  const { actualPrice, ...safe } = listing;
  return safe;
}

function createPlayer(name) {
  const player = {
    id: id("p_"),
    name: String(name || "Joueur").slice(0, 18),
    avatar: `https://api.dicebear.com/8.x/thumbs/svg?seed=${encodeURIComponent(name || "market")}`,
    wallet: 0,
    xp: 0,
    score: 0,
    wins: 0,
    streak: 0,
    ready: false
  };
  players.set(player.id, player);
  return player;
}

function normalizedName(name = "") {
  return String(name).trim().toLowerCase();
}

function removePlayerFromRoom(room, playerId) {
  room.playerIds = room.playerIds.filter((id) => id !== playerId);
  if (room.round) {
    room.round.guesses = room.round.guesses.filter((guess) => guess.playerId !== playerId);
  }
}

function createRoom(host, settings) {
  const room = {
    id: id("r_").slice(0, 6).toUpperCase(),
    hostId: host.id,
    status: "lobby",
    settings: {
      rounds: Number(settings.rounds) || 5,
      roundTime: Number(settings.roundTime) || 30,
      mode: settings.mode || "Classique",
      categories: Array.isArray(settings.categories) && settings.categories.length ? settings.categories : ["all"],
      isPublic: Boolean(settings.isPublic)
    },
    playerIds: [host.id],
    bannedNames: [],
    roundIndex: 0,
    round: null,
    history: [],
    leaderboard: [],
    sessionNumber: 0,
    recentListingIds: []
  };
  rooms.set(room.id, room);
  return room;
}

function roomState(room, viewerId) {
  maybeStartScheduledSession(room);
  const round = room.round;
  return {
    ...room,
    players: room.playerIds.map((pid) => players.get(pid)).filter(Boolean),
    round: round
      ? {
          ...round,
          listing: round.revealed ? round.listing : publicListing(round.listing),
          guesses: round.revealed || viewerId === room.hostId ? round.guesses : round.guesses.map((g) => ({ playerId: g.playerId }))
        }
      : null
  };
}

function normalizeListing(raw, index = 0) {
  const images = Array.isArray(raw.images) ? raw.images.filter(Boolean) : [];
  const actualPrice = Number(raw.actual_price ?? raw.actualPrice ?? raw.price);
  if (!Number.isFinite(actualPrice) || actualPrice <= 0 || images.length === 0) return null;

  return {
    id: String(raw.id || `feed-${index}-${crypto.createHash("sha1").update(`${raw.title}-${actualPrice}`).digest("hex").slice(0, 10)}`),
    source: String(raw.source || "Flux autorise"),
    category: String(raw.category || "Insolite"),
    title: String(raw.title || "Annonce sans titre").slice(0, 120),
    description: String(raw.description || "").slice(0, 420),
    location: String(raw.location || "Localisation approximative"),
    actualPrice,
    images,
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    rating: Math.max(0, Math.min(5, Number(raw.rating) || 0)),
    trashedAt: raw.trashedAt || raw.trashed_at || null,
    validationStatus: raw.validationStatus || raw.validation_status || "approved",
    validatedAt: raw.validatedAt || raw.validated_at || null,
    importerEmail: raw.importerEmail || raw.importer_email || "",
    importerName: raw.importerName || raw.importer_name || "",
    rewardGranted: Boolean(raw.rewardGranted || raw.reward_granted),
    metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {}
  };
}

function htmlDecode(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value = "") {
  return htmlDecode(String(value).replace(/<[^>]*>/g, " "));
}

function stripPriceFromTitle(title = "") {
  return htmlDecode(title)
    .replace(/\b\d[\d\s.,]*\s*(€|EUR)\b/gi, "")
    .replace(/\s[-|,]\s*Leboncoin.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i")
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return htmlDecode(match[1]);
    }
  }
  return "";
}

function extractPageUrl(html) {
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  const reverseCanonical = html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
  return htmlDecode(
    extractMeta(html, ["og:url", "twitter:url"]) ||
      canonical?.[1] ||
      reverseCanonical?.[1] ||
      ""
  );
}

function findPrice(value = "") {
  const text = htmlDecode(value);
  const match = text.match(/(\d[\d\s.,]{0,12})\s*(?:€|EUR)/i);
  if (!match) return 0;
  const normalized = match[1].replace(/\s/g, "").replace(",", ".");
  return Math.round(Number(normalized)) || 0;
}

function extractJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(htmlDecode(block[1]));
      const candidates = Array.isArray(parsed) ? parsed : [parsed, ...(parsed["@graph"] || [])];
      const object = candidates.find((item) => item && typeof item === "object" && (item.offers || item.image || item.name));
      if (object) return object;
    } catch {
      // Ignore malformed structured data and continue with meta tags.
    }
  }
  return {};
}

function guessCategory(title = "", description = "") {
  const text = `${title} ${description}`.toLowerCase();
  if (/appartement|maison|studio|terrain|loyer|m2|pi[eè]ces/.test(text)) return "Immobilier";
  if (/voiture|moto|van|utilitaire|renault|peugeot|citroen|bmw|audi|km|diesel|essence/.test(text)) return "Vehicules";
  if (/iphone|samsung|pc|ordinateur|console|ps5|xbox|carte graphique|macbook/.test(text)) return "High-Tech";
  if (/nike|adidas|sneakers|sac|montre|taille|veste/.test(text)) return "Mode";
  if (/pokemon|lego|figurine|collection|retro|cartes/.test(text)) return "Collections";
  if (/canape|table|jardin|outil|four|frigo|meuble/.test(text)) return "Maison";
  return "Insolite";
}

function parseLeboncoinHtml(html, sourceUrl = "") {
  const jsonLd = extractJsonLd(html);
  const detectedUrl = sourceUrl || extractPageUrl(html);
  const title = stripPriceFromTitle(jsonLd.name || extractMeta(html, ["og:title", "twitter:title"]) || "");
  const description = stripTags(jsonLd.description || extractMeta(html, ["og:description", "description", "twitter:description"]) || "");
  const imageValue = jsonLd.image || extractMeta(html, ["og:image", "twitter:image"]);
  const images = (Array.isArray(imageValue) ? imageValue : [imageValue]).filter(Boolean).map(htmlDecode);
  const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
  const actualPrice = Number(offers?.price) || findPrice(extractMeta(html, ["og:title", "twitter:title"])) || findPrice(html);
  const address = jsonLd.address || jsonLd.areaServed || {};
  const location = htmlDecode(
    [address.addressLocality, address.addressRegion].filter(Boolean).join(", ") ||
      extractMeta(html, ["og:locality", "geo.placename"]) ||
      "Localisation non détectée"
  );

  return normalizeListing({
    id: `lbc-${crypto.createHash("sha1").update(detectedUrl || `${title}-${actualPrice}-${images[0]}`).digest("hex").slice(0, 12)}`,
    source: "Leboncoin - import automatique",
    category: guessCategory(title, description),
    title,
    description,
    location,
    actualPrice,
    images,
    metadata: {}
  });
}

function rebuildAuthorizedListings() {
  authorizedListings = [...importedListings, ...feedListings].filter(
    (listing) => !listing.trashedAt && listing.validationStatus !== "pending"
  );
  authorizedListingsUpdatedAt = authorizedListings.length ? new Date().toISOString() : authorizedListingsUpdatedAt;
}

async function loadImportedListings() {
  const stored = await loadServerState("listings");
  if (stored) {
    const rows = Array.isArray(stored) ? stored : stored.listings;
    importedListings = Array.isArray(rows) ? rows.map(normalizeListing).filter(Boolean) : [];
    rebuildAuthorizedListings();
    console.log(`Loaded ${importedListings.length} imported Leboncoin listings from PostgreSQL`);
    return;
  }

  try {
    const payload = JSON.parse(await fs.promises.readFile(IMPORTED_LISTINGS_FILE, "utf8"));
    const rows = Array.isArray(payload) ? payload : payload.listings;
    importedListings = Array.isArray(rows) ? rows.map(normalizeListing).filter(Boolean) : [];
    rebuildAuthorizedListings();
    console.log(`Loaded ${importedListings.length} imported Leboncoin listings`);
    if (dbPool) await saveImportedListings();
  } catch (error) {
    if (error.code !== "ENOENT") console.warn(`Could not load imported listings: ${error.message}`);
  }
}

async function saveImportedListings() {
  if (await saveServerState("listings", { listings: importedListings })) return;
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  await fs.promises.writeFile(
    IMPORTED_LISTINGS_FILE,
    JSON.stringify({ listings: importedListings }, null, 2),
    "utf8"
  );
}

async function refreshAuthorizedListings() {
  const feedUrl = process.env.LISTINGS_FEED_URL;
  const feedFile = process.env.LISTINGS_FEED_FILE;
  if (!feedUrl && !feedFile) return;

  try {
    let payload;
    if (feedFile) {
      const filePath = path.resolve(feedFile);
      payload = JSON.parse(await fs.promises.readFile(filePath, "utf8"));
    } else {
      const response = await fetch(feedUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json();
    }
    const rows = Array.isArray(payload) ? payload : payload.listings;
    if (!Array.isArray(rows)) throw new Error("Le flux doit etre un tableau ou { listings: [] }");
    feedListings = rows.map(normalizeListing).filter(Boolean);
    rebuildAuthorizedListings();
    console.log(`Loaded ${feedListings.length} authorized listings from ${feedFile || feedUrl}`);
  } catch (error) {
    console.warn(`Could not refresh authorized listings: ${error.message}`);
  }
}

function availableListings() {
  const source = ALLOW_DEMO_LISTINGS ? [...authorizedListings, ...listings] : authorizedListings;
  return source.filter((listing) => !listing.trashedAt && Array.isArray(listing.images) && listing.images.length > 0);
}

function pickListing(room) {
  let pool = availableListings();
  const selected = room.settings.categories;
  if (!selected.includes("all")) {
    pool = pool.filter((listing) => selected.includes(listing.category));
  }
  if (room.settings.mode === "Chaos") {
    pool = availableListings();
  }

  if (pool.length === 0) return null;

  const recentIds = new Set(room.recentListingIds);
  let finalPool = pool.filter((listing) => !recentIds.has(listing.id));
  if (!finalPool.length) {
    const keepCount = Math.max(0, Math.min(room.recentListingIds.length, pool.length - 1));
    const softenedRecentIds = new Set(room.recentListingIds.slice(-keepCount));
    finalPool = pool.filter((listing) => !softenedRecentIds.has(listing.id));
  }
  if (!finalPool.length) finalPool = pool;
  const picked = finalPool[Math.floor(Math.random() * finalPool.length)];

  room.recentListingIds.push(picked.id);
  const maxRecent = Math.min(Math.max(pool.length - 1, Math.floor(pool.length * 0.9), 10), 200);
  room.recentListingIds = room.recentListingIds.slice(-maxRecent);
  return picked;
}

function startRound(room, options = {}) {
  if (options.newSession) {
    room.sessionNumber += 1;
    room.roundIndex = 0;
    room.round = null;
    room.history = [];
    room.leaderboard = [];
  }
  const listing = pickListing(room);
  if (!listing) return false;
  if (options.newSession) {
    incrementGlobalGamesPlayed().catch((error) => {
      console.warn(`Could not update global games counter: ${error.message}`);
    });
  }
  room.status = "playing";
  room.restartAt = null;
  room.roundIndex += 1;
  room.round = {
    number: room.roundIndex,
    listing,
    startedAt: Date.now(),
    endsAt: Date.now() + room.settings.roundTime * 1000,
    guesses: [],
    revealed: false,
    results: []
  };
  return true;
}

function scoreGuess(realPrice, guess) {
  const percentError = Math.abs(guess - realPrice) / realPrice * 100;
  return Math.max(0, Math.round((100 - percentError) * 100) / 100);
}

function prizeFromScore(score) {
  return Math.max(0, Math.min(50, Math.round((score / 100) * 50)));
}

function revealRound(room) {
  if (!room.round || room.round.revealed) return;
  const realPrice = room.round.listing.actualPrice;
  const results = room.round.guesses
    .map((guess) => ({
      ...guess,
      realPrice,
      error: Math.abs(guess.value - realPrice),
      score: scoreGuess(realPrice, guess.value)
    }))
    .sort((a, b) => a.error - b.error);

  results.forEach((result, index) => {
    const player = players.get(result.playerId);
    const prize = prizeFromScore(result.score);
    if (!player) return;
    player.score += result.score + (index === 0 ? 10 : 0);
    player.wallet += prize;
    player.xp += Math.round(result.score);
    player.wins += index === 0 ? 1 : 0;
    player.streak = index === 0 ? player.streak + 1 : 0;
    result.prize = prize;
    result.playerName = player.name;
  });

  room.round.revealed = true;
  room.round.revealedAt = Date.now();
  room.round.results = results;
  room.round.listingRating = listingRating(room.round.listing.id);
  room.history.push({
    number: room.round.number,
    title: room.round.listing.title,
    category: room.round.listing.category,
    realPrice,
    results
  });
  room.leaderboard = room.playerIds
    .map((pid) => players.get(pid))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

function scheduleRestart(room) {
  room.status = "restarting";
  room.restartAt = Date.now() + 15000;
  room.round = null;
}

function maybeStartScheduledSession(room) {
  if (room.status !== "restarting" || !room.restartAt || Date.now() < room.restartAt) return;
  startRound(room, { newSession: true });
}

function listingRating(listingId) {
  const votes = listingVotes.get(listingId) || [];
  const average = votes.length ? votes.reduce((sum, vote) => sum + vote.rating, 0) / votes.length : 0;
  return {
    average,
    percent: Math.round((average / 5) * 100),
    count: votes.length
  };
}

function maybeAdvance(room) {
  if (!room.round) return;
  if (room.round.revealed) {
    if (Date.now() >= (room.round.revealedAt || Date.now()) + 20000) finishOrNext(room);
    return;
  }
  const allAnswered = room.round.guesses.length >= room.playerIds.length;
  if (Date.now() >= room.round.endsAt || allAnswered) revealRound(room);
}

function finishOrNext(room) {
  if (room.roundIndex >= room.settings.rounds) {
    room.status = "finished";
    room.round = null;
    return true;
  } else {
    return startRound(room);
  }
}

function serveStatic(req, res) {
  const urlPath = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
    res.writeHead(200, { "Content-Type": `${types[ext] || "text/plain"}; charset=utf-8` });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, {
      ok: true,
      listings: availableListings().length,
      rooms: rooms.size,
      updatedAt: new Date().toISOString()
    });
  }
  if (!url.pathname.startsWith("/api/")) return serveStatic(req, res);

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readBody(req);
    const account = normalizeAccount(body);
    if (!account.email || !account.email.includes("@")) return json(res, 400, { error: "Email invalide" });
    if (!account.password || account.password.length < 4) return json(res, 400, { error: "Mot de passe trop court" });
    if (accounts[account.email]) return json(res, 409, { error: "Un compte existe déjà avec cet email" });
    account.passwordHash = hashPassword(account.password);
    account.password = "";
    account.sessionToken = newSessionToken();
    accounts[account.email] = account;
    await saveAccounts();
    await pushFeed("signup", account.username, "vient de s'inscrire");
    return json(res, 201, { account: publicAccount(account) });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    let account = accounts[email];
    if (!account && email && email.includes("@") && String(body.password || "").length >= 4) {
      account = normalizeAccount({ email, password: body.password, username: body.username || email.split("@")[0] });
      account.passwordHash = hashPassword(body.password);
      account.password = "";
      accounts[email] = account;
      await saveAccounts();
    }
    if (!account || !verifyPassword(account, body.password)) {
      return json(res, 401, { error: "Email ou mot de passe incorrect" });
    }
    if (isAccountBanned(account)) {
      return json(res, 403, {
        error: account.bannedUntil === "forever"
          ? "Compte banni définitivement"
          : `Compte banni jusqu'au ${new Date(account.bannedUntil).toLocaleString("fr-FR")}`
      });
    }
    let changed = migratePasswordHash(account, body.password);
    if (email === ADMIN_EMAIL && account.username !== ADMIN_USERNAME) {
      account.username = ADMIN_USERNAME;
      changed = true;
    }
    if (email === BOOTSTRAP_ADMIN_EMAIL && account.username !== BOOTSTRAP_ADMIN_USERNAME) {
      account.username = BOOTSTRAP_ADMIN_USERNAME;
      changed = true;
    }
    account.sessionToken = newSessionToken();
    changed = true;
    if (changed) await saveAccounts();
    return json(res, 200, { account: publicAccount(account) });
  }

  if (req.method === "POST" && url.pathname === "/api/accounts/update") {
    const body = await readBody(req);
    const incoming = normalizeAccount(body);
    if (!incoming.email || !accounts[incoming.email]) return json(res, 404, { error: "Compte introuvable" });
    const current = accounts[incoming.email];
    if (!verifySession(current, body.sessionToken)) return json(res, 401, { error: "Session invalide" });
    accounts[incoming.email] = {
      ...current,
      username: incoming.username || current.username,
      money: Number(current.money) || 0,
      closestWins: Number(current.closestWins) || 0,
      wins: Number(current.wins) || 0,
      guesses: Number(current.guesses) || 0,
      goldTickets: Number(current.goldTickets) || 0
    };
    await saveAccounts();
    return json(res, 200, { account: publicAccount(accounts[incoming.email]) });
  }

  if (req.method === "GET" && url.pathname.match(/^\/api\/accounts\/[^/]+$/)) {
    const email = decodeURIComponent(url.pathname.split("/")[3] || "").trim().toLowerCase();
    const account = accounts[email];
    if (!account) return json(res, 404, { error: "Compte introuvable" });
    if (!verifySession(account, url.searchParams.get("sessionToken"))) return json(res, 401, { error: "Session invalide" });
    return json(res, 200, { account: publicAccount(account) });
  }

  if (req.method === "POST" && url.pathname === "/api/accounts/stats") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const account = accounts[email];
    if (!account) return json(res, 404, { error: "Compte introuvable" });
    if (!verifySession(account, body.sessionToken)) return json(res, 401, { error: "Session invalide" });
    const eventId = String(body.eventId || "");
    if (!eventAlreadyApplied(account, eventId)) {
      if (body.type === "round") {
        account.money = (Number(account.money) || 0) + Math.max(0, Number(body.money) || 0);
        account.guesses = (Number(account.guesses) || 0) + 1;
        if (body.closest) account.closestWins = (Number(account.closestWins) || 0) + 1;
      }
      if (body.type === "game-win") {
        account.wins = (Number(account.wins) || 0) + 1;
        account.goldTickets = (Number(account.goldTickets) || 0) + 1;
        await pushFeed("win", account.username, "a gagné une partie");
      }
      await saveAccounts();
    }
    return json(res, 200, { account: publicAccount(account) });
  }

  if (req.method === "POST" && url.pathname === "/api/accounts/spin-wheel") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const account = accounts[email];
    if (!account) return json(res, 404, { error: "Compte introuvable" });
    if (!verifySession(account, body.sessionToken)) return json(res, 401, { error: "Session invalide" });
    if ((Number(account.goldTickets) || 0) < 1) return json(res, 409, { error: "Il te faut 1 ticket d'or pour lancer la roue." });
    const amounts = [200, 250, 300, 350, 400, 450, 500, 550, 600];
    const amount = amounts[Math.floor(Math.random() * amounts.length)];
    account.goldTickets = (Number(account.goldTickets) || 0) - 1;
    account.money = (Number(account.money) || 0) + amount;
    await saveAccounts();
    return json(res, 200, { amount, account: publicAccount(account) });
  }

  if (req.method === "POST" && url.pathname === "/api/rooms") {
    const body = await readBody(req);
    const player = createPlayer(body.name);
    const room = createRoom(player, body.settings || {});
    return json(res, 201, { player, room: roomState(room, player.id) });
  }

  if (req.method === "GET" && url.pathname === "/api/listings/status") {
    return json(res, 200, {
      total: availableListings().length,
      storage: dbPool ? "postgresql" : "server-file",
      sharedCatalog: true,
      persistence: dbPool ? "DATABASE_URL" : "data/leboncoin-listings.json",
      persistentOnRender: Boolean(dbPool),
      demo: ALLOW_DEMO_LISTINGS ? listings.length : 0,
      demoAvailableIfEnabled: listings.length,
      demoEnabled: ALLOW_DEMO_LISTINGS,
      authorized: authorizedListings.length,
      imported: importedListings.length,
      feed: feedListings.length,
      authorizedListingsUpdatedAt,
      feedConfigured: Boolean(process.env.LISTINGS_FEED_URL || process.env.LISTINGS_FEED_FILE),
      realFeedActive: authorizedListings.length > 0,
      imageOnly: true,
      antiRepeatPerRoom: true
    });
  }

  if (req.method === "GET" && url.pathname === "/api/global-stats") {
    return json(res, 200, {
      totalGamesPlayed: Number(globalStats.totalGamesPlayed) || 0,
      storage: dbPool ? "postgresql" : "server-file",
      synchronized: true
    });
  }

  if (req.method === "GET" && url.pathname === "/api/feed") {
    return json(res, 200, { items: activityFeed.slice(0, 30) });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/members") {
    if (!adminFromQuery(url)) return json(res, 403, { error: "Admin requis" });
    const members = Object.values(accounts)
      .map(publicMember)
      .sort((a, b) => a.username.localeCompare(b.username, "fr"));
    return json(res, 200, {
      members: members.filter((member) => !member.isBanned),
      banned: members.filter((member) => member.isBanned)
    });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/ban") {
    const body = await readBody(req);
    const admin = adminFromBody(body);
    if (!admin) return json(res, 403, { error: "Admin requis" });
    const email = String(body.targetEmail || "").trim().toLowerCase();
    const target = accounts[email];
    if (!target) return json(res, 404, { error: "Membre introuvable" });
    if (ADMIN_EMAILS.has(target.email)) return json(res, 400, { error: "Impossible de bannir un administrateur" });
    const permanent = Boolean(body.permanent);
    const minutes = Math.max(1, Math.min(525600, Number(body.minutes) || 60));
    target.bannedUntil = permanent ? "forever" : new Date(Date.now() + minutes * 60 * 1000).toISOString();
    target.banReason = String(body.reason || "Banni par admin").slice(0, 140);
    target.sessionToken = "";
    await saveAccounts();
    await pushFeed("ban", target.username, permanent ? "a été banni définitivement" : `a été banni ${minutes} min`);
    return json(res, 200, { member: publicMember(target) });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/unban") {
    const body = await readBody(req);
    const admin = adminFromBody(body);
    if (!admin) return json(res, 403, { error: "Admin requis" });
    const email = String(body.targetEmail || "").trim().toLowerCase();
    const target = accounts[email];
    if (!target) return json(res, 404, { error: "Membre introuvable" });
    target.bannedUntil = "";
    target.banReason = "";
    await saveAccounts();
    await pushFeed("unban", target.username, "a été débanni");
    return json(res, 200, { member: publicMember(target) });
  }

  if (req.method === "GET" && url.pathname === "/api/listings") {
    const includeTrash = url.searchParams.get("trash") === "1";
    const source = includeTrash ? importedListings.filter((listing) => listing.trashedAt) : importedListings.filter((listing) => !listing.trashedAt);
    return json(res, 200, {
      listings: source.map((listing) => ({
        id: listing.id,
        source: listing.source,
        category: listing.category,
        title: listing.title,
        description: listing.description,
        location: listing.location,
        actualPrice: listing.actualPrice,
        images: listing.images,
        metadata: listing.metadata || {},
        createdAt: listing.createdAt,
        rating: listing.rating || 0,
        trashedAt: listing.trashedAt || null,
        validationStatus: listing.validationStatus || "approved",
        importerName: listing.importerName || "",
        rewardGranted: Boolean(listing.rewardGranted)
      }))
    });
  }

  if (req.method === "POST" && url.pathname === "/api/listings/validate") {
    const body = await readBody(req);
    const listing = importedListings.find((item) => item.id === body.id);
    if (!listing) return json(res, 404, { error: "Annonce introuvable" });
    if (listing.trashedAt) return json(res, 409, { error: "Cette annonce est dans la corbeille" });

    const reward = !listing.rewardGranted && listing.importerEmail
      ? {
          email: listing.importerEmail,
          username: listing.importerName,
          amount: 100,
          reason: "Import Leboncoin validé"
        }
      : null;

    listing.validationStatus = "approved";
    listing.validatedAt = new Date().toISOString();
    if (reward) {
      listing.rewardGranted = true;
      await creditAccount(reward.email, reward.amount);
    }
    rebuildAuthorizedListings();
    await saveImportedListings();
    return json(res, 200, {
      listing,
      reward: reward ? { amount: reward.amount, username: reward.username } : null,
      total: authorizedListings.length
    });
  }

  if (req.method === "POST" && url.pathname === "/api/listings/rating") {
    const body = await readBody(req);
    const listing = importedListings.find((item) => item.id === body.id);
    if (!listing) return json(res, 404, { error: "Annonce introuvable ou non modifiable" });
    listing.rating = Math.max(0, Math.min(5, Number(body.rating) || 0));
    rebuildAuthorizedListings();
    await saveImportedListings();
    return json(res, 200, { listing });
  }

  if (req.method === "POST" && url.pathname === "/api/listings/vote") {
    const body = await readBody(req);
    const listingId = String(body.listingId || "");
    const playerId = String(body.playerId || "");
    const ratingValue = Number(body.rating);
    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return json(res, 400, { error: "La note doit etre comprise entre 1 et 5" });
    }
    const rating = Math.round(ratingValue);
    const listing = availableListings().find((item) => item.id === listingId);
    if (!listing) return json(res, 404, { error: "Annonce introuvable" });
    if (!playerId) return json(res, 400, { error: "Joueur introuvable" });

    const previousVotes = listingVotes.get(listingId) || [];
    const votes = previousVotes.filter((vote) => vote.playerId !== playerId);
    votes.push({ playerId, rating, createdAt: new Date().toISOString() });
    listingVotes.set(listingId, votes);

    const ratingSummary = listingRating(listingId);
    rooms.forEach((room) => {
      if (room.round?.listing?.id === listingId) room.round.listingRating = ratingSummary;
    });
    return json(res, 200, { rating: ratingSummary });
  }

  if (req.method === "POST" && url.pathname === "/api/listings/trash") {
    const body = await readBody(req);
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    const now = new Date().toISOString();
    let changed = 0;
    importedListings.forEach((listing) => {
      if (ids.includes(listing.id) && !listing.trashedAt) {
        listing.trashedAt = now;
        changed += 1;
      }
    });
    rebuildAuthorizedListings();
    await saveImportedListings();
    return json(res, 200, { changed, active: authorizedListings.length, trash: importedListings.filter((listing) => listing.trashedAt).length });
  }

  if (req.method === "POST" && url.pathname === "/api/listings/restore") {
    const body = await readBody(req);
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    let changed = 0;
    importedListings.forEach((listing) => {
      if (ids.includes(listing.id) && listing.trashedAt) {
        listing.trashedAt = null;
        changed += 1;
      }
    });
    rebuildAuthorizedListings();
    await saveImportedListings();
    return json(res, 200, { changed, active: authorizedListings.length, trash: importedListings.filter((listing) => listing.trashedAt).length });
  }

  if (req.method === "POST" && url.pathname === "/api/listings/delete") {
    const body = await readBody(req);
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    const deleteAll = Boolean(body.all);
    const before = importedListings.length;
    importedListings = importedListings.filter((listing) => {
      if (deleteAll) return !listing.trashedAt;
      return !ids.includes(listing.id);
    });
    rebuildAuthorizedListings();
    await saveImportedListings();
    return json(res, 200, { changed: before - importedListings.length, active: authorizedListings.length, trash: importedListings.filter((listing) => listing.trashedAt).length });
  }

  if (req.method === "POST" && url.pathname === "/api/listings/import") {
    const body = await readBody(req);
    const sourceUrl = String(body.sourceUrl || "").trim();
    let host = "";
    try {
      host = new URL(sourceUrl).hostname;
    } catch {
      return json(res, 400, { error: "Colle l'URL Leboncoin de l'annonce source." });
    }

    if (!host.endsWith("leboncoin.fr")) {
      return json(res, 400, { error: "Pour ce mode, la source doit etre une URL leboncoin.fr." });
    }

    const listing = normalizeListing(
      {
        ...body,
        id: body.id || `lbc-${crypto.createHash("sha1").update(sourceUrl).digest("hex").slice(0, 12)}`,
        source: "Leboncoin - import manuel",
        images: Array.isArray(body.images) ? body.images : [body.imageUrl],
        importerEmail: body.importerEmail,
        importerName: body.importerName,
        validationStatus: "pending",
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
      },
      importedListings.length
    );

    if (!listing) {
      return json(res, 400, { error: "Il faut au minimum un titre, un prix reel valide et une image." });
    }

    const existingIndex = importedListings.findIndex((item) => item.id === listing.id);
    if (existingIndex >= 0) importedListings[existingIndex] = listing;
    else importedListings.unshift(listing);
    rebuildAuthorizedListings();
    await saveImportedListings();
    return json(res, 201, { listing, total: authorizedListings.length });
  }

  if (req.method === "POST" && url.pathname === "/api/listings/import-url") {
    const body = await readBody(req);
    const sourceUrl = String(body.sourceUrl || "").trim();
    let parsedUrl;
    try {
      parsedUrl = new URL(sourceUrl);
    } catch {
      return json(res, 400, { error: "Colle l'URL Leboncoin de l'annonce." });
    }

    if (!parsedUrl.hostname.endsWith("leboncoin.fr")) {
      return json(res, 400, { error: "Pour ce mode, la source doit etre une URL leboncoin.fr." });
    }

    try {
      const response = await fetch(sourceUrl, {
        headers: {
          "Accept": "text/html,application/xhtml+xml",
          "User-Agent": "MarketMasterPrototype/0.1 (+local import by user)"
        }
      });
      if (!response.ok) throw new Error(`Leboncoin a renvoye HTTP ${response.status}`);
      const html = await response.text();
      const listing = parseLeboncoinHtml(html, sourceUrl);
      if (!listing) {
        return json(res, 422, {
          error: "Impossible de détecter automatiquement titre, image et prix. Utilise l'import manuel pour cette annonce."
        });
      }

      const existingIndex = importedListings.findIndex((item) => item.id === listing.id);
      if (existingIndex >= 0) importedListings[existingIndex] = listing;
      else importedListings.unshift(listing);
      rebuildAuthorizedListings();
      await saveImportedListings();
      return json(res, 201, { listing, total: authorizedListings.length });
    } catch (error) {
      return json(res, 502, {
        error: `Import automatique impossible: ${error.message}. Si Leboncoin bloque la lecture serveur, utilise l'import manuel.`
      });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/listings/import-html") {
    const body = await readBody(req);
    const html = String(body.html || "");

    if (html.length < 500) {
      return json(res, 400, { error: "Colle le code source HTML complet de la page Leboncoin." });
    }

    const detectedUrl = extractPageUrl(html);
    if (detectedUrl) {
      try {
        const parsedUrl = new URL(detectedUrl);
        if (!parsedUrl.hostname.endsWith("leboncoin.fr")) {
          return json(res, 400, { error: "Le code source collé ne semble pas venir d'une annonce leboncoin.fr." });
        }
      } catch {
        return json(res, 400, { error: "L'URL détectée dans le code source est invalide." });
      }
    }

      const listing = parseLeboncoinHtml(html, detectedUrl);
    if (!listing) {
      return json(res, 422, {
        error: "Impossible de détecter automatiquement titre, image et prix dans ce HTML. Utilise l'import manuel."
      });
    }

    listing.importerEmail = String(body.importerEmail || "");
    listing.importerName = String(body.importerName || "");
    listing.validationStatus = "pending";
    listing.validatedAt = null;
    listing.rewardGranted = false;

    const existingIndex = importedListings.findIndex((item) => item.id === listing.id);
    if (existingIndex >= 0) importedListings[existingIndex] = listing;
    else importedListings.unshift(listing);
    rebuildAuthorizedListings();
    await saveImportedListings();
    return json(res, 201, { listing, total: authorizedListings.length });
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/[^/]+\/join$/)) {
    const body = await readBody(req);
    const roomId = url.pathname.split("/")[3].toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return json(res, 404, { error: "Salon introuvable" });
    if (room.playerIds.length >= 20) return json(res, 409, { error: "Salon complet" });
    if (room.bannedNames.includes(normalizedName(body.name))) {
      return json(res, 403, { error: "Ce pseudo est banni du salon" });
    }
    const player = createPlayer(body.name);
    room.playerIds.push(player.id);
    return json(res, 200, { player, room: roomState(room, player.id) });
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/[^/]+\/bots$/)) {
    const body = await readBody(req);
    const roomId = url.pathname.split("/")[3].toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return json(res, 404, { error: "Salon introuvable" });
    if (body.playerId !== room.hostId) return json(res, 403, { error: "Seul l'hote peut ajouter des joueurs demo" });
    ["Alex", "Sam", "Nora"].forEach((name) => {
      const alreadyHere = room.playerIds.some((pid) => players.get(pid)?.name === name);
      if (room.playerIds.length < 6 && !alreadyHere && !room.bannedNames.includes(normalizedName(name))) {
        room.playerIds.push(createPlayer(name).id);
      }
    });
    return json(res, 200, { room: roomState(room, body.playerId) });
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/[^/]+\/kick$/)) {
    const body = await readBody(req);
    const roomId = url.pathname.split("/")[3].toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return json(res, 404, { error: "Salon introuvable" });
    if (body.playerId !== room.hostId) return json(res, 403, { error: "Seul l'hote peut expulser un joueur" });
    const targetId = String(body.targetId || "");
    if (targetId === room.hostId) return json(res, 400, { error: "Impossible d'expulser l'hote" });
    if (!room.playerIds.includes(targetId)) return json(res, 404, { error: "Joueur introuvable dans le salon" });
    removePlayerFromRoom(room, targetId);
    maybeAdvance(room);
    return json(res, 200, { room: roomState(room, body.playerId) });
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/[^/]+\/ban$/)) {
    const body = await readBody(req);
    const roomId = url.pathname.split("/")[3].toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return json(res, 404, { error: "Salon introuvable" });
    if (body.playerId !== room.hostId) return json(res, 403, { error: "Seul l'hote peut bannir un joueur" });
    const targetId = String(body.targetId || "");
    const target = players.get(targetId);
    if (targetId === room.hostId) return json(res, 400, { error: "Impossible de bannir l'hote" });
    if (!target || !room.playerIds.includes(targetId)) return json(res, 404, { error: "Joueur introuvable dans le salon" });
    const name = normalizedName(target.name);
    if (name && !room.bannedNames.includes(name)) room.bannedNames.push(name);
    removePlayerFromRoom(room, targetId);
    maybeAdvance(room);
    return json(res, 200, { room: roomState(room, body.playerId) });
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/[^/]+\/start$/)) {
    const body = await readBody(req);
    const roomId = url.pathname.split("/")[3].toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return json(res, 404, { error: "Salon introuvable" });
    if (room.status !== "lobby") return json(res, 409, { error: "La partie est deja lancee" });
    if (body.playerId && body.playerId !== room.hostId) return json(res, 403, { error: "Seul l'hote peut lancer la partie" });
    if (!startRound(room, { newSession: true })) {
      return json(res, 409, {
        error: "Aucune annonce reelle disponible. Configure LISTINGS_FEED_URL ou LISTINGS_FEED_FILE avec des annonces Leboncoin autorisees contenant des images."
      });
    }
    return json(res, 200, { room: roomState(room) });
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/[^/]+\/restart$/)) {
    const body = await readBody(req);
    const roomId = url.pathname.split("/")[3].toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return json(res, 404, { error: "Salon introuvable" });
    if (body.playerId !== room.hostId) return json(res, 403, { error: "Seul l'hote peut relancer une session" });
    if (room.status !== "finished") return json(res, 409, { error: "La partie doit etre terminee pour relancer une session" });
    if (!availableListings().length) {
      return json(res, 409, { error: "Aucune annonce reelle disponible pour relancer une session." });
    }
    scheduleRestart(room);
    return json(res, 200, { room: roomState(room, body.playerId) });
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/[^/]+\/guess$/)) {
    const body = await readBody(req);
    const roomId = url.pathname.split("/")[3].toUpperCase();
    const room = rooms.get(roomId);
    const player = players.get(body.playerId);
    if (!room || !player || !room.round) return json(res, 404, { error: "Partie introuvable" });
    if (!room.playerIds.includes(player.id)) return json(res, 403, { error: "Tu n'es plus dans ce salon" });
    maybeAdvance(room);
    if (room.round.revealed) return json(res, 409, { error: "Manche terminee" });
    if (!room.round.guesses.some((g) => g.playerId === player.id)) {
      room.round.guesses.push({ playerId: player.id, playerName: player.name, value: Math.max(0, Number(body.value) || 0) });
    }

    const real = room.round.listing.actualPrice;
    room.playerIds.forEach((pid) => {
      if (pid === player.id || room.round.guesses.some((g) => g.playerId === pid)) return;
      const bot = players.get(pid);
      if (!bot || !["Alex", "Sam", "Nora"].includes(bot.name)) return;
      const factor = 0.65 + Math.random() * 0.7;
      room.round.guesses.push({ playerId: bot.id, playerName: bot.name, value: Math.round(real * factor) });
    });

    maybeAdvance(room);
    return json(res, 200, { room: roomState(room, player.id) });
  }

  if (req.method === "POST" && url.pathname.match(/^\/api\/rooms\/[^/]+\/next$/)) {
    const body = await readBody(req);
    const roomId = url.pathname.split("/")[3].toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return json(res, 404, { error: "Salon introuvable" });
    if (body.playerId !== room.hostId) return json(res, 403, { error: "Seul l'hote peut passer a la manche suivante" });
    if (room.round && !room.round.revealed) return json(res, 409, { error: "La manche n'est pas encore terminee" });
    if (!finishOrNext(room)) {
      return json(res, 409, {
        error: "Aucune annonce reelle disponible pour continuer. Le catalogue demo est desactive."
      });
    }
    return json(res, 200, { room: roomState(room, body.playerId) });
  }

  if (req.method === "GET" && url.pathname.match(/^\/api\/rooms\/[^/]+$/)) {
    const roomId = url.pathname.split("/")[3].toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return json(res, 404, { error: "Salon introuvable" });
    maybeAdvance(room);
    return json(res, 200, { room: roomState(room, url.searchParams.get("playerId")) });
  }

  json(res, 404, { error: "Route inconnue" });
});

server.listen(PORT, HOST, async () => {
  await initDatabase();
  await loadAccounts();
  await ensureBootstrapAdmin();
  await loadGlobalStats();
  await loadActivityFeed();
  await loadImportedListings();
  await refreshAuthorizedListings();
  setInterval(refreshAuthorizedListings, 10 * 60 * 1000).unref();
  console.log(`Market Master running on http://${HOST}:${PORT}`);
});
