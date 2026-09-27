const supabaseClient = window.xandersSupabase;

function showAccountMessage(id, message, error = false) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.style.color = error ? "#ff9caa" : "var(--primary-color)";
}

function formatMinutes(seconds) {
  const minutes = Math.floor(Number(seconds || 0) / 60);
  return `${minutes} mins`;
}

function escapeAccountText(value) {
  return String(value || "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function isMissingLastOnlineColumn(error) {
  return String(error?.message || "").toLowerCase().includes("last_online")
    && (error?.code === "42703" || /does not exist|schema cache|could not find/.test(String(error?.message || "").toLowerCase()));
}

function syntheticEmail(username) {
  const safeUsername = String(username)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return `${safeUsername || "user"}@users.xandersarcade.com`;
}

async function loadGlobalUsers() {
  const [profileResult, { data: stats, error: statsError }] = await Promise.all([
    supabaseClient.from("profiles").select("id, username, avatar_url, avatar_type, avatar_name, created_at, last_online").order("username"),
    supabaseClient.from("game_stats").select("user_id, game_name, seconds"),
  ]);
  let { data: profiles, error: profilesError } = profileResult;
  if (isMissingLastOnlineColumn(profilesError)) {
    ({ data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("id, username, avatar_url, avatar_type, avatar_name, created_at")
      .order("username"));
  }
  if (profilesError || statsError) throw profilesError || statsError;
  const statsByUser = new Map();
  (stats || []).forEach((row) => {
    if (!statsByUser.has(row.user_id)) statsByUser.set(row.user_id, {});
    statsByUser.get(row.user_id)[row.game_name] = row.seconds;
  });
  return (profiles || []).map((profile) => ({ ...profile, games: statsByUser.get(profile.id) || {} }));
}

function renderUserStats(user) {
  const target = document.getElementById("account-profile-stats");
  if (!target) return;
  const games = Object.entries(user.games || {}).sort(([, a], [, b]) => b - a);
  const totalSeconds = games.reduce((sum, [, seconds]) => sum + Number(seconds || 0), 0);
  target.innerHTML = `<div class="account-stat-summary"><strong>${games.length} games · ${formatMinutes(totalSeconds)} playtime</strong></div>`;
}

function renderAllUsers(users, activeUser) {
  const targets = [document.getElementById("account-users-list"), document.getElementById("account-community-list")].filter(Boolean);
  if (!targets.length) return;
  const rankedUsers = users.map((user) => {
    const games = Object.entries(user.games || {});
    const totalSeconds = games.reduce((sum, [, value]) => sum + Number(value || 0), 0);
    return { ...user, totalSeconds };
  }).sort((a, b) => b.totalSeconds - a.totalSeconds || a.username.localeCompare(b.username));
  const markup = rankedUsers.length ? rankedUsers.map((user, index) => {
    const games = Object.entries(user.games || {}).sort(([, a], [, b]) => b - a);
    const seconds = games.reduce((sum, [, value]) => sum + Number(value || 0), 0);
    const isImage = user.avatar_type?.startsWith("image/");
    const firstGames = games.slice(0, 3).map(([name, value]) => `<span>${escapeAccountText(name)} · ${formatMinutes(value)}</span>`).join("");
    const remainingGames = games.slice(3).map(([name, value]) => `<span>${escapeAccountText(name)} · ${formatMinutes(value)}</span>`).join("");
    const isOnline = user.last_online && (Date.now() - new Date(user.last_online).getTime()) < 150000;
    const presenceLabel = isOnline ? "Online" : "Offline";
    const history = games.length > 3
      ? `<div class="account-user-games">${firstGames}</div><details class="account-user-games-dropdown"><summary>Show ${games.length - 3} more games</summary><div class="account-user-games">${remainingGames}</div></details>`
      : games.length ? `<div class="account-user-games">${firstGames}</div>` : "";
    return `<div class="account-user-row${user.id === activeUser?.id ? " active" : ""}"><div class="account-user-rank">#${index + 1}</div><div class="account-user-avatar ${isImage ? "has-image" : ""}" ${isImage ? `style="background-image:url(${user.avatar_url})"` : ""}>${user.avatar_url ? (isImage ? "" : "📎") : escapeAccountText(user.username.slice(0, 1).toUpperCase())}</div><div class="account-user-copy"><strong>${escapeAccountText(user.username)}<span class="account-presence-dot ${isOnline ? "online" : "offline"}" role="img" aria-label="${presenceLabel}" title="${presenceLabel}"></span></strong><span>${games.length} games · ${formatMinutes(seconds)} playtime</span>${history}</div></div>`;
  }).join("") : '<p class="account-muted">No community players yet.</p>';
  targets.forEach((target) => { target.innerHTML = markup; });
}

function setAccountView(user, allUsers = []) {
  const authView = document.getElementById("account-auth-view");
  const profileView = document.getElementById("account-profile-view");
  if (!authView || !profileView) return;
  authView.hidden = Boolean(user);
  profileView.hidden = !user;
  document.getElementById("account-hero-kicker").textContent = user ? "Your account" : "Supabase accounts";
  document.getElementById("account-hero-title").textContent = user ? "Profile settings" : "Your arcade profile";
  document.getElementById("account-hero-description").textContent = user
    ? "Update your profile picture and see your lifetime playtime."
    : "Create an account with a username and password, add a profile picture, and track your playtime across the community.";
  if (!user) return;
  document.getElementById("account-profile-name").textContent = user.username;
  const avatar = document.getElementById("account-profile-avatar");
  const isImage = user.avatar_type?.startsWith("image/");
  avatar.textContent = user.avatar_url ? (isImage ? "" : "📎") : user.username.slice(0, 1).toUpperCase();
  avatar.style.backgroundImage = isImage ? `url(${user.avatar_url})` : "";
  avatar.title = user.avatar_name || "";
  avatar.classList.toggle("has-image", Boolean(isImage));
  renderUserStats(user);
  renderAllUsers(allUsers, user);
}

async function refreshAccount() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const users = await loadGlobalUsers();
  const user = session ? users.find((profile) => profile.id === session.user.id) : null;
  renderAllUsers(users, user);
  setAccountView(user, users);
}

document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("account-login-form");
  const registerForm = document.getElementById("account-register-form");
  const avatarForm = document.getElementById("account-avatar-form");
  const avatarFileInput = document.getElementById("account-avatar-file");
  const avatarDropzone = document.getElementById("account-avatar-dropzone");
  const avatarPreview = document.getElementById("account-avatar-preview");
  if (!loginForm || !registerForm) return;
  if (!supabaseClient) {
    showAccountMessage("account-login-message", "Supabase is not configured.", true);
    return;
  }

  let selectedAvatarFile = null;
  let avatarPreviewUrl = "";
  const setAvatarFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return showAccountMessage("account-avatar-message", "Choose an image file.", true);
    if (file.size > 2 * 1024 * 1024) return showAccountMessage("account-avatar-message", "The profile picture must be under 2 MB.", true);
    selectedAvatarFile = file;
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    avatarPreviewUrl = URL.createObjectURL(file);
    avatarPreview.src = avatarPreviewUrl;
    avatarPreview.hidden = false;
    document.getElementById("account-upload-title").textContent = file.name || "Profile picture selected";
    document.getElementById("account-upload-hint").textContent = "Preview ready · choose another image to replace it";
    showAccountMessage("account-avatar-message", "Picture ready to save.");
  };
  avatarDropzone?.addEventListener("click", () => avatarFileInput?.click());
  avatarFileInput?.addEventListener("change", () => setAvatarFile(avatarFileInput.files?.[0]));
  ["dragenter", "dragover"].forEach((name) => avatarDropzone?.addEventListener(name, (event) => {
    event.preventDefault();
    avatarDropzone.classList.add("drag-over");
  }));
  ["dragleave", "dragend"].forEach((name) => avatarDropzone?.addEventListener(name, () => avatarDropzone.classList.remove("drag-over")));
  avatarDropzone?.addEventListener("drop", (event) => {
    event.preventDefault();
    avatarDropzone.classList.remove("drag-over");
    setAvatarFile(Array.from(event.dataTransfer?.files || []).find((file) => file.type.startsWith("image/")));
  });
  document.addEventListener("paste", (event) => {
    if (document.getElementById("account-profile-view")?.hidden) return;
    const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith("image/"));
    const file = imageItem?.getAsFile();
    if (file) {
      event.preventDefault();
      setAvatarFile(file);
    }
  });

  document.querySelectorAll("[data-account-tab]").forEach((button) => button.addEventListener("click", () => {
    const register = button.dataset.accountTab === "register";
    loginForm.hidden = register;
    registerForm.hidden = !register;
    document.querySelectorAll("[data-account-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
  }));

  document.querySelectorAll("[data-password-toggle]").forEach((button) => button.addEventListener("click", () => {
    const input = button.parentElement.querySelector("input");
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    button.setAttribute("aria-label", visible ? "Show password" : "Hide password");
    button.classList.toggle("visible", !visible);
  }));

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);
    const { error } = await supabaseClient.auth.signInWithPassword({ email: syntheticEmail(form.get("username")), password: form.get("password") });
    if (error) return showAccountMessage("account-login-message", "Username or password is incorrect.", true);
    await refreshAccount();
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(registerForm);
    const username = String(form.get("username") || "").trim();
    const password = String(form.get("password") || "");
    const avatarFile = form.get("avatar");
    if (username.length < 3 || password.length < 6) return showAccountMessage("account-register-message", "Use a username with 3+ characters and a password with 6+ characters.", true);
    if (!/^[A-Za-z0-9._ -]+$/.test(username)) return showAccountMessage("account-register-message", "Use only letters, numbers, spaces, dots, underscores, or hyphens in your username.", true);
    if (avatarFile?.size > 2 * 1024 * 1024) return showAccountMessage("account-register-message", "The profile file must be under 2 MB.", true);
    const { data, error } = await supabaseClient.auth.signUp({ email: syntheticEmail(username), password });
    if (error) return showAccountMessage("account-register-message", error.message, true);
    if (!data.session) return showAccountMessage("account-register-message", "Supabase email confirmation is enabled. Disable it in Authentication settings, then try again.", true);
    let avatarUrl = null;
    if (avatarFile?.size) {
      const path = `${data.user.id}/${crypto.randomUUID()}-${avatarFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const upload = await supabaseClient.storage.from("profile-files").upload(path, avatarFile, { upsert: false });
      if (upload.error) return showAccountMessage("account-register-message", upload.error.message, true);
      avatarUrl = supabaseClient.storage.from("profile-files").getPublicUrl(path).data.publicUrl;
    }
    const profile = { id: data.user.id, username, avatar_url: avatarUrl, avatar_type: avatarFile?.type || null, avatar_name: avatarFile?.name || null };
    const { error: profileError } = await supabaseClient.from("profiles").insert(profile);
    if (profileError) return showAccountMessage("account-register-message", profileError.message, true);
    await refreshAccount();
  });

  document.getElementById("account-logout")?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    await refreshAccount();
  });
  avatarForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = selectedAvatarFile;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user?.id) return showAccountMessage("account-avatar-message", "Log in again to change your profile picture.", true);
    if (!file?.size || !file.type.startsWith("image/")) return showAccountMessage("account-avatar-message", "Choose an image file.", true);
    if (file.size > 2 * 1024 * 1024) return showAccountMessage("account-avatar-message", "The profile picture must be under 2 MB.", true);
    const path = `${session.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await supabaseClient.storage.from("profile-files").upload(path, file, { upsert: false });
    if (uploadError) return showAccountMessage("account-avatar-message", uploadError.message, true);
    const avatarUrl = supabaseClient.storage.from("profile-files").getPublicUrl(path).data.publicUrl;
    const { error } = await supabaseClient.from("profiles").update({ avatar_url: avatarUrl, avatar_type: file.type, avatar_name: file.name }).eq("id", session.user.id);
    if (error) return showAccountMessage("account-avatar-message", error.message, true);
    avatarForm.reset();
    selectedAvatarFile = null;
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    avatarPreviewUrl = "";
    avatarPreview.hidden = true;
    avatarPreview.removeAttribute("src");
    document.getElementById("account-upload-title").textContent = "Drop or paste a picture";
    document.getElementById("account-upload-hint").textContent = "or click to browse · PNG, JPG, GIF, WEBP";
    await refreshAccount();
    showAccountMessage("account-avatar-message", "Profile picture updated.");
  });
  supabaseClient.auth.onAuthStateChange(() => refreshAccount());
  window.setInterval(() => refreshAccount().catch((error) => console.warn("Could not refresh account presence:", error)), 30000);
  try { await refreshAccount(); } catch (error) { showAccountMessage("account-login-message", error.message, true); }
});
