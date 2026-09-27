const stockSW = "/uv/sw.js";
const swAllowedHostnames = ["localhost", "127.0.0.1"];
let uvRegistrationPromise;

async function registerSW() {
  if (!navigator.serviceWorker) {
    if (
      location.protocol !== "https:" &&
      !swAllowedHostnames.includes(location.hostname)
    )
      throw new Error("Service workers cannot be registered without https.");

    throw new Error("Your browser doesn't support service workers.");
  }

  if (!uvRegistrationPromise) {
    uvRegistrationPromise = navigator.serviceWorker.register(stockSW, {
      scope: "/uv/",
    });
  }

  return uvRegistrationPromise;
}

window.registerUVSW = registerSW;
window.ensureUltravioletReady = registerSW;
