(() => {
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = "/app-manifest.json";
    document.head.appendChild(manifest);
  }

  if (!document.querySelector('meta[name="theme-color"]')) {
    const theme = document.createElement("meta");
    theme.name = "theme-color";
    theme.content = "#090810";
    document.head.appendChild(theme);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker
          .register("/app-sw.js", { scope: "/" })
          .catch((error) => console.error("VoidOS app worker registration failed", error));
      },
      { once: true },
    );
  }
})();
