document.addEventListener("DOMContentLoaded", () => {
  const links = [
    ["/science", "Games", "gamepad-2"],
    ["/math", "Apps", "layout-grid"],
    ["/themes", "Appearance", "palette"],
  ];
  const currentPath = window.location.pathname;
  const activeHref =
    links.find(([href]) => currentPath.startsWith(href))?.[0] || "/science";
  const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const container = document.querySelector(".navbar-container");
  if (!container) return;

  container.innerHTML = `
    <nav class="navbar" aria-label="VoidOS">
      <a href="/science" class="navbar-brand-link" aria-label="VoidOS Games">
        <span class="navbar-brand-logo" aria-hidden="true"></span>
      </a>
      <div class="navbar-links">${links
        .map(
          ([href, label, iconName]) =>
            `<a href="${href}" class="navbar-link${activeHref === href ? " active" : ""}" aria-label="${label}" title="${label}" data-nav-label="${label}">${icon(iconName)}<span>${label}</span></a>`,
        )
        .join("")}</div>
    </nav>
    <button class="navbar-gesture-bar" type="button" data-navbar-gesture hidden aria-label="Show navigation bar"></button>`;

  const body = document.body;
  const nav = container.querySelector(".navbar");
  const gesture = container.querySelector("[data-navbar-gesture]");
  const minimize = container.querySelector("[data-navbar-minimize]");
  const fullscreen = container.querySelector("[data-navbar-fullscreen]");
  const minimizedKey = "voidos-navbar-minimized-v1";

  const setMinimized = (value) => {
    body.classList.toggle("navbar-minimized", value);
    if (gesture) gesture.hidden = !value;
    minimize?.setAttribute(
      "aria-label",
      value ? "Show navigation bar" : "Minimize navigation bar",
    );
    sessionStorage.setItem(minimizedKey, value ? "1" : "0");
  };

  minimize?.addEventListener("click", () => setMinimized(true));
  gesture?.addEventListener("click", () => setMinimized(false));
  fullscreen?.addEventListener("click", () => {
    if (!document.fullscreenElement) nav?.requestFullscreen?.();
    else document.exitFullscreen?.();
  });
  setMinimized(sessionStorage.getItem(minimizedKey) === "1");

  if (window.lucide?.createIcons) window.lucide.createIcons({ root: container });
});
