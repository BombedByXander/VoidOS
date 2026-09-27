console.log(
  `XandersArcade v10 - home.js Loaded`,
  "font-size: 16px; background-color: #9282fb; border-top-left-radius: 5px; border-bottom-left-radius: 5px; padding: 4px; font-weight: bold;",
  "font-size: 16px; background-color: #090810; font-weight: bold; padding: 4px; border-top-right-radius: 5px; border-bottom-right-radius: 5px;",
);

async function openApp(url) {
  let urlforprx = null;
  if (localStorage.getItem("proxy-backend") === "ultraviolet") {
    await window.ensureUltravioletReady?.();
    if (window.encodeAny) {
      urlforprx = window.encodeAny(url);
    } else if (typeof __uv$config !== "undefined" && __uv$config.encodeUrl) {
      try {
        urlforprx = __uv$config.prefix + __uv$config.encodeUrl(url);
      } catch (e) {
        console.error("UV encode error:", e);
      }
    }
  } else {
    await window.ensureScramjetReady?.();
    if (window.sjEncodeAndGo) urlforprx = window.sjEncodeAndGo(url);
  }
  if (!urlforprx || urlforprx === "?" || urlforprx === "/?") urlforprx = "/new";
  try {
    sessionStorage.setItem("lpurl", urlforprx);
    sessionStorage.setItem("rawurl", url);
  } catch (e) {}
  window.location.href = `/go?__xav=${Date.now()}`;
}

const rngText = document.getElementById("rng-text");
const greetings = [
  "Soixante Sept",
  "Hello!",
  "Freedom",
  "The Best",
  "Welcome to the best",
  "Welcome",
  "xandersarcade",
  "uhh",
  "Good Evening!",
  "xander still bypassing tech 😂😂",
  "xandersarcade is my retaliation against tech who doubted me.",
  "u can never block me",
  "Happy 1 year anniversary!",
];
function getRandomGreeting() {
  const randomIndex = Math.floor(Math.random() * greetings.length);
  return greetings[randomIndex];
}

if (rngText) {
  rngText.textContent = getRandomGreeting();
  rngText.classList.add("xandersarcade-home-greeting-visible");
}

const searchInput = document.getElementById("proxy-address");
const autocompleteBox = document.getElementById("autocomplete");
if (searchInput) {
  searchInput.placeholder = "Search DuckDuckGo completely unblocked.";
}
let suggestionAbortController = null;
let suggestionTimer = null;

function setupHomeHero() {
  const container = document.querySelector(".container");
  const searchContainer = document.querySelector(".search-container");

  if (!container || !searchContainer) return;
  document.documentElement.classList.add("xandersarcade-home");
  document.body.classList.add("xandersarcade-home");
}

setupHomeHero();

function alignHomeCopyToSearch() {
  const searchContainer = document.querySelector(".search-container");
  const credit = document.querySelector(".xandersarcade-credit");
  if (!searchContainer || !document.body.classList.contains("xandersarcade-home")) {
    return;
  }

  const searchBounds = searchContainer.getBoundingClientRect();
  const centeredWidth = `${searchBounds.width}px`;
  if (rngText) {
    rngText.style.width = centeredWidth;
    rngText.style.maxWidth = centeredWidth;
    rngText.style.textAlign = "center";
  }
  if (credit) {
    credit.style.width = centeredWidth;
    credit.style.maxWidth = centeredWidth;
    credit.style.left = `${searchBounds.left + searchBounds.width / 2}px`;
    credit.style.transform = "translateX(-50%)";
    credit.style.textAlign = "center";
  }
}

window.addEventListener("resize", alignHomeCopyToSearch);
window.requestAnimationFrame(alignHomeCopyToSearch);

async function fetchSuggestions(query) {
  const trimmedQuery = String(query || "").trim();

  if (!autocompleteBox) {
    return;
  }

  if (!trimmedQuery) {
    if (suggestionAbortController) {
      suggestionAbortController.abort();
      suggestionAbortController = null;
    }
    autocompleteBox.innerHTML = "";
    autocompleteBox.style.display = "none";
    return;
  }

  try {
    if (suggestionAbortController) {
      suggestionAbortController.abort();
    }

    suggestionAbortController = new AbortController();
    const res = await fetch(
      `https://duckduckgo.com/ac/?q=${encodeURIComponent(trimmedQuery)}`,
      {
        signal: suggestionAbortController.signal,
      },
    );
    const suggestions = await res.json();
    autocompleteBox.innerHTML = "";
    if (suggestions.length === 0) {
      autocompleteBox.style.display = "none";
      return;
    }
    const fragment = document.createDocumentFragment();
    suggestions.forEach((s) => {
      const item = document.createElement("div");
      item.textContent = s.phrase;
      item.onclick = () => {
        searchInput.value = s.phrase;
        autocompleteBox.innerHTML = "";
        autocompleteBox.style.display = "none";
      };
      fragment.appendChild(item);
    });
    autocompleteBox.appendChild(fragment);
    autocompleteBox.style.display = "block";
  } catch (err) {
    if (err?.name === "AbortError") {
      return;
    }
    console.error("Autocomplete error:", err);
    autocompleteBox.style.display = "none";
  } finally {
    suggestionAbortController = null;
  }
}

if (searchInput && autocompleteBox) {
  searchInput.addEventListener("input", (e) => {
    if (suggestionTimer) {
      clearTimeout(suggestionTimer);
    }

    const nextValue = e.target.value;
    suggestionTimer = setTimeout(() => {
      fetchSuggestions(nextValue);
    }, 90);
  });

  document.addEventListener("click", (e) => {
    if (!autocompleteBox.contains(e.target) && e.target !== searchInput) {
      autocompleteBox.innerHTML = "";
      autocompleteBox.style.display = "none";
    }
  });
}
