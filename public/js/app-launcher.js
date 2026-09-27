(() => {
  const installButton = document.getElementById("install-button");
  const openButton = document.getElementById("open-button");
  const installHelp = document.getElementById("install-help");
  const installStatus = document.getElementById("install-status");
  let deferredInstallPrompt = null;

  openButton?.addEventListener("click", () => {
    const appWindow = window.open("about:blank#voidos", "_blank");
    if (!appWindow) {
      installStatus.textContent =
        "Your browser blocked the blank window. Allow pop-ups for VoidOS, then try again.";
      return;
    }

    const appDocument = appWindow.document;
    appDocument.documentElement.lang = "en";

    const charset = appDocument.createElement("meta");
    charset.charset = "utf-8";
    const viewport = appDocument.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width,initial-scale=1,viewport-fit=cover";
    const title = appDocument.createElement("title");
    title.textContent = "VoidOS";
    const style = appDocument.createElement("style");
    style.textContent =
      "html,body,iframe{width:100%;height:100%;margin:0;border:0;overflow:hidden;background:#090810}iframe{display:block}";
    appDocument.head.replaceChildren(charset, viewport, title, style);

    const frame = appDocument.createElement("iframe");
    frame.title = "VoidOS";
    frame.allow =
      "autoplay; clipboard-read; clipboard-write; fullscreen; gamepad; picture-in-picture";
    frame.allowFullscreen = true;
    frame.src = new URL("/science", window.location.origin).href;
    appDocument.body.replaceChildren(frame);
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installButton) installButton.textContent = "Install VoidOS";
    if (installHelp) {
      installHelp.textContent =
        "Add VoidOS to your device. Open it, then launch into the about:blank#voidos app window.";
    }
  });

  installButton?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      installHelp?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (installStatus) {
        installStatus.textContent =
          "Use your browser menu and choose Install app or Add to Home Screen.";
      }
      return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  });

  window.addEventListener("appinstalled", () => {
    if (installStatus) installStatus.textContent = "VoidOS is installed. Open it from your apps.";
  });

  if (/iPad|iPhone|iPod/.test(navigator.userAgent) && installHelp) {
    installHelp.textContent =
      "In Safari, tap Share, then Add to Home Screen. Open VoidOS from your Home Screen.";
  }
})();
