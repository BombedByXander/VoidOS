(async () => {
  const key = "xandersarcade-shell-version";
  const sessionKey = `${key}-session`;
  const cleanupKey = `${key}-workers`;
  const cacheParams = ["__xav", "_xav"];

  if (
    window.location.pathname === "/go" ||
    window.location.pathname.endsWith("/go.html")
  ) {
    return;
  }

  function getVersionMarker() {
    try {
      const url = new URL(window.location.href);
      for (const param of cacheParams) {
        const value = url.searchParams.get(param);
        if (value) {
          return String(value).trim();
        }
      }
    } catch (error) {
      console.warn("Local shell version marker read failed", error);
    }

    return "";
  }

  function cleanVersionMarker(version) {
    try {
      const url = new URL(window.location.href);
      const hadMarker = cacheParams.some((param) => url.searchParams.has(param));
      if (!hadMarker) {
        return;
      }

      cacheParams.forEach((param) => url.searchParams.delete(param));
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (error) {
      console.warn("Local shell version marker cleanup failed", error);
    }
  }

  async function refreshShell(version, registrations = [], shouldReload = true) {
    try {
      if (registrations.length) {
        await Promise.allSettled(
          registrations.map((registration) => registration.unregister()),
        );
      }

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.allSettled(
          cacheNames.map((cacheName) => caches.delete(cacheName)),
        );
      }
    } catch (error) {
      console.warn("Local shell refresh failed", error);
    } finally {
      localStorage.setItem(key, version);
      localStorage.setItem(cleanupKey, version);
      if (shouldReload) {
        sessionStorage.setItem(sessionKey, version);
        cleanVersionMarker(version);
        window.location.reload();
      } else {
        sessionStorage.removeItem(sessionKey);
        cleanVersionMarker(version);
      }
    }
  }

  try {
    const response = await fetch("/api/version", {
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-store",
      },
      credentials: "same-origin",
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    const version = String(data?.build || data?.version || "").trim();
    if (!response.ok || !version) {
      return;
    }

    const versionChanged = localStorage.getItem(key) !== version;
    const workersAlreadyCleaned = localStorage.getItem(cleanupKey) === version;
    const arrivedFromVersionMarker = Boolean(getVersionMarker());

    if (!("serviceWorker" in navigator)) {
      if (versionChanged) {
        localStorage.setItem(key, version);
      }
      localStorage.setItem(cleanupKey, version);
      cleanVersionMarker(version);
      return;
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations.map((registration) => registration.update()),
    );
    const currentScope = `${window.location.origin}/`;
    const rootRegistrations = registrations.filter(
      (registration) => registration.scope === currentScope,
    );
    const hasRootController =
      !!navigator.serviceWorker.controller &&
      String(navigator.serviceWorker.controller.scriptURL || "").startsWith(
        window.location.origin,
      );
    const hasRootRegistration = rootRegistrations.length > 0;
    const shouldCleanShellWorkers = hasRootController || hasRootRegistration;

    if (!versionChanged && (!shouldCleanShellWorkers || workersAlreadyCleaned)) {
      sessionStorage.removeItem(sessionKey);
      cleanVersionMarker(version);
      return;
    }

    const alreadyReloadedForVersion =
      sessionStorage.getItem(sessionKey) === version || arrivedFromVersionMarker;
    await refreshShell(version, rootRegistrations, !alreadyReloadedForVersion);
  } catch (error) {
    console.warn("Local shell refresh bootstrap failed", error);
  }
})();
