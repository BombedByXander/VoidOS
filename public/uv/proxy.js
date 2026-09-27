"use strict";
/**
 * @type {HTMLFormElement}
 */
const form = document.getElementById("proxy-form");
/**
 * @type {HTMLInputElement}
 */
const address = document.getElementById("proxy-address");
/**
 * @type {HTMLInputElement}
 */
const searchEngine = document.getElementById("proxy-search-engine");
/**
 * @type {HTMLParagraphElement}
 */
const error = document.getElementById("proxy-error");
/**
 * @type {HTMLPreElement}
 */
const errorCode = document.getElementById("proxy-error-code");

// Remove the retired Snapchat-only options from saved browser preferences.
if (localStorage.getItem("proxy-backend") === "ultravex") {
  localStorage.setItem("proxy-backend", "ultraviolet");
}
if (localStorage.getItem("transport") === "ultravex") {
  localStorage.setItem("transport", "bare");
}

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

const uvIsXboxEdge = /Xbox/i.test(navigator.userAgent || "");

const uvWispUrl =
  (location.protocol === "https:" ? "wss" : "ws") +
  "://" +
  location.host +
  "/wisp/";
const uvWispCandidates = [uvWispUrl, "wss://lunaar.org/wisp/"].filter(
  (url, index, list) => list.indexOf(url) === index,
);
const bareUrl = location.protocol + "//" + location.host + "/bare/";
var transport = localStorage.getItem("transport");
if (!transport) {
  transport = "libcurl";
  localStorage.setItem("transport", transport);
}

function preferredTransport() {
  // Xbox Edge is much more stable with Epoxy than libcurl's WASM socket layer.
  return uvIsXboxEdge ? "epoxy" : localStorage.getItem("transport") || transport;
}

function showProxyError(message, detail = "") {
  if (error) {
    error.textContent = message;
    error.style.display = "block";
  }

  if (errorCode) {
    errorCode.textContent = detail;
  }
}

function normalizeProxyUrl(url) {
  return !url || url === "?" || url === "/?" ? "/new" : url;
}

async function setTransport(transportsel) {
  const transportPath = transportsel === "libcurl"
    ? "/libcurl/index.mjs"
    : transportsel === "bare"
      ? "/bareasmodule/index.mjs"
      : "/epoxy/index.mjs";
  let lastError;

  if (transportsel === "bare") {
    await connection.setTransport(transportPath, [bareUrl]);
    return;
  }

  for (const wisp of uvWispCandidates) {
    try {
      await connection.setTransport(transportPath, [{ wisp }]);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  if (transportsel === "libcurl") {
    for (const wisp of uvWispCandidates) {
      try {
        await connection.setTransport("/epoxy/index.mjs", [{ wisp }]);
        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error("No Ultraviolet transport could connect to Wisp.");
}
setTransport(preferredTransport()).catch((err) => {
  console.error("Failed to configure BareMux transport:", err);
});

window.setTransport = setTransport;
window.ensureUltravioletReady = async function ensureUltravioletReady() {
  await setTransport(preferredTransport());
  if (typeof registerSW === "function") {
    await registerSW();
  }
};

function encodeURL(url) {
  try {
    const encoded = __uv$config.prefix + __uv$config.encodeUrl(url);
    return encoded;
  } catch (e) {
    console.error("Error encoding URL:", e);
    showProxyError("Failed to encode UV URL.", "Error: " + e.message);
    return null; // return null so caller knows it failed
  }
}

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
function encodeTEXT(text) {
  const searchEngine = localStorage.getItem("se") || "ddg";
  let baseUrl;

  switch (searchEngine) {
    case "google":
      baseUrl = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
      break;
    case "bing":
      baseUrl = `https://www.bing.com/search?q=${encodeURIComponent(text)}`;
      break;
    case "ddg":
      baseUrl = `https://duckduckgo.com/?q=${encodeURIComponent(text)}`;
      break;
    case "yahoo":
      baseUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(text)}`;
      break;
    case "brave":
      baseUrl = `https://search.brave.com/search?q=${encodeURIComponent(text)}`;
      break;
    case "startpage":
      baseUrl = `https://www.startpage.com/sp/search?query=${encodeURIComponent(
        text,
      )}`;
      break;
    default:
      baseUrl = `https://duckduckgo.com/?q=${encodeURIComponent(text)}`;
  }

  try {
    return __uv$config.prefix + __uv$config.encodeUrl(baseUrl);
  } catch (e) {
    console.error("Error encoding URL:", e);
    showProxyError("Failed to encode UV search query.", "Error: " + e.message);
    return null;
  }
}

function decodeURL(url) {
  try {
    const encoded = __uv$config.prefix + __uv$config.decodeURL(url);
    return encoded;
  } catch (e) {
    console.error("Error decoding URL:", e);
    showProxyError("Failed to decode UV URL.", "Error: " + e.message);
    return null;
  }
}
function isValidURL(str) {
  if (/^https?:\/\//i.test(str)) return true;

  const domainPattern = /^[a-z0-9.-]+\.[a-z]{2,}$/i;
  return domainPattern.test(str);
}

function encodeAny(input) {
  if (isValidURL(input)) {
    const url = /^https?:\/\//i.test(input) ? input : "http://" + input;
    return encodeURL(url);
  } else {
    return encodeTEXT(input);
  }
}

window.encodeURL = encodeURL;
window.decodeURL = decodeURL;
window.encodeTEXT = encodeTEXT;
window.encodeAny = encodeAny;
function start(url) {
  try {
    if (__uv$config.prefix && __uv$config) {
      sessionStorage.setItem("lpurl", normalizeProxyUrl(encodeURL(url)));
      // console.log("\u004C\u0075\u006E\u0061\u0061\u0072 Proxy URL:", sessionStorage.getItem("lpurl"));
      location.href = `/go?__xav=${Date.now()}`;
      sessionStorage.setItem("rawurl", url);
    }
  } catch (e) {
    showProxyError("Failed to start UV proxy session.", "Error: " + e.message);
    return;
  }
}

if (form && address) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (localStorage.getItem("proxy-backend") === "ultraviolet") {
      await window.ensureUltravioletReady?.();
      const url = search(address.value, getSearchEngine());
      start(url);
    } else {
      await window.ensureScramjetReady?.();
      const res = normalizeProxyUrl(window.sjEncodeAndGo(address.value));

      console.log(res);
      sessionStorage.setItem("lpurl", res);
      sessionStorage.setItem("rawurl", address.value);
      window.location.href = `/go?__xav=${Date.now()}`;
    }
  });
}
console.log("Proxy started");
