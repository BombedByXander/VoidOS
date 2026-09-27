(async () => {
  const key = "xandersarcade-shell-version";
  const cleanupKey = `${key}-workers`;
  const lockKey = `${key}-lock`;
  const reloadKey = `${key}-reloaded`;
  const channelName = "xandersarcade-shell-updates";
  const marker = "__xav";
  const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const showUpdatingOverlay = () => {
    if (document.getElementById("xandersarcade-site-updating")) return;

    const style = document.createElement("style");
    style.id = "xandersarcade-site-updating-style";
    style.textContent = `
      #xandersarcade-site-updating {
        position: fixed; inset: 0; z-index: 2147483647;
        display: grid; place-items: center; padding: 24px;
        background: rgba(5, 7, 14, .78); backdrop-filter: blur(18px);
        color: #fff; font-family: inherit;
      }
      #xandersarcade-site-updating .xandersarcade-update-card {
        width: min(92vw, 360px); padding: 28px 26px; text-align: center;
        border: 1px solid color-mix(in srgb, var(--primary-color, #9282fb) 42%, transparent);
        border-radius: 22px;
        background: linear-gradient(180deg, rgba(255,255,255,.1), rgba(255,255,255,.04)), rgba(15,18,30,.94);
        box-shadow: 0 24px 70px rgba(0,0,0,.42);
      }
      #xandersarcade-site-updating h1 { margin: 0 0 8px; font-size: 1.35rem; }
      #xandersarcade-site-updating p { margin: 0 0 20px; color: rgba(255,255,255,.7); }
      #xandersarcade-site-updating .xandersarcade-update-track {
        height: 7px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.12);
      }
      #xandersarcade-site-updating .xandersarcade-update-progress {
        width: 42%; height: 100%; border-radius: inherit;
        background: linear-gradient(90deg, var(--primary-color, #9282fb), var(--accent-color, #b263a6));
        animation: xandersarcade-update-progress 1.05s ease-in-out infinite;
      }
      @keyframes xandersarcade-update-progress {
        0% { transform: translateX(-140%); } 100% { transform: translateX(340%); }
      }
      @media (prefers-reduced-motion: reduce) {
        #xandersarcade-site-updating .xandersarcade-update-progress { animation-duration: 2.4s; }
      }
    `;
    const overlay = document.createElement("div");
    overlay.id = "xandersarcade-site-updating";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `<div class="xandersarcade-update-card"><h1>Site Updating</h1><p>One moment while the newest version loads.</p><div class="xandersarcade-update-track" aria-hidden="true"><div class="xandersarcade-update-progress"></div></div></div>`;
    document.head.appendChild(style);
    document.body.appendChild(overlay);
  };

  const cleanMarker = () => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(marker)) return;
    url.searchParams.delete(marker);
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  };

  const reloadFor = (version) => {
    if (sessionStorage.getItem(reloadKey) === version) return;
    sessionStorage.setItem(reloadKey, version);
    showUpdatingOverlay();
    const url = new URL(window.location.href);
    url.searchParams.set(marker, version);
    requestAnimationFrame(() => window.location.replace(url.href));
  };

  const broadcast = (version) => {
    localStorage.setItem(key, version);
    window.__xandersarcadeShellChannel?.postMessage({ type: "update", version });
  };

  const cleanWorkersAndReload = async (version) => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(
          registrations
            .filter((registration) => registration.scope === `${window.location.origin}/`)
            .map((registration) => registration.unregister()),
        );
      }
      if ("caches" in window) {
        await Promise.allSettled((await caches.keys()).map((name) => caches.delete(name)));
      }
    } catch (error) {
      console.warn("Shell cache cleanup failed", error);
    }
    localStorage.setItem(cleanupKey, version);
    localStorage.removeItem(lockKey);
    broadcast(version);
    reloadFor(version);
  };

  const coordinateUpdate = async (version) => {
    if (!version || localStorage.getItem(key) === version) {
      cleanMarker();
      return;
    }

    const now = Date.now();
    let lock = null;
    try {
      lock = JSON.parse(localStorage.getItem(lockKey) || "null");
    } catch {}
    if (lock && lock.version === version && now - Number(lock.time) < 15000) return;

    localStorage.setItem(lockKey, JSON.stringify({ tabId, version, time: now }));
    let confirmed = null;
    try {
      confirmed = JSON.parse(localStorage.getItem(lockKey) || "null");
    } catch {}
    if (!confirmed || confirmed.tabId !== tabId) return;
    await cleanWorkersAndReload(version);
  };

  try {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(channelName);
      window.__xandersarcadeShellChannel = channel;
      channel.addEventListener("message", (event) => {
        if (event.data?.type === "update" && event.data.version) {
          reloadFor(String(event.data.version));
        }
      });
    }
    window.addEventListener("storage", (event) => {
      if (event.key === key && event.newValue) reloadFor(event.newValue);
    });

    const checkVersion = async () => {
      const response = await fetch(`/api/version?${marker}=${Date.now()}`, {
        headers: { Accept: "application/json", "Cache-Control": "no-store" },
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (response.ok) await coordinateUpdate(String(data?.build || data?.version || ""));
    };

    cleanMarker();
    await checkVersion();
    window.setInterval(() => checkVersion().catch(() => {}), 60000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkVersion().catch(() => {});
    });
  } catch (error) {
    console.warn("Shell update check failed", error);
  }
})();
