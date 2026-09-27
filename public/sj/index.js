"use strict";
/**
 * @type {HTMLFormElement | null}
 */
const sjform = document.getElementById("sj-form");
/**
 * @type {HTMLInputElement | null}
 */
const sjaddress = document.getElementById("sj-address");
/**
 * @type {HTMLInputElement | null}
 */
const sjsearchEngine = document.getElementById("sj-search-engine");
/**
 * @type {HTMLParagraphElement | null}
 */
const sjerror = document.getElementById("sj-error");
/**
 * @type {HTMLPreElement | null}
 */
const sjerrorCode = document.getElementById("sj-error-code");

let scramjet = null;
let sjconnection = null;

const sjIsXboxEdge = /Xbox/i.test(navigator.userAgent || "");
const sjSameOriginWisp =
  (location.protocol === "https:" ? "wss" : "ws") +
  "://" +
  location.host +
  "/wisp/";
const sjWispCandidates = [sjSameOriginWisp, "wss://lunaar.org/wisp/"].filter(
  (url, index, list) => list.indexOf(url) === index,
);

function getScramjetTransport() {
  const saved = localStorage.getItem("transport");
  // Libcurl's WASM socket layer is unreliable on Xbox Edge. Epoxy uses the
  // same Wisp connection with a smaller browser-side footprint there.
  return sjIsXboxEdge ? "epoxy" : saved || "libcurl";
}

async function setScramjetTransport(name) {
  const transportPath = name === "libcurl" ? "/libcurl/index.mjs" : "/epoxy/index.mjs";
  let lastError;

  for (const wisp of sjWispCandidates) {
    try {
      await sjconnection.setTransport(transportPath, [{ wisp }]);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  if (name === "libcurl") {
    for (const wisp of sjWispCandidates) {
      try {
        await sjconnection.setTransport("/epoxy/index.mjs", [{ wisp }]);
        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error("No Scramjet transport could connect to Wisp.");
}

function setSJError(message, detail = "") {
  if (sjerror) {
    sjerror.textContent = message;
  }

  if (sjerrorCode) {
    sjerrorCode.textContent = detail;
  }
}

try {
  if (typeof $scramjetLoadController === "function") {
    const { ScramjetController } = $scramjetLoadController();

    scramjet = new ScramjetController({
      files: {
        wasm: "/scram/scramjet.wasm.wasm",
        all: "/scram/scramjet.all.js",
        sync: "/scram/scramjet.sync.js",
      },
    });

    scramjet.init();
    window.scramjet = scramjet;
  } else {
    console.error("Scramjet controller runtime is unavailable.");
  }
} catch (err) {
  console.error("Failed to initialize Scramjet controller:", err);
  setSJError("Failed to initialize Scramjet.", err.toString());
}

async function ensureScramjetReady() {
  if (!scramjet) {
    throw new Error("Scramjet runtime is not available.");
  }

  if (typeof registerSJSW === "function") {
    await registerSJSW();
  }

  if (!sjconnection && typeof BareMux !== "undefined") {
    sjconnection = new BareMux.BareMuxConnection("/baremux/worker.js");
  }

  if (sjconnection) {
    const transport = getScramjetTransport();
    const transportPath = transport === "libcurl" ? "/libcurl/index.mjs" : "/epoxy/index.mjs";
    if ((await sjconnection.getTransport()) !== transportPath) {
      await setScramjetTransport(transport);
    }
  }

  return scramjet;
}

window.ensureScramjetReady = ensureScramjetReady;

function getSearchEngine() {
  const searchEngine = localStorage.getItem("se") || "ddg";
  let baseUrl;
  switch (searchEngine) {
    case "google":
      baseUrl = `https://www.google.com/search?q=%s`;
      break;
    case "bing":
      baseUrl = `https://www.bing.com/search?q=%s`;
      break;
    case "ddg":
      baseUrl = `https://duckduckgo.com/?q=%s`;
      break;
    case "yahoo":
      baseUrl = `https://search.yahoo.com/search?p=%s`;
      break;
    case "brave":
      baseUrl = `https://search.brave.com/search?q=%s`;
      break;
    case "startpage":
      baseUrl = `https://www.startpage.com/sp/search?query=%s`;
      break;
    default:
      baseUrl = `https://duckduckgo.com/?q=%s`;
  }
  return baseUrl;
}

function sjEncodeAndGo(url) {
  if (!scramjet) {
    console.error("Scramjet encoder requested before initialization.");
    return null;
  }

  const finalurl = search(url, getSearchEngine());
  return scramjet.encodeUrl(finalurl);
}

window.sjEncodeAndGo = sjEncodeAndGo;
window.sjEncode = function sjEncode(url) {
  return scramjet ? scramjet.encodeUrl(url) : null;
};

document.addEventListener("DOMContentLoaded", async () => {
  if (localStorage.getItem("proxy-backend") === "scramjet") {
    try {
      await ensureScramjetReady();
    } catch (err) {
      console.error("Failed to prepare Scramjet:", err);
      setSJError("Failed to prepare Scramjet.", err.toString());
    }
  }

  if (!sjform || !sjaddress) {
    return;
  }

  sjform.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await ensureScramjetReady();
    } catch (err) {
      setSJError("Failed to register Scramjet service worker.", err.toString());
      throw err;
    }

    const url = search(
      sjaddress.value,
      sjsearchEngine?.value || getSearchEngine(),
    );
    const frame = document.getElementById("sj-frame");

    if (!frame) {
      setSJError("Scramjet frame element was not found.");
      return;
    }

    frame.style.display = "block";
    frame.src = scramjet.encodeUrl(url);
  });
});
