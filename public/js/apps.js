console.log(
  `%cVoidOS%c v8 - apps.js Loaded`,
  "font-size: 16px; background-color: #9282fb; border-top-left-radius: 5px; border-bottom-left-radius: 5px; padding: 4px; font-weight: bold;",
  "font-size: 16px; background-color: #090810; font-weight: bold; padding: 4px; border-top-right-radius: 5px; border-bottom-right-radius: 5px;",
);

const APP_CATEGORY_ORDER = [
  "Gaming",
  "Streaming",
  "Social",
  "Music",
  "Productivity",
  "Community",
];

const APP_FEATURED = new Set([
  "youtube",
  "discord",
  "spotify",
  "netflix",
  "movies",
  "xbox cloud gaming",
  "reddit",
]);

const APP_CATEGORIES = new Map([
  ["netflix", "Streaming"],
  ["movies", "Streaming"],
  ["youtube", "Streaming"],
  ["sflix", "Streaming"],
  ["spotify", "Music"],
  ["soundcloud", "Music"],
  ["pandora", "Music"],
  ["discord", "Community"],
  ["telegram (a)", "Community"],
  ["reddit", "Social"],
  ["tiktok", "Social"],
  ["x", "Social"],
  ["pinterest", "Social"],
  ["gmail", "Productivity"],
  ["gauth ai", "Productivity"],
  ["chess.com", "Gaming"],
  ["coolmathgames", "Gaming"],
  ["crazy games", "Gaming"],
  ["poki", "Gaming"],
  ["now.gg", "Gaming"],
  ["geforce now (beta)", "Gaming"],
  ["xbox cloud gaming", "Gaming"],
]);

let allApps = [];

function ensureAppStyles() {
  if (document.getElementById("xandersarcade-apps-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "xandersarcade-apps-style";
  style.textContent = `
    #apps-list {
      display: block;
      width: 100%;
    }

    .xandersarcade-apps-hero {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(240px, 0.9fr);
      gap: 18px;
    }

    .xandersarcade-apps-hero-card,
    .xandersarcade-apps-hero-stats {
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 28px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03)),
        color-mix(in srgb, var(--bg-2-color) 94%, transparent);
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.2);
    }

    .xandersarcade-apps-hero-card {
      padding: 24px;
    }

    .xandersarcade-apps-overline {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding: 7px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-secondary-color);
    }

    .xandersarcade-apps-overline svg {
      width: 15px;
      height: 15px;
      color: #67b7ff;
    }

    .xandersarcade-apps-title {
      margin: 0 0 10px;
      font-size: clamp(1.45rem, 3vw, 2.2rem);
      line-height: 1.08;
      color: var(--text-color);
      text-wrap: balance;
    }

    .xandersarcade-apps-copy {
      margin: 0;
      max-width: 62ch;
      color: var(--text-secondary-color);
      line-height: 1.65;
    }

    .xandersarcade-apps-hero-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      padding: 18px;
      align-content: start;
    }

    .xandersarcade-app-stat {
      padding: 14px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.04);
    }

    .xandersarcade-app-stat-value {
      display: block;
      margin-bottom: 4px;
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--text-color);
    }

    .xandersarcade-app-stat-label {
      font-size: 0.82rem;
      color: var(--text-secondary-color);
    }

    .xandersarcade-app-featured {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 16px;
    }

    .xandersarcade-app-layout {
      display: flex;
      flex-direction: column;
      gap: 28px;
    }

    .xandersarcade-app-section {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .xandersarcade-app-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 4px;
    }

    .xandersarcade-app-section-title {
      margin: 0;
      font-size: 1.16rem;
      font-weight: 800;
      color: var(--text-color);
    }

    .xandersarcade-app-section-count {
      font-size: 0.88rem;
      color: var(--text-secondary-color);
    }

    .xandersarcade-app-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
      gap: 20px 16px;
      width: 100%;
    }

    .xandersarcade-app-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      transition: transform 0.18s ease;
    }

    .xandersarcade-app-card:hover {
      transform: translateY(-3px);
    }

    .xandersarcade-app-card:focus-visible {
      outline: none;
    }

    .xandersarcade-app-media {
      position: relative;
      display: grid;
      place-items: center;
      width: 100%;
      max-width: 118px;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: 18px;
      background: color-mix(in srgb, var(--bg-2-color) 88%, transparent);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.18);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }

    .xandersarcade-app-media img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      padding: 10px;
      transition: transform 0.18s ease;
    }

    .xandersarcade-app-card:hover .xandersarcade-app-media img {
      transform: scale(1.06);
    }

    .xandersarcade-app-body {
      min-width: 0;
    }

    .xandersarcade-app-name {
      margin: 0;
      width: 100%;
      font-size: 0.96rem;
      font-weight: 800;
      line-height: 1.3;
      color: var(--text-color);
      text-align: center;
      overflow-wrap: anywhere;
    }

    @media (max-width: 1080px) {
      .xandersarcade-apps-hero {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .xandersarcade-apps-hero-card {
        padding: 18px;
      }

      .xandersarcade-apps-hero-stats {
        grid-template-columns: 1fr 1fr;
        padding: 12px;
      }

      .xandersarcade-app-grid,
      .xandersarcade-app-featured {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }
    }
  `;

  document.head.appendChild(style);
}

function normalizeName(value) {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function getCategory(app) {
  return APP_CATEGORIES.get(normalizeName(app.name)) || "Community";
}

function getDescription(app, category) {
  const descriptions = {
    Gaming: "Jump straight into cloud play, browser games, and game hubs without leaving the arcade.",
    Streaming: "Watch shows, videos, and streams in one place with fast launch cards.",
    Social: "Keep up with feeds, clips, and conversations through the proxy.",
    Music: "Queue playlists, mixes, and radio without digging through tabs.",
    Productivity: "Useful tools for mail, study help, and getting things done at school.",
    Community: "Chat, hang out, and stay connected with web-first community apps.",
  };

  return descriptions[category] || `${app.name} ready to launch through the proxy.`;
}

function createSparkIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z"></path>
    </svg>
  `;
}

async function openApp(app) {
  let urlforprx = null;
  try {
    if (localStorage.getItem("proxy-backend") === "ultraviolet") {
      await window.ensureUltravioletReady?.();
      if (window.encodeAny) {
        urlforprx = window.encodeAny(app.url);
      } else if (
        typeof __uv$config !== "undefined" &&
        __uv$config.encodeUrl
      ) {
        urlforprx = __uv$config.prefix + __uv$config.encodeUrl(app.url);
      }
    } else {
      await window.ensureScramjetReady?.();
      if (window.sjEncodeAndGo) urlforprx = window.sjEncodeAndGo(app.url);
    }
  } catch (error) {
    // Always take the user to the player on touch devices; it can retry the
    // proxy after its service worker has finished settling.
    console.warn("Proxy setup was deferred to the app player:", error);
  }

  if (!urlforprx || urlforprx === "?" || urlforprx === "/?") {
    // Keep the original URL so /go can encode it after its proxy scripts
    // and service worker have loaded.
    urlforprx = app.url;
  }

  try {
    sessionStorage.setItem("lpurl", urlforprx);
    sessionStorage.setItem("rawurl", app.url);
  } catch (_error) {}

  window.location.href = `/go?url=${encodeURIComponent(app.url)}&__xav=${Date.now()}`;
}

function sortApps(apps) {
  return [...apps].sort((a, b) => a.name.localeCompare(b.name));
}

function createAppCard(app) {
  const card = document.createElement("article");
  card.className = "xandersarcade-app-card";
  card.tabIndex = 0;

  const media = document.createElement("div");
  media.className = "xandersarcade-app-media";

  const image = document.createElement("img");
  image.alt = app.name;
  image.loading = "lazy";
  image.src = app.image;

  const body = document.createElement("div");
  body.className = "xandersarcade-app-body";
  const name = document.createElement("h3");
  name.className = "xandersarcade-app-name";
  name.textContent = app.name;

  const activateCard = async (event) => {
    event.preventDefault();
    await openApp(app);
  };

  card.addEventListener("click", activateCard);
  card.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" || event.key === " ") {
      await activateCard(event);
    }
  });

  media.appendChild(image);
  body.appendChild(name);
  card.appendChild(media);
  card.appendChild(body);
  return card;
}

function renderApps(apps) {
  const appsList = document.getElementById("apps-list");
  if (!appsList) {
    console.error('Element with id "apps-list" not found.');
    return;
  }

  appsList.innerHTML = "";
  if (apps.length === 0) {
    appsList.innerHTML =
      '<p style="color:var(--text-color);opacity:0.7;"><i class="fa-solid fa-circle-exclamation"></i> No apps found.</p>';
    return;
  }

  const grid = document.createElement("div");
  grid.className = "xandersarcade-app-grid";
  sortApps(apps).forEach((app) => {
    grid.appendChild(createAppCard(app));
  });
  appsList.appendChild(grid);
}

function getFilteredApps(searchValue) {
  const value = searchValue.toLowerCase().trim();
  if (!value) {
    return sortApps(allApps);
  }

  return sortApps(
    allApps.filter((app) => {
      const category = getCategory(app).toLowerCase();
      return (
        app.name.toLowerCase().includes(value) ||
        category.includes(value) ||
        getDescription(app, getCategory(app)).toLowerCase().includes(value)
      );
    }),
  );
}

async function bootAppsPage() {
  ensureAppStyles();
  const response = await fetch("json/apps.json");
  allApps = await response.json();

  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.placeholder = `Search for ${allApps.length} apps`;
  }

  renderApps(sortApps(allApps));

  searchInput?.addEventListener("input", (event) => {
    renderApps(getFilteredApps(event.target.value || ""));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootAppsPage, { once: true });
} else {
  bootAppsPage();
}
