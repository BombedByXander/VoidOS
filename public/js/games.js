"use strict";

console.log(
  `%cVoidOS%c v10 - games.js Loaded`,
  "font-size: 16px; background-color: #9282fb; border-top-left-radius: 5px; border-bottom-left-radius: 5px; padding: 4px; font-weight: bold;",
  "font-size: 16px; background-color: #090810; font-weight: bold; padding: 4px; border-top-right-radius: 5px; border-bottom-right-radius: 5px;",
);

const FAVORITES_STORAGE_KEY = "xandersarcade-favorite-games";
const LAST_PLAYED_STORAGE_KEY = "xandersarcade-last-played-game";
const GAMES_PER_PAGE = 109;
const FILTER_OPTIONS = [
  { value: "all", label: "All Games" },
  { value: "favorites", label: "Favorites" },
  { value: "hot", label: "Trending" },
  { value: "new", label: "New" },
  { value: "proxy", label: "Proxy Ready" },
];
const SORT_OPTIONS = [
  { value: "popular", label: "Popular" },
  { value: "az", label: "A-Z" },
  { value: "newest", label: "Newest" },
];

// Research-informed order based on broad worldwide genre popularity trends.
// Mapping broad market genres to this catalog is an inference.
const GENRE_ORDER = [
  "Action",
  "Shooter",
  "Sports",
  "Racing",
  "Puzzle",
  "Simulation",
  "Platformer",
  "Sandbox",
  "Strategy",
  "Horror",
  "Rhythm",
  "Arcade",
  "Trivia",
  "Misc",
];

const MANUAL_GENRES = new Map([
  ["five nights at epstein's", "Horror"],
  ["bowmasters", "Action"],
  ["ovo", "Platformer"],
  ["ovo 2", "Platformer"],
  ["ovo 3 dimensions", "Platformer"],
  ["gladihoppers", "Action"],
  ["ice dodo", "Platformer"],
  ["block blast", "Puzzle"],
  ["jetpack joyride", "Platformer"],
  ["friday night funkin", "Rhythm"],
  ["sprunki", "Rhythm"],
  ["slow roads", "Simulation"],
  ["poxel.io", "Shooter"],
  ["survival karts", "Racing"],
  ["capybara clicker", "Simulation"],
  ["bitlife", "Simulation"],
  ["eaglercraft", "Sandbox"],
  ["territorial.io", "Strategy"],
  ["ages of conflict", "Strategy"],
  ["globle unlimited", "Trivia"],
  ["geoguessr", "Trivia"],
  ["request a game", "Misc"],
  ["brotato", "Action"],
  ["happy wheels", "Action"],
  ["rodeo stampede", "Action"],
]);

const GENRE_RULES = [
  ["Horror", [/five nights/, /freddy/, /backrooms/, /baldi/, /horror/, /scary/, /creepy/]],
  ["Rhythm", [/friday night funkin/, /fnf/, /sprunki/, /rhythm/, /music/, /dance/]],
  ["Shooter", [/shooter/, /sniper/, /fps/, /gun/, /strike/, /assault/, /zombie/, /shell shock/, /krunker/, /poxel/, /doom/]],
  ["Racing", [/kart/, /drift/, /racing/, /driver/, /driving/, /parking/, /moto/, /bike/, /car/, /traffic/, /road/, /speed/]],
  ["Sports", [/basketball/, /soccer/, /football/, /baseball/, /tennis/, /golf/, /pool/, /boxing/, /wrestling/, /hockey/, /skate/, /bmx/]],
  ["Puzzle", [/2048/, /sudoku/, /minesweeper/, /chess/, /checkers/, /puzzle/, /merge/, /block blast/, /mahjong/, /wordle/, /solitaire/]],
  ["Strategy", [/territorial/, /conflict/, /tower defense/, /kingdom/, /war/, /commander/, /civilization/, /tycoon/, /idle empire/, /battle sim/]],
  ["Sandbox", [/minecraft/, /eaglercraft/, /sandbox/, /build/, /worldbox/, /creative/]],
  ["Simulation", [/simulator/, /simulation/, /bitlife/, /life/, /roads/, /geofs/, /flight/, /papa's/, /cooking/, /clicker/, /idle/, /business/, /management/]],
  ["Platformer", [/ovo/, /vex/, /run /, /^run\b/, /temple run/, /jetpack/, /mario/, /parkour/, /doodle/, /flappy/, /dodo/]],
  ["Action", [/fighter/, /action/, /battle/, /combat/, /mayhem/, /slash/, /warrior/, /bros/, /adventure/]],
  ["Trivia", [/geoguessr/, /globle/, /quiz/, /trivia/, /word/, /guess/]],
];

let allGames = [];
let currentGamesPage = 1;
let favoriteGames = loadFavoriteGames();
let freebuisnessHtmlMap = {};
const removedFreebuisnessGameIds = new Set([
  "12",
  "35",
  "57",
  ...Array.from({ length: 15 }, (_, index) => String(index + 131)),
  "615",
]);
const REMOVED_GAME_NAMES = new Set(["[!] comments"]);
let activeFilter = "all";
let activeSort = "none";
let activeView = "all";
const RUNTIME_VERSION =
  new URL(document.currentScript?.src || window.location.href, window.location.href)
    .searchParams.get("v") || "";

function withRuntimeVersion(path) {
  if (!RUNTIME_VERSION) {
    return path;
  }

  return `${path}${path.includes("?") ? "&" : "?"}v=${encodeURIComponent(RUNTIME_VERSION)}`;
}

function repairFreebuisnessGameUrl(url) {
  const value = String(url || "");
  const match = value.match(
    /^https:\/\/cdn\.jsdelivr\.net\/gh\/freebuisness\/html@main\/(\d+)(?:-[^/]+)?\.html(?:-[^/]+)?$/i,
  );
  if (match && removedFreebuisnessGameIds.has(match[1])) {
    return "";
  }
  const replacement = match && freebuisnessHtmlMap[match[1]];
  return replacement
    ? `https://cdn.jsdelivr.net/gh/freebuisness/html@main/${replacement}`
    : value;
}

function repairGameImageUrl(image) {
  return String(image || "").replace(
    /^https:\/\/cdn\.jsdelivr\.net\/gh\/gn-math\/covers@main\//i,
    "https://raw.githubusercontent.com/gn-math/covers/main/",
  );
}

function ensureGenreStyles() {
  if (document.getElementById("xandersarcade-games-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "xandersarcade-games-style";
  style.textContent = `
    #games-list {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .xandersarcade-games-empty {
      display: grid;
      gap: 10px;
      padding: 18px 0;
    }

    .xandersarcade-games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
      gap: 20px 16px;
      align-items: start;
    }

    .xandersarcade-game-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      background: transparent;
      border: 0;
      padding: 0;
      cursor: pointer;
      transition: transform 0.18s ease;
    }

    .xandersarcade-game-card.is-new .xandersarcade-game-media {
      border: 2px solid color-mix(in srgb, var(--primary-color) 82%, white);
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--primary-color) 20%, transparent),
        0 0 24px color-mix(in srgb, var(--primary-color) 42%, transparent),
        0 12px 24px rgba(0, 0, 0, 0.2);
    }

    .xandersarcade-game-card.is-new .xandersarcade-game-title {
      color: var(--primary-color);
      text-shadow: 0 0 14px color-mix(in srgb, var(--primary-color) 38%, transparent);
    }

    .xandersarcade-game-card.is-fixed .xandersarcade-game-media {
      border: 2px solid #ef4444;
      box-shadow:
        0 0 0 3px rgba(239, 68, 68, 0.2),
        0 0 24px rgba(239, 68, 68, 0.42),
        0 12px 24px rgba(0, 0, 0, 0.2);
    }

    .xandersarcade-game-card:focus-visible {
      outline: none;
    }

    .xandersarcade-game-media {
      position: relative;
      width: 100%;
      max-width: 118px;
      aspect-ratio: 1 / 1;
      overflow: hidden;
      border-radius: 18px;
      background: color-mix(in srgb, var(--bg-2-color) 88%, transparent);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.18);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }

    .xandersarcade-game-media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .xandersarcade-favorite-button {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: rgba(8, 7, 18, 0.72);
      color: rgba(255, 255, 255, 0.88);
      box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
      cursor: pointer;
      outline: none;
      transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease;
    }

    .xandersarcade-game-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 2;
      display: inline-flex;
      gap: 6px;
    }

    .xandersarcade-game-actions .xandersarcade-favorite-button,
    .xandersarcade-game-actions .xandersarcade-download-button {
      position: static;
    }

    .xandersarcade-download-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: rgba(8, 7, 18, 0.72);
      color: rgba(255, 255, 255, 0.88);
      box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
      cursor: pointer;
      outline: none;
      transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease;
    }

    .xandersarcade-download-button:hover,
    .xandersarcade-download-button:focus-visible {
      color: var(--primary-color);
      background: rgba(8, 7, 18, 0.92);
      transform: translateY(-1px);
    }

    .xandersarcade-download-button svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .xandersarcade-favorite-button.active {
      color: #f5d761;
      background: rgba(26, 20, 6, 0.92);
    }

    .xandersarcade-favorite-button svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .xandersarcade-game-badge {
      position: absolute;
      left: 8px;
      bottom: 8px;
      z-index: 2;
      padding: 5px 9px;
      border-radius: 999px;
      background: linear-gradient(135deg, #fff08a, #ffb82e);
      color: #211500;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.045em;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.34), 0 0 16px rgba(255, 205, 65, 0.48);
      text-transform: uppercase;
    }

    .xandersarcade-game-badge.is-updated-badge {
      background: color-mix(in srgb, var(--bg-2-color) 88%, white);
      color: var(--text-color);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
    }

    .xandersarcade-game-badge.is-fixed-badge {
      background: linear-gradient(135deg, #ff6b6b, #dc2626);
      color: #fff;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.34), 0 0 16px rgba(239, 68, 68, 0.42);
    }

    .xandersarcade-game-badges {
      position: absolute;
      left: 8px;
      bottom: 8px;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 5px;
    }

    .xandersarcade-game-badges .xandersarcade-game-badge {
      position: static;
    }

    .xandersarcade-game-badge i {
      margin-right: 4px;
    }

    .xandersarcade-game-badge svg {
      margin-right: 4px;
    }

    .xandersarcade-game-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      width: 100%;
    }

    .xandersarcade-game-title {
      margin: 0;
      font-size: 0.84rem;
      font-weight: 700;
      line-height: 1.25;
      color: var(--text-color);
      text-align: center;
      text-wrap: balance;
    }

    .xandersarcade-game-title mark {
      padding: 0 0.18em;
      border-radius: 0.35em;
      background: color-mix(in srgb, var(--accent-color) 30%, transparent);
      color: inherit;
    }

    .xandersarcade-games-empty h2,
    .xandersarcade-games-empty p {
      margin: 0;
    }

    .xandersarcade-games-empty-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
      gap: 20px 16px;
    }

    .xandersarcade-games-pagination {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 0 26px;
    }

    .xandersarcade-games-page-button {
      min-width: 38px;
      min-height: 38px;
      padding: 0 11px;
      border: 1px solid color-mix(in srgb, var(--primary-color) 28%, var(--border-color));
      border-radius: 12px;
      background: color-mix(in srgb, var(--bg-2-color) 88%, transparent);
      color: var(--text-color);
      font: inherit;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
    }

    .xandersarcade-games-page-button:hover,
    .xandersarcade-games-page-button[aria-current="page"] {
      border-color: var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 24%, var(--bg-2-color));
    }

    .xandersarcade-games-page-button:disabled {
      opacity: 0.42;
      cursor: default;
    }

    .xandersarcade-games-page-ellipsis {
      padding: 0 3px;
      color: var(--text-secondary-color);
    }

    .xandersarcade-game-card:hover,
    .xandersarcade-game-card:focus-visible {
      transform: translateY(-2px);
    }

    .xandersarcade-game-card:hover .xandersarcade-game-media,
    .xandersarcade-game-card:focus-visible .xandersarcade-game-media {
      transform: translateY(-2px);
      box-shadow: 0 16px 28px rgba(0, 0, 0, 0.24);
    }

    @media (max-width: 640px) {
      .xandersarcade-games-grid,
      .xandersarcade-games-empty-grid {
        grid-template-columns: repeat(auto-fill, minmax(102px, 1fr));
        gap: 16px 12px;
      }
    }

  `;

  document.head.appendChild(style);
}

function normalizeName(value) {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function loadFavoriteGames() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return new Set(
      Array.isArray(parsed)
        ? parsed.map((item) => normalizeName(item)).filter(Boolean)
        : [],
    );
  } catch (_error) {
    return new Set();
  }
}

function loadLastPlayedGame() {
  try {
    const raw = localStorage.getItem(LAST_PLAYED_STORAGE_KEY);
    const parsed = JSON.parse(raw || "null");
    return parsed && parsed.name ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function saveFavoriteGames() {
  try {
    localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(Array.from(favoriteGames.values())),
    );
  } catch (_error) {}
}

function saveLastPlayedGame(game) {
  try {
    localStorage.setItem(
      LAST_PLAYED_STORAGE_KEY,
      JSON.stringify({
        name: game.name,
        timestamp: Date.now(),
      }),
    );
  } catch (_error) {}
}

function isFavorite(game) {
  return favoriteGames.has(normalizeName(game.name));
}

function toggleFavorite(game) {
  const key = normalizeName(game.name);
  if (favoriteGames.has(key)) {
    favoriteGames.delete(key);
  } else {
    favoriteGames.add(key);
  }
  saveFavoriteGames();
  renderGames();
}

function getGenre(game) {
  const name = normalizeName(game.name);

  if (MANUAL_GENRES.has(name)) {
    return MANUAL_GENRES.get(name);
  }

  for (const [genre, patterns] of GENRE_RULES) {
    if (patterns.some((pattern) => pattern.test(name))) {
      return genre;
    }
  }

  return "Arcade";
}

function sortGames(games) {
  return [...games].sort((a, b) => {
    return a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
      numeric: true,
    });
  });
}

function sortGamesByMode(games, mode = activeSort) {
  const sorted = sortGames(games);

  if (mode === "az") {
    return [...sorted].sort((a, b) => a.name.localeCompare(b.name));
  }

  if (mode === "genre") {
    return [...sorted].sort((a, b) => getGenre(a).localeCompare(getGenre(b)) || a.name.localeCompare(b.name));
  }

  if (mode === "newest") {
    return [...sorted].sort((a, b) => {
      const getStatusPriority = (game) => game.new ? 0 : game.updated ? 1 : game.top ? 2 : 3;
      const priorityDifference = getStatusPriority(a) - getStatusPriority(b);
      if (priorityDifference) return priorityDifference;
      return a.name.localeCompare(b.name);
    });
  }

  return sorted;
}

async function openGame(game) {
  saveLastPlayedGame(game);
  sessionStorage.setItem("xandersarcade-pending-game", JSON.stringify({ name: game.name, url: game.url }));

  if (game.directFrame) {
    sessionStorage.setItem("lpurl", game.url);
    sessionStorage.setItem("rawurl", game.url);
    window.location.href = `/go?url=${encodeURIComponent(game.url)}&direct=1&__xav=${Date.now()}`;
    return;
  }

  if (game.proxy) {
    if (game.url.includes("jsdelivr")) {
      sessionStorage.setItem("lpurl", game.url);
      sessionStorage.setItem("rawurl", game.url);
      window.location.href = `/go?url=${encodeURIComponent(game.url)}&__xav=${Date.now()}`;
      return;
    }

    let proxiedUrl = null;

    try {
      if (localStorage.getItem("proxy-backend") === "ultraviolet") {
        await window.ensureUltravioletReady?.();
        if (window.encodeAny) {
          proxiedUrl = window.encodeAny(game.url);
        } else if (typeof __uv$config !== "undefined" && __uv$config.encodeUrl) {
          proxiedUrl = __uv$config.prefix + __uv$config.encodeUrl(game.url);
        }
      } else {
        await window.ensureScramjetReady?.();
        if (window.sjEncodeAndGo) {
          proxiedUrl = window.sjEncodeAndGo(game.url);
        }
      }
    } catch (error) {
      // Do not let a mobile service-worker/transport failure swallow the tap.
      // /go will retry setup and show its own actionable error state.
      console.warn("Proxy setup was deferred to the game player:", error);
    }

    if (!proxiedUrl || proxiedUrl === "?" || proxiedUrl === "/?") {
      // Keep the original URL so /go can perform the encoding after its
      // scripts and service worker have loaded.
      proxiedUrl = game.url;
    }

    sessionStorage.setItem("lpurl", proxiedUrl);
    sessionStorage.setItem("rawurl", game.url);
    window.location.href = `/go?url=${encodeURIComponent(game.url)}&__xav=${Date.now()}`;
    return;
  }

  sessionStorage.setItem("lpurl", game.url);
  sessionStorage.setItem("rawurl", game.url);
  window.location.href = `/go?url=${encodeURIComponent(game.url)}&__xav=${Date.now()}`;
}

function createBadge(label, icon) {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.innerHTML = `<i class="${icon}"></i> ${label}`;
  return badge;
}

function createFavoriteStarIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.75l2.84 5.76 6.36.92-4.6 4.48 1.08 6.33L12 17.25l-5.68 2.99 1.08-6.33-4.6-4.48 6.36-.92L12 2.75z"></path>
    </svg>
  `;
}

function createDownloadIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3v12"></path>
      <path d="m7 10 5 5 5-5"></path>
      <path d="M5 21h14"></path>
    </svg>
  `;
}

function downloadGameAsHtml(game) {
  const gameUrl = String(game.url || "");
  const safeTitle = String(game.name || "game")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "game";
  const escapedUrl = escapeHtml(gameUrl);
  const escapedName = escapeHtml(game.name || "Game");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapedName}</title>
    <style>html,body,iframe{width:100%;height:100%;margin:0;border:0}body{overflow:hidden;background:#000}iframe{display:block}#fallback{position:fixed;left:12px;bottom:12px;padding:8px 12px;border-radius:8px;background:rgba(0,0,0,.72);color:#fff;font:14px system-ui,sans-serif}#fallback a{color:#9fd8ff}</style>
  </head>
  <body>
    <iframe src="${escapedUrl}" title="${escapedName}" allow="fullscreen; autoplay; gamepad" allowfullscreen></iframe>
    <div id="fallback">Having trouble loading it? <a href="${escapedUrl}" target="_blank" rel="noopener">Open the game directly</a></div>
  </body>
</html>`;
  const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `${safeTitle}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSearchTerms() {
  return (document.getElementById("search-input")?.value || "")
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function highlightMatch(value, terms = []) {
  const source = escapeHtml(value);
  if (!terms.length) {
    return source;
  }

  const pattern = new RegExp(
    "(" +
      terms
        .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|") +
      ")",
    "gi",
  );

  return source.replace(pattern, "<mark>$1</mark>");
}

function getGameSubtitle(game) {
  const genre = getGenre(game);
  if (genre === "Racing") return "Fast runs, quick resets, instant rematches.";
  if (genre === "Shooter") return "Jump straight into high-pressure rounds.";
  if (genre === "Platformer") return "Clean movement, harder clears, repeatable runs.";
  if (genre === "Puzzle") return "Good for shorter sessions and smart retries.";
  if (genre === "Simulation") return "Slower burns, bigger progression, more to sink into.";
  if (genre === "Strategy") return "Play for control, planning, and comeback moments.";
  if (genre === "Horror") return "Best played when you want some chaos.";
  return "Quick to launch and easy to jump back into.";
}

function matchesSearch(game, terms) {
  if (!terms.length) {
    return true;
  }

  const haystack = [
    game.name,
    getGenre(game),
    game.top ? "trending hot popular" : "",
    game.new || game.updated ? "new updated fresh latest" : "",
    game.proxy ? "proxy browser web" : "direct play",
    isFavorite(game) ? "favorite favorited starred" : "",
  ]
    .join(" ")
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

function getFilteredGames() {
  const terms = getSearchTerms();
  let filtered = allGames.filter((game) => matchesSearch(game, terms));

  if (activeFilter === "favorites") {
    filtered = filtered.filter((game) => isFavorite(game));
  } else if (activeFilter === "hot") {
    filtered = filtered.filter((game) => game.top);
  } else if (activeFilter === "new") {
    filtered = filtered.filter((game) => game.new || game.updated);
  } else if (activeFilter === "proxy") {
    filtered = filtered.filter((game) => game.proxy);
  }

  if (activeView === "new") {
    filtered = filtered.filter((game) => game.new);
  } else if (activeView === "old") {
    filtered = filtered.filter((game) => !game.new);
  }

  return sortGames(filtered);
}

function buildGroupedGames(filtered) {
  const grouped = new Map();

  filtered.forEach((game) => {
    const genre = getGenre(game);
    if (!grouped.has(genre)) {
      grouped.set(genre, []);
    }
    grouped.get(genre).push(game);
  });

  return grouped;
}

function getOrderedGenres(grouped) {
  const genres = Array.from(grouped.keys());
  return genres.sort((a, b) => {
    const aIndex = GENRE_ORDER.indexOf(a);
    const bIndex = GENRE_ORDER.indexOf(b);
    const safeA = aIndex === -1 ? GENRE_ORDER.length : aIndex;
    const safeB = bIndex === -1 ? GENRE_ORDER.length : bIndex;

    if (safeA !== safeB) {
      return safeA - safeB;
    }

    const sizeDiff = grouped.get(b).length - grouped.get(a).length;
    if (sizeDiff !== 0) {
      return sizeDiff;
    }

    return a.localeCompare(b);
  });
}

function createGameCard(game) {
  const card = document.createElement("article");
  card.className = "xandersarcade-game-card";
  card.classList.toggle("is-new", Boolean(game.new));
  card.classList.toggle("is-fixed", Boolean(game.fixed));
  card.tabIndex = 0;

  const media = document.createElement("div");
  media.className = "xandersarcade-game-media";

  const img = document.createElement("img");
  img.alt = game.name;
  img.loading = "lazy";
  img.src =
    game.image && game.image.startsWith("http")
      ? game.image
      : game.image && game.image.startsWith("/")
        ? game.image
        : game.image
          ? `/media/games/${game.image}`
          : "/media/xandersarcade-logo.png";

  const activateCard = async (event) => {
    event.preventDefault();
    await openGame(game);
  };

  card.addEventListener("click", activateCard);
  card.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" || event.key === " ") {
      await activateCard(event);
    }
  });

  const favoriteButton = document.createElement("button");
  favoriteButton.type = "button";
  favoriteButton.className = "xandersarcade-favorite-button";
  favoriteButton.innerHTML = createFavoriteStarIcon();
  favoriteButton.title = isFavorite(game) ? "Remove favorite" : "Favorite game";
  favoriteButton.setAttribute("aria-label", favoriteButton.title);
  if (isFavorite(game)) {
    favoriteButton.classList.add("active");
  }
  favoriteButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(game);
  });

  const downloadButton = document.createElement("button");
  downloadButton.type = "button";
  downloadButton.className = "xandersarcade-download-button";
  downloadButton.innerHTML = createDownloadIcon();
  downloadButton.title = `Download ${game.name} as HTML`;
  downloadButton.setAttribute("aria-label", downloadButton.title);
  downloadButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    downloadGameAsHtml(game);
  });

  const gameActions = document.createElement("div");
  gameActions.className = "xandersarcade-game-actions";
  gameActions.appendChild(downloadButton);
  gameActions.appendChild(favoriteButton);

  const name = document.createElement("p");
  name.className = "game-link xandersarcade-game-title";
  name.innerHTML = highlightMatch(game.name, getSearchTerms());

  const body = document.createElement("div");
  body.className = "xandersarcade-game-body";

  if (game.new || game.updated || game.fixed) {
    const badgeList = document.createElement("div");
    badgeList.className = "xandersarcade-game-badges";
    if (game.new) {
      const newBadge = document.createElement("span");
      newBadge.className = "xandersarcade-game-badge is-new-badge";
      newBadge.textContent = "NEW";
      badgeList.appendChild(newBadge);
    }
    if (game.fixed) {
      const fixedBadge = document.createElement("span");
      fixedBadge.className = "xandersarcade-game-badge is-fixed-badge";
      fixedBadge.textContent = "FIXED";
      badgeList.appendChild(fixedBadge);
    }
    if (game.updated) {
      const freshnessBadge = document.createElement("span");
      freshnessBadge.className = "xandersarcade-game-badge is-updated-badge";
      freshnessBadge.textContent = "Updated";
      badgeList.appendChild(freshnessBadge);
    }
    media.appendChild(badgeList);
  }

  media.appendChild(gameActions);
  media.appendChild(img);
  body.appendChild(name);

  card.appendChild(media);
  card.appendChild(body);
  return card;
}

function buildRailGroups(filtered, grouped) {
  const lastPlayed = loadLastPlayedGame();
  const continuePlaying = lastPlayed
    ? filtered.find((game) => normalizeName(game.name) === normalizeName(lastPlayed.name))
    : null;
  const favorites = filtered.filter((game) => isFavorite(game));
  const trending = filtered.filter((game) => game.top).slice(0, 12);
  const newest = sortGamesByMode(
    filtered.filter((game) => game.new || game.updated),
    "newest",
  ).slice(0, 12);

  const rails = [];

  if (continuePlaying) {
    rails.push({
      title: "Continue Playing",
      subtitle: "Jump right back into your last launch.",
      games: [continuePlaying],
    });
  }

  if (trending.length) {
    rails.push({
      title: "Trending Now",
      subtitle: "The games that are easiest to recommend right now.",
      games: trending,
    });
  }

  if (favorites.length) {
    rails.push({
      title: "Favorites",
      subtitle: "Your saved picks stay easy to reach.",
      games: favorites.slice(0, 12),
    });
  }

  if (newest.length) {
    rails.push({
      title: "Fresh Drops",
      subtitle: "Recently updated or newly added picks.",
      games: newest,
    });
  }

  getOrderedGenres(grouped).forEach((genre) => {
    const games = sortGamesByMode(grouped.get(genre) || []);
    if (!games.length) {
      return;
    }

    rails.push({
      title: genre,
      subtitle: `Built for ${genre.toLowerCase()} fans who want quick picks without hunting.`,
      games: games.slice(0, 16),
    });
  });

  return rails;
}

function createEmptyState() {
  const empty = document.createElement("section");
  empty.className = "xandersarcade-games-empty";
  empty.innerHTML = `
    <div>
      <h2>No exact matches</h2>
      <p>Try a broader search, switch back to All Games, or jump into one of these easy wins.</p>
    </div>
  `;

  const grid = document.createElement("div");
  grid.className = "xandersarcade-games-empty-grid";

  sortGames(allGames)
    .slice(0, 4)
    .forEach((game) => {
      grid.appendChild(createGameCard(game));
    });

  empty.appendChild(grid);
  return empty;
}

function createGamesPagination(pageCount) {
  if (pageCount <= 1) return null;

  const pagination = document.createElement("nav");
  pagination.className = "xandersarcade-games-pagination";
  pagination.setAttribute("aria-label", "Games pages");

  const goToPage = (page) => {
    currentGamesPage = Math.max(1, Math.min(pageCount, page));
    renderGames();
    document.getElementById("games-count")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const addButton = (label, page, options = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "xandersarcade-games-page-button";
    button.textContent = label;
    button.disabled = Boolean(options.disabled);
    button.setAttribute("aria-label", options.ariaLabel || `Page ${page}`);
    if (page === currentGamesPage && !options.disabled) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => goToPage(page));
    pagination.appendChild(button);
  };

  addButton("‹", currentGamesPage - 1, { disabled: currentGamesPage === 1, ariaLabel: "Previous page" });

  const visiblePages = new Set();
  if (pageCount <= 10) {
    for (let page = 1; page <= pageCount; page += 1) visiblePages.add(page);
  } else {
    visiblePages.add(1);
    visiblePages.add(pageCount);
    for (let page = Math.max(2, currentGamesPage - 2); page <= Math.min(pageCount - 1, currentGamesPage + 2); page += 1) {
      visiblePages.add(page);
    }
  }

  let previousPage = 0;
  for (const page of [...visiblePages].sort((a, b) => a - b)) {
    if (previousPage && page - previousPage > 1) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "xandersarcade-games-page-ellipsis";
      ellipsis.textContent = "…";
      pagination.appendChild(ellipsis);
    }
    addButton(String(page), page);
    previousPage = page;
  }

  addButton("›", currentGamesPage + 1, { disabled: currentGamesPage === pageCount, ariaLabel: "Next page" });
  return pagination;
}

function renderGames() {
  const gamesList = document.getElementById("games-list");
  const searchInput = document.getElementById("search-input");
  const gamesCount = document.getElementById("games-count");

  if (!gamesList) {
    return;
  }

  const filtered = getFilteredGames();
  const pageCount = Math.max(1, Math.ceil(filtered.length / GAMES_PER_PAGE));
  currentGamesPage = Math.min(currentGamesPage, pageCount);
  const startIndex = (currentGamesPage - 1) * GAMES_PER_PAGE;
  const gamesToRender = filtered.slice(startIndex, startIndex + GAMES_PER_PAGE);
  if (searchInput) {
    searchInput.placeholder = "Search Games";
  }
  if (gamesCount) {
    const shownCount = gamesToRender.length;
    const firstGame = filtered.length ? startIndex + 1 : 0;
    const lastGame = startIndex + shownCount;
    gamesCount.textContent = `${firstGame}–${lastGame} of ${filtered.length} games · Page ${currentGamesPage} of ${pageCount}`;
  }

  gamesList.innerHTML = "";

  if (filtered.length === 0) {
    gamesList.appendChild(createEmptyState());
    return;
  }

  const grid = document.createElement("div");
  grid.className = "xandersarcade-games-grid";

  sortGames(gamesToRender).forEach((game) => grid.appendChild(createGameCard(game)));

  gamesList.appendChild(grid);
  const pagination = createGamesPagination(pageCount);
  if (pagination) gamesList.appendChild(pagination);
}

async function loadGames() {
  const sources = [
    "/json/games.json",
    "/json/games-local.json",
    "/json/games-cdn.json",
  ];

  const results = await Promise.allSettled([
    ...sources.map((source) =>
      fetch(withRuntimeVersion(source), { cache: "no-store" }).then((response) =>
        response.json(),
      ),
    ),
    fetch(withRuntimeVersion("json/freebuisness-html-map.json"), {
      cache: "no-store",
    }).then((response) => response.json()),
  ]);

  const mapResult = results.at(-1);
  if (mapResult?.status === "fulfilled" && mapResult.value) {
    freebuisnessHtmlMap = mapResult.value;
  }

  allGames = results
    .slice(0, sources.length)
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .filter((game) => game && game.name && game.url);

  allGames = allGames.map((game) => ({
    ...game,
    image: repairGameImageUrl(game.image),
    url: repairFreebuisnessGameUrl(game.url),
  })).filter(
    (game) => game.url && !REMOVED_GAME_NAMES.has(normalizeName(game.name)),
  );

  const deduped = new Map();
  allGames.forEach((game) => {
    const key = normalizeName(game.name);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, game);
      return;
    }
    deduped.set(key, {
      ...game,
      ...existing,
      url: existing.url || game.url,
      image: existing.image || game.image,
      fixed: Boolean(existing.fixed || game.fixed),
      new: Boolean(existing.new ?? game.new),
      updated: Boolean(existing.updated ?? game.updated),
      top: Boolean(existing.top || game.top),
      proxy: existing.proxy ?? game.proxy,
    });
  });

  allGames = Array.from(deduped.values());
}

async function bootGamesPage() {
  document.body.classList.add("xandersarcade-games-page");
  ensureGenreStyles();
  await loadGames();
  renderGames();

  const rerender = () => {
    window.requestAnimationFrame(renderGames);
  };

  document.getElementById("search-input")?.addEventListener("input", () => {
    currentGamesPage = 1;
    rerender();
  });
  const viewFilter = document.getElementById("games-view-filter");
  if (viewFilter) {
    viewFilter.value = activeView;
    viewFilter.addEventListener("change", () => {
      activeView = ["new", "old", "all"].includes(viewFilter.value) ? viewFilter.value : "all";
      currentGamesPage = 1;
      renderGames();
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootGamesPage, { once: true });
} else {
  bootGamesPage();
}
