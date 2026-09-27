const adminSupabase = window.xandersSupabase;

function escapeAdminText(value) {
  return String(value || "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function formatAdminDate(value) {
  return value ? new Date(value).toLocaleString() : "Not recorded yet";
}

function isMissingLastOnlineColumn(error) {
  return String(error?.message || "").toLowerCase().includes("last_online")
    && (error?.code === "42703" || /does not exist|schema cache|could not find/.test(String(error?.message || "").toLowerCase()));
}

async function refreshAdminSoundStatus(userId = "") {
  const status = document.getElementById("admin-sound-status");
  const start = document.getElementById("admin-sound-start");
  const stop = document.getElementById("admin-sound-stop");
  if (!userId) {
    status.textContent = "Choose a player to check sound status.";
    start.disabled = true;
    stop.disabled = true;
    return;
  }
  start.disabled = true;
  stop.disabled = true;
  status.textContent = "Checking device state…";
  const { data, error } = await adminSupabase.from("user_sound_controls").select("active").eq("user_id", userId).maybeSingle();
  if (error) {
    status.textContent = "Run the latest Supabase setup SQL to enable device sound.";
    showAdminStatus(error.message, true);
    return;
  }
  status.textContent = data?.active ? "Sound is running on this player’s devices." : "Sound is stopped on this player’s devices.";
  start.disabled = Boolean(data?.active);
  stop.disabled = !data?.active;
}

async function setAdminSoundState(active) {
  const userId = document.getElementById("admin-managed-user")?.value;
  if (!userId) return;
  const button = document.getElementById(active ? "admin-sound-start" : "admin-sound-stop");
  button.disabled = true;
  const { error } = await adminSupabase.from("user_sound_controls").upsert({
    user_id: userId,
    active,
    updated_at: new Date().toISOString(),
    updated_by: (await adminSupabase.auth.getSession()).data.session?.user?.id,
  }, { onConflict: "user_id" });
  if (error) {
    showAdminStatus(error.message, true);
    return refreshAdminSoundStatus(userId);
  }
  showAdminStatus(active ? "Sound started on the selected player’s devices." : "Sound stopped on the selected player’s devices.");
  await refreshAdminSoundStatus(userId);
}

async function loadAdminData() {
  const [profileResult, { data: bans, error: bansError }, { data: appeals, error: appealsError }, { data: gameStats, error: gameStatsError }] = await Promise.all([
    adminSupabase.from("profiles").select("id, username, created_at, last_online").order("username"),
    adminSupabase.from("bans").select("id, user_id, reason, active, created_at, lifted_at, banned_by").order("created_at", { ascending: false }),
    adminSupabase.from("appeals").select("id, ban_id, user_id, reason, status, created_at, reviewed_at").order("created_at", { ascending: false }),
    adminSupabase.from("game_stats").select("user_id, game_name, seconds").order("game_name"),
  ]);
  let { data: profiles, error: profilesError } = profileResult;
  const lastOnlineColumnMissing = isMissingLastOnlineColumn(profilesError);
  if (lastOnlineColumnMissing) {
    ({ data: profiles, error: profilesError } = await adminSupabase
      .from("profiles")
      .select("id, username, created_at")
      .order("username"));
  }
  if (profilesError || bansError || appealsError || gameStatsError) throw profilesError || bansError || appealsError || gameStatsError;
  if (lastOnlineColumnMissing) profiles = (profiles || []).map((profile) => ({ ...profile, last_online_setup_missing: true }));
  return { profiles: profiles || [], bans: bans || [], appeals: appeals || [], gameStats: gameStats || [] };
}

function renderAdminDashboard(data, session) {
  const profileMap = new Map(data.profiles.map((profile) => [profile.id, profile]));
  const activeBans = new Map(data.bans.filter((ban) => ban.active).map((ban) => [ban.user_id, ban]));
  const managedUserSelect = document.getElementById("admin-managed-user");
  const users = document.getElementById("admin-users");
  const previousManagedUserId = managedUserSelect.value;
  managedUserSelect.innerHTML = data.profiles.map((profile) => `<option value="${profile.id}">${escapeAdminText(profile.username)}</option>`).join("");
  managedUserSelect.value = data.profiles.some((profile) => profile.id === previousManagedUserId)
    ? previousManagedUserId
    : (data.profiles[0]?.id || "");
  const renderManagedUser = () => {
    const profile = data.profiles.find((item) => item.id === managedUserSelect.value);
    if (!profile) {
      users.innerHTML = '<p class="admin-muted">No users have been created yet.</p>';
      document.getElementById("admin-delete-account").disabled = true;
      refreshAdminSoundStatus("");
      return;
    }
    const ban = activeBans.get(profile.id);
    const lastOnline = profile.last_online_setup_missing ? "Supabase setup required (see SQL)" : formatAdminDate(profile.last_online);
    const isSelf = profile.id === session.user.id;
    users.innerHTML = `<article class="admin-user-row"><div class="admin-user-copy"><strong>${escapeAdminText(profile.username)}</strong><span>Created ${escapeAdminText(formatAdminDate(profile.created_at))}</span><small>Last Online ${escapeAdminText(lastOnline)}</small>${ban ? `<em>Banned: ${escapeAdminText(ban.reason)}</em>` : ""}</div><div class="admin-user-actions">${ban ? `<button class="admin-action unban" data-unban="${ban.id}">Unban</button>` : `<button class="admin-action ban" data-ban="${profile.id}">Ban</button>`}</div></article>`;
    const deleteButton = document.getElementById("admin-delete-account");
    deleteButton.disabled = isSelf;
    deleteButton.title = isSelf ? "You cannot delete the signed-in admin account" : "";
    document.getElementById("admin-delete-account-note").textContent = isSelf
      ? "The currently signed-in administrator account is protected from deletion."
      : `Permanently removes ${profile.username} and their saved account data.`;
    deleteButton.onclick = async () => {
      if (isSelf) return;
      const confirmation = window.prompt(`Permanently delete ${profile.username} and their profile, playtime, and account? Type ${profile.username} to confirm.`);
      if (confirmation !== profile.username) return;
      deleteButton.disabled = true;
      const { error } = await adminSupabase.rpc("admin_delete_user", { target_user_id: profile.id });
      if (error) {
        deleteButton.disabled = false;
        return showAdminStatus(error.message, true);
      }
      await refreshAdminDashboard(session);
      showAdminStatus(`Deleted ${profile.username}'s account and associated data.`);
    };
    users.querySelectorAll("[data-ban]").forEach((button) => button.addEventListener("click", async () => {
      const { error } = await adminSupabase.from("bans").insert({ user_id: button.dataset.ban, reason: "Banned by administrator", banned_by: session.user.id });
      if (error) return showAdminStatus(error.message, true);
      await refreshAdminDashboard(session);
    }));
    users.querySelectorAll("[data-unban]").forEach((button) => button.addEventListener("click", async () => {
      const { error } = await adminSupabase.from("bans").update({ active: false, lifted_at: new Date().toISOString() }).eq("id", button.dataset.unban);
      if (error) return showAdminStatus(error.message, true);
      await refreshAdminDashboard(session);
    }));
  };
  managedUserSelect.onchange = () => {
    renderManagedUser();
    refreshAdminSoundStatus(managedUserSelect.value);
  };
  renderManagedUser();
  document.getElementById("admin-sound-start").onclick = () => setAdminSoundState(true);
  document.getElementById("admin-sound-stop").onclick = () => setAdminSoundState(false);
  refreshAdminSoundStatus(managedUserSelect.value);

  const appeals = document.getElementById("admin-appeals");
  const pending = data.appeals.filter((appeal) => appeal.status === "pending");
  appeals.innerHTML = pending.length ? pending.map((appeal) => {
    const profile = profileMap.get(appeal.user_id);
    const ban = data.bans.find((item) => item.id === appeal.ban_id);
    return `<article class="admin-appeal-row"><strong>${escapeAdminText(profile?.username || "Unknown user")}</strong><span>Submitted ${escapeAdminText(formatAdminDate(appeal.created_at))}</span><p>${escapeAdminText(appeal.reason)}</p><div class="admin-user-actions"><button class="admin-action unban" data-approve-appeal="${appeal.id}" data-appeal-ban="${ban?.id || ""}">Approve &amp; unban</button><button class="admin-action deny" data-deny-appeal="${appeal.id}">Deny appeal</button></div></article>`;
  }).join("") : '<p class="admin-muted">No pending appeals.</p>';

  appeals.querySelectorAll("[data-approve-appeal]").forEach((button) => button.addEventListener("click", async () => {
    const { error: banError } = button.dataset.appealBan ? await adminSupabase.from("bans").update({ active: false, lifted_at: new Date().toISOString() }).eq("id", button.dataset.appealBan) : { error: null };
    if (banError) return showAdminStatus(banError.message, true);
    const { error } = await adminSupabase.from("appeals").update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: session.user.id }).eq("id", button.dataset.approveAppeal);
    if (error) return showAdminStatus(error.message, true);
    await refreshAdminDashboard(session);
  }));
  appeals.querySelectorAll("[data-deny-appeal]").forEach((button) => button.addEventListener("click", async () => {
    const { error } = await adminSupabase.from("appeals").update({ status: "denied", reviewed_at: new Date().toISOString(), reviewed_by: session.user.id }).eq("id", button.dataset.denyAppeal);
    if (error) return showAdminStatus(error.message, true);
    await refreshAdminDashboard(session);
  }));

  const userSelect = document.getElementById("admin-minutes-user");
  const gameSelect = document.getElementById("admin-minutes-game");
  const gameOptions = document.getElementById("admin-minutes-games");
  const minutesValue = document.getElementById("admin-minutes-value");
  const minutesForm = document.getElementById("admin-minutes-form");
  const fillGameOptions = (userId) => {
    const games = data.gameStats.filter((stat) => stat.user_id === userId);
    gameOptions.innerHTML = games.map((stat) => `<option value="${escapeAdminText(stat.game_name)}"></option>`).join("");
    if (!games.some((stat) => stat.game_name === gameSelect.value)) gameSelect.value = games[0]?.game_name || "";
    const selected = games.find((stat) => stat.game_name === gameSelect.value);
    minutesValue.value = selected ? Math.floor(Number(selected.seconds || 0) / 60) : "";
  };
  if (managedUserSelect && userSelect && gameSelect && gameOptions && minutesValue && minutesForm) {
    const previousMinutesUserId = userSelect.value;
    userSelect.innerHTML = data.profiles.map((profile) => `<option value="${profile.id}">${escapeAdminText(profile.username)}</option>`).join("");
    userSelect.value = data.profiles.some((profile) => profile.id === previousMinutesUserId)
      ? previousMinutesUserId
      : (data.profiles[0]?.id || "");
    fillGameOptions(userSelect.value);
    userSelect.onchange = () => fillGameOptions(userSelect.value);
    const syncMinutesFromGame = () => {
      const selected = data.gameStats.find((stat) => stat.user_id === userSelect.value && stat.game_name === gameSelect.value);
      minutesValue.value = selected ? Math.floor(Number(selected.seconds || 0) / 60) : "";
    };
    gameSelect.oninput = syncMinutesFromGame;
    gameSelect.onchange = syncMinutesFromGame;
    if (minutesForm.dataset.bound !== "true") {
      minutesForm.dataset.bound = "true";
      minutesForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const userId = userSelect.value;
        const gameName = gameSelect.value.trim();
        const minutes = Number(minutesValue.value);
        if (!userId || !gameName || !Number.isSafeInteger(minutes) || minutes < 0 || minutes > 35791394) {
          return showAdminStatus("Choose a player and game, then enter a whole number of minutes.", true);
        }
        const { error } = await adminSupabase.from("game_stats").upsert({
          user_id: userId,
          game_name: gameName,
          seconds: minutes * 60,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,game_name" });
        if (error) return showAdminStatus(error.message, true);
        await refreshAdminDashboard(session);
        showAdminStatus(`Set ${gameName} to ${minutes} minutes.`);
      });
    }
  }
}

function showAdminStatus(message, error = false) {
  const status = document.getElementById("admin-status");
  status.textContent = message;
  status.style.color = error ? "#ff9caa" : "var(--primary-color)";
}

async function refreshAdminDashboard(session) {
  try {
    renderAdminDashboard(await loadAdminData(), session);
    showAdminStatus("Administrator access verified.");
  } catch (error) {
    showAdminStatus(error.message, true);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!adminSupabase) return window.location.replace("/");
  const { data: { session } } = await adminSupabase.auth.getSession();
  const email = String(session?.user?.email || "").toLowerCase();
  if (email !== "xander@users.xandersarcade.com") return window.location.replace("/");
  document.querySelectorAll("[data-admin-tab]").forEach((tab) => tab.addEventListener("click", () => {
    document.querySelectorAll("[data-admin-tab]").forEach((item) => item.classList.toggle("active", item === tab));
    document.querySelectorAll("[data-admin-view]").forEach((view) => {
      const selected = view.dataset.adminView === tab.dataset.adminTab;
      view.hidden = !selected;
      view.classList.toggle("active", selected);
    });
  }));
  document.getElementById("admin-content").hidden = false;
  await refreshAdminDashboard(session);
});
