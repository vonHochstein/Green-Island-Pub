// app.js

// 1. Supabase-Konfiguration
const SUPABASE_URL = "https://lnbjukymvazrpveyqlsd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuYmp1a3ltdmF6cnB2ZXlxbHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MjQyNjUsImV4cCI6MjA4MDAwMDI2NX0.owwhm0To_GQYlSXbaXc0TMsbAbNxOLeA2SAnRQERnCk";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sterne-Rendering für Durchschnitt / eigene Bewertung
function renderStars(value) {
  let v = Number(value) || 0;
  v = Math.round(v * 2) / 2; // auf halbe Sterne runden

  const full = Math.floor(v);
  const hasHalf = v - full === 0.5;
  const max = 5;

  let html = "";

  for (let i = 0; i < full; i++) {
    html += `<span class="star full"></span>`;
  }

  if (hasHalf) {
    html += `<span class="star half"></span>`;
  }

  const used = full + (hasHalf ? 1 : 0);
  for (let i = used; i < max; i++) {
    html += `<span class="star empty"></span>`;
  }

  return html;
}

// 2. DOM-Elemente
const whiskyGrid = document.getElementById("whiskyGrid");
const statusEl = document.getElementById("status");
const searchInput = document.getElementById("searchInput");

// Sortier-UI
const sortFieldSelect = document.getElementById("sortFieldSelect");
const sortDirToggle = document.getElementById("sortDirToggle");

// Fortschritt in der Auth-Bar
const progressSection = document.getElementById("progressSection");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");

// Detail-Overlay
const detailOverlay = document.getElementById("detailOverlay");
const detailBackdrop = document.getElementById("detailBackdrop");
const detailClose = document.getElementById("detailClose");
const detailImage = document.getElementById("detailImage");
const detailName = document.getElementById("detailName");
const detailMeta = document.getElementById("detailMeta");
const detailPrice = document.getElementById("detailPrice");
const detailDescription = document.getElementById("detailDescription");

// Rating-Elemente
const ratingSection = document.getElementById("ratingSection");
const ratingStars = document.getElementById("ratingStars");
const ratingHint = document.getElementById("ratingHint");
const ratingNote = document.getElementById("ratingNote");
const ratingSave = document.getElementById("ratingSave");

// Auth-Bar & Overlay
const authStatus = document.getElementById("authStatus");
const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const btnLogout = document.getElementById("btnLogout");

const authOverlay = document.getElementById("authOverlay");
const authBackdrop = document.getElementById("authBackdrop");
const authClose = document.getElementById("authClose");
const authTitle = document.getElementById("authTitle");
const authHint = document.getElementById("authHint");
const authForm = document.getElementById("authForm");
const authDisplayName = document.getElementById("authDisplayName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const switchToRegister = document.getElementById("switchToRegister");
const switchToLogin = document.getElementById("switchToLogin");
const authMessage = document.getElementById("authMessage");

// Zustand
let allWhiskies = [];
let currentSortField = "name";  // name, price, abv, rating_avg, rating_my
let currentSortDir = "asc";     // asc | desc

let currentUser = null;
let authMode = "login";
const LS_USER_KEY = "gi_current_user";

let currentWhisky = null;
let currentRatingValue = 0;
let currentRatingNote = "";

// Rating-Übersichten
let ratingStatsByWhisky = {}; // whisky_id -> { sum, count, avg }
let myRatingsByWhisky = {};   // whisky_id -> rating

// --- Auth-Helfer ---

function setCurrentUser(user) {
  currentUser = user;
  if (user) {
    const store = {
      id: user.id,
      email: user.email,
      display_name: user.display_name
    };
    localStorage.setItem(LS_USER_KEY, JSON.stringify(store));
  } else {
    localStorage.removeItem(LS_USER_KEY);
  }
  updateAuthUI();
  loadRatingStats();
}

function updateProgress() {
  if (!currentUser) {
    if (progressSection) progressSection.classList.add("hidden");
    return;
  }

  const total = allWhiskies.length;
  const mine = Object.keys(myRatingsByWhisky).length;

  if (total === 0) {
    if (progressSection) progressSection.classList.add("hidden");
    return;
  }

  const percent = Math.round((mine / total) * 1000) / 10; // z.B. 16.7 %

  if (progressText) {
    progressText.textContent =
      `Du hast ${mine} von ${total} Whiskys bewertet (${percent} %)`;
  }

  if (progressBar) {
    progressBar.style.width = percent + "%";
  }

  if (progressSection) {
    progressSection.classList.remove("hidden");
  }
}

function loadUserFromStorage() {
  const raw = localStorage.getItem(LS_USER_KEY);
  if (!raw) {
    currentUser = null;
    updateAuthUI();
    return;
  }
  try {
    currentUser = JSON.parse(raw);
  } catch (e) {
    currentUser = null;
  }
  updateAuthUI();
}

function updateAuthUI() {
  if (!authStatus) return;

  if (currentUser) {
    authStatus.textContent =
      "Angemeldet als: " +
      (currentUser.display_name || currentUser.email || "Unbekannt");
    if (btnLogin) btnLogin.classList.add("hidden");
    if (btnRegister) btnRegister.classList.add("hidden");
    if (btnLogout) btnLogout.classList.remove("hidden");
  } else {
    authStatus.textContent = "Als Gast unterwegs";
    if (btnLogin) btnLogin.classList.remove("hidden");
    if (btnRegister) btnRegister.classList.remove("hidden");
    if (btnLogout) btnLogout.classList.add("hidden");
    if (progressSection) progressSection.classList.add("hidden");
  }

  refreshRatingSection();
  updateProgress();
  updateSortOptionsForAuth();
}

function updateSortOptionsForAuth() {
  if (!sortFieldSelect) return;

  const myOptions = Array.from(
    sortFieldSelect.querySelectorAll("option[data-scope='my']")
  );

  if (currentUser) {
    myOptions.forEach((opt) => {
      opt.disabled = false;
      opt.hidden = false;
    });
  } else {
    if (sortFieldSelect.value === "rating_my") {
      sortFieldSelect.value = "name";
      currentSortField = "name";
      updateView();
    }

    myOptions.forEach((opt) => {
      opt.disabled = true;
      opt.hidden = true;
    });
  }
}

function openAuthOverlay(mode) {
  if (!authOverlay) return;

  authMode = mode;
  if (authMessage) authMessage.textContent = "";
  if (authEmail) authEmail.value = "";
  if (authPassword) authPassword.value = "";
  if (authDisplayName) authDisplayName.value = "";

  if (mode === "login") {
    if (authTitle) authTitle.textContent = "Anmelden";
    if (authHint) authHint.textContent =
      "Melde dich mit deiner E-Mail und deinem Passwort an.";
    if (authDisplayName && authDisplayName.parentElement) {
      authDisplayName.parentElement.classList.add("hidden");
    }
    if (authSubmit) authSubmit.textContent = "Anmelden";
    if (switchToLogin) switchToLogin.classList.add("hidden");
    if (switchToRegister) switchToRegister.classList.remove("hidden");
  } else {
    if (authTitle) authTitle.textContent = "Registrieren";
    if (authHint) authHint.textContent =
      "Lege ein Konto an, um deine verkosteten Whiskys zu speichern.";
    if (authDisplayName && authDisplayName.parentElement) {
      authDisplayName.parentElement.classList.remove("hidden");
    }
    if (authSubmit) authSubmit.textContent = "Registrieren";
    if (switchToLogin) switchToLogin.classList.remove("hidden");
    if (switchToRegister) switchToRegister.classList.add("hidden");
  }

  authOverlay.classList.add("is-visible");
  authOverlay.setAttribute("aria-hidden", "false");
}

function closeAuthOverlay() {
  if (!authOverlay) return;
  authOverlay.classList.remove("is-visible");
  authOverlay.setAttribute("aria-hidden", "true");
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!authEmail || !authPassword) return;

  const email = authEmail.value.trim().toLowerCase();
  const password = authPassword.value.trim();
  const displayName = authDisplayName ? authDisplayName.value.trim() : "";

  if (!email || !password) {
    if (authMessage) authMessage.textContent = "Bitte E-Mail und Passwort eingeben.";
    return;
  }

  if (authMode === "register" && !displayName) {
    if (authMessage) authMessage.textContent = "Bitte einen Anzeigenamen angeben.";
    return;
  }

  if (authMessage) authMessage.textContent = "Bitte warten …";

  try {
    if (authMode === "register") {
      const { data, error } = await supabaseClient
        .from("users_green_island")
        .insert([
          {
            email,
            password_hash: password, // Demo: Klartext
            display_name: displayName
          }
        ])
        .select("*");

      if (error) {
        console.error(error);
        if (
          error.message &&
          error.message.toLowerCase().includes("duplicate")
        ) {
          authMessage.textContent =
            "Für diese E-Mail existiert bereits ein Konto.";
        } else {
          authMessage.textContent =
            "Registrierung fehlgeschlagen. Bitte später erneut versuchen.";
        }
        return;
      }

      const user = data && data[0];
      if (!user) {
        authMessage.textContent =
          "Registrierung fehlgeschlagen. Bitte später erneut versuchen.";
        return;
      }

      setCurrentUser(user);
      closeAuthOverlay();
    } else {
      const { data, error } = await supabaseClient
        .from("users_green_island")
        .select("*")
        .eq("email", email)
        .eq("password_hash", password)
        .limit(1);

      if (error) {
        console.error(error);
        authMessage.textContent =
          "Anmeldung fehlgeschlagen. Bitte später erneut versuchen.";
        return;
      }

      const user = data && data[0];
      if (!user) {
        authMessage.textContent = "E-Mail oder Passwort ist falsch.";
        return;
      }

      setCurrentUser(user);
      closeAuthOverlay();
    }
  } catch (err) {
    console.error(err);
    if (authMessage) {
      authMessage.textContent =
        "Unerwarteter Fehler. Bitte später erneut versuchen.";
    }
  }
}

// --- Rating-Helfer ---

function setRatingUI(value, note) {
  currentRatingValue = value || 0;
  currentRatingNote = note || "";

  if (ratingStars) {
    const buttons = ratingStars.querySelectorAll("button[data-value]");
    buttons.forEach((btn) => {
      const v = Number(btn.getAttribute("data-value"));
      btn.classList.toggle("is-active", v <= currentRatingValue);
    });
  }

  if (ratingNote) {
    ratingNote.value = currentRatingNote;
  }
}

function refreshRatingSection() {
  if (!ratingSection || !ratingHint) return;

  if (!currentUser) {
    if (ratingStars) {
      const buttons = ratingStars.querySelectorAll("button[data-value]");
      buttons.forEach((btn) => {
        btn.disabled = true;
        btn.classList.remove("is-active");
      });
    }
    if (ratingNote) {
      ratingNote.disabled = true;
      ratingNote.value = "";
    }
    if (ratingSave) {
      ratingSave.disabled = true;
    }
    ratingHint.textContent = "Bitte anmelden, um zu bewerten.";
  } else {
    if (ratingStars) {
      const buttons = ratingStars.querySelectorAll("button[data-value]");
      buttons.forEach((btn) => {
        btn.disabled = false;
      });
    }
    if (ratingNote) {
      ratingNote.disabled = false;
    }
    if (ratingSave) {
      ratingSave.disabled = false;
    }

    if (currentWhisky) {
      loadCurrentUserRatingForCurrentWhisky();
    } else {
      setRatingUI(0, "");
      ratingHint.textContent = "Gib deine persönliche Bewertung ab.";
    }
  }
}

async function loadCurrentUserRatingForCurrentWhisky() {
  if (!currentUser || !currentWhisky) return;

  try {
    const { data, error } = await supabaseClient
      .from("ratings_green_island")
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("whisky_id", currentWhisky.id)
      .limit(1);

    if (error) {
      console.error(error);
      setRatingUI(0, "");
      ratingHint.textContent = "Bewertung konnte nicht geladen werden.";
      return;
    }

    const rating = data && data[0];
    if (rating) {
      setRatingUI(rating.rating || 0, rating.notes || "");
      ratingHint.textContent = "Deine gespeicherte Bewertung.";
    } else {
      setRatingUI(0, "");
      ratingHint.textContent = "Gib deine persönliche Bewertung ab.";
    }
  } catch (err) {
    console.error(err);
    setRatingUI(0, "");
    ratingHint.textContent = "Bewertung konnte nicht geladen werden.";
  }
}

async function saveCurrentRating() {
  if (!currentUser || !currentWhisky) {
    if (ratingHint) {
      ratingHint.textContent = "Bitte anmelden, um zu bewerten.";
    }
    return;
  }

  if (ratingNote) {
    currentRatingNote = ratingNote.value.trim();
  }

  // Kein Zwang mehr zu mindestens einem Stern:
  // rating kann jetzt 0 sein, Note kann leer oder Text sein.
  try {
    if (ratingHint) {
      ratingHint.textContent = "Speichere Bewertung …";
    }

    const { error } = await supabaseClient
      .from("ratings_green_island")
      .upsert(
        {
          user_id: currentUser.id,
          whisky_id: currentWhisky.id,
          rating: currentRatingValue,   // 0 = "keine Sterne"
          notes: currentRatingNote      // "" oder Text
        },
        {
          onConflict: "user_id,whisky_id"
        }
      );

    if (error) {
      console.error(error);
      if (ratingHint) {
        ratingHint.textContent = "Bewertung konnte nicht gespeichert werden.";
      }
      return;
    }

    if (ratingHint) {
      if (!currentRatingValue && !currentRatingNote) {
        ratingHint.textContent = "Eintrag ohne Bewertung gespeichert.";
      } else {
        ratingHint.textContent = "Bewertung gespeichert.";
      }
    }

    loadRatingStats();
  } catch (err) {
    console.error(err);
    if (ratingHint) {
      ratingHint.textContent = "Bewertung konnte nicht gespeichert werden.";
    }
  }
}

// --- Rating-Übersicht laden ---

async function loadRatingStats() {
  try {
    const { data, error } = await supabaseClient
      .from("ratings_green_island")
      .select("whisky_id, user_id, rating");

    if (error) {
      console.error(error);
      ratingStatsByWhisky = {};
      myRatingsByWhisky = {};
      return;
    }

    const stats = {};
    const mine = {};

    if (data) {
      for (const row of data) {
        const wid = row.whisky_id;
        const r = Number(row.rating) || 0;
        if (!wid || !r) continue;

        if (!stats[wid]) stats[wid] = { sum: 0, count: 0, avg: 0 };
        stats[wid].sum += r;
        stats[wid].count += 1;

        if (currentUser && row.user_id === currentUser.id) {
          mine[wid] = r;
        }
      }

      for (const wid in stats) {
        const s = stats[wid];
        s.avg = s.count > 0 ? s.sum / s.count : 0;
      }
    }

    ratingStatsByWhisky = stats;
    myRatingsByWhisky = mine;

    updateView();
  } catch (err) {
    console.error(err);
  }
  updateProgress();
}

// 3. Whiskys laden
async function loadWhiskies() {
  if (statusEl) statusEl.textContent = "Lade Whiskys …";

  const { data, error } = await supabaseClient
    .from("whiskies_green_island")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    if (statusEl) statusEl.textContent = "Fehler beim Laden der Whiskys.";
    return;
  }

  allWhiskies = data || [];
  if (statusEl) {
    statusEl.textContent = `${allWhiskies.length} Whisky(s) in der Demo geladen.`;
  }

  updateView();
  loadRatingStats();
  updateProgress();
}

// 4. Whiskys rendern
function renderWhiskies(list) {
  if (!whiskyGrid) return;

  whiskyGrid.innerHTML = "";

  if (!list.length) {
    whiskyGrid.innerHTML = "<p>Keine Whiskys gefunden.</p>";
    return;
  }

  for (const w of list) {
    const card = document.createElement("article");
    card.className = "whisky-card";

    const img = document.createElement("img");
    img.src =
      w.image_url ||
      "https://dummyimage.com/400x220/111111/ffffff&text=Whisky";
    img.alt = w.name || "Whisky";

    const header = document.createElement("div");
    header.className = "whisky-header";

    const nameEl = document.createElement("div");
    nameEl.className = "whisky-name";
    nameEl.textContent = w.name;

    const priceEl = document.createElement("div");
    priceEl.className = "whisky-price";

    const priceParts = [];
    if (w.price_eur != null) {
      priceParts.push(`2 cl ${w.price_eur.toFixed(2)} €`);
    }
    if (w.price_4cl_eur != null) {
      priceParts.push(`4 cl ${w.price_4cl_eur.toFixed(2)} €`);
    }

    priceEl.textContent = priceParts.join(" · ");

    header.appendChild(nameEl);
    header.appendChild(priceEl);

    const meta = document.createElement("div");
    meta.className = "whisky-meta";
    const parts = [];
    if (w.distillery) parts.push(w.distillery);
    if (w.origin_country) parts.push(w.origin_country);
    if (w.style) parts.push(w.style);
    if (w.abv != null) parts.push(`${w.abv}% Vol.`);
    meta.textContent = parts.join(" · ");

    const desc = document.createElement("div");
    desc.className = "whisky-desc";
    desc.textContent =
      w.description || "Noch keine Beschreibung hinterlegt.";

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "Demo";

    card.appendChild(img);
    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(desc);
    card.appendChild(badge);

    // Bewertungs-Zeile
    const ratingSummary = document.createElement("div");
    ratingSummary.className = "whisky-rating-summary";

    const stats = ratingStatsByWhisky[w.id];
    const myRating = myRatingsByWhisky[w.id];

    const summaryParts = [];

    if (stats && stats.count > 0) {
      const avgRounded = Math.round(stats.avg * 10) / 10;
      summaryParts.push(
        `Ø ${avgRounded.toFixed(1)} ${renderStars(stats.avg)} (${stats.count})`
      );
    }

    if (currentUser && myRating) {
      summaryParts.push(`Deine Bewertung: ${renderStars(myRating)}`);
    }

    if (!summaryParts.length) {
      ratingSummary.textContent = "Noch keine Bewertungen.";
    } else {
      ratingSummary.innerHTML = summaryParts.join(" · ");
    }

    card.appendChild(ratingSummary);

    card.addEventListener("click", () => {
      openDetail(w);
    });

    whiskyGrid.appendChild(card);
  }
}

// Detail öffnen/schließen
function openDetail(w) {
  if (!detailOverlay) return;

  currentWhisky = w;

  detailImage.src =
    w.image_url ||
    "https://dummyimage.com/400x260/111111/ffffff&text=Whisky";
  detailImage.alt = w.name || "Whisky";

  detailName.textContent = w.name || "Unbekannter Whisky";

  const parts = [];
  if (w.distillery) parts.push(w.distillery);
  if (w.origin_country) parts.push(w.origin_country);
  if (w.style) parts.push(w.style);
  if (w.abv != null) parts.push(`${w.abv}% Vol.`);
  detailMeta.textContent = parts.join(" · ") || "Keine weiteren Angaben";

  const priceParts = [];
  if (w.price_eur != null) {
    priceParts.push(`2 cl ${w.price_eur.toFixed(2)} €`);
  }
  if (w.price_4cl_eur != null) {
    priceParts.push(`4 cl ${w.price_4cl_eur.toFixed(2)} €`);
  }

  if (priceParts.length) {
    detailPrice.textContent = `Preis im Pub: ${priceParts.join(" · ")}`;
  } else {
    detailPrice.textContent = "";
  }

  detailDescription.textContent =
    w.description ||
    "Für diesen Whisky liegt noch keine Beschreibung vor.";

  setRatingUI(0, "");
  refreshRatingSection();

  detailOverlay.classList.add("is-visible");
  detailOverlay.setAttribute("aria-hidden", "false");
}

function closeDetail() {
  if (!detailOverlay) return;
  detailOverlay.classList.remove("is-visible");
  detailOverlay.setAttribute("aria-hidden", "true");
  currentWhisky = null;
  setRatingUI(0, "");
}

// 5. Suche + Sortierung
function updateView() {
  const q = (searchInput?.value || "").toLowerCase().trim();

  currentSortField = sortFieldSelect ? sortFieldSelect.value : "name";
  const dir = currentSortDir;

  let list = [...allWhiskies];

  list.sort((a, b) => {
    const getAvg = (w) => {
      const stats = ratingStatsByWhisky[w.id];
      return stats ? stats.avg : 0;
    };

    const getMy = (w) => {
      if (!currentUser) return 0;
      const r = myRatingsByWhisky[w.id];
      return r ? Number(r) : 0;
    };

    const mul = dir === "asc" ? 1 : -1;

    switch (currentSortField) {
      case "name": {
        const cmp = (a.name || "").localeCompare(b.name || "");
        return cmp * mul;
      }

      case "price": {
        const av = a.price_eur ?? Number.POSITIVE_INFINITY;
        const bv = b.price_eur ?? Number.POSITIVE_INFINITY;
        return (av - bv) * mul;
      }

      case "abv": {
        const av = a.abv ?? 0;
        const bv = b.abv ?? 0;
        return (av - bv) * mul;
      }

      case "rating_avg": {
        const av = getAvg(a);
        const bv = getAvg(b);
        if (av !== bv) return (av - bv) * mul;
        return (a.name || "").localeCompare(b.name || "");
      }

      case "rating_my": {
        const av = getMy(a);
        const bv = getMy(b);
        if (av !== bv) return (av - bv) * mul;
        return (a.name || "").localeCompare(b.name || "");
      }

      default:
        return 0;
    }
  });

  if (q) {
    list = list.filter((w) => {
      const haystack = [
        w.name,
        w.distillery,
        w.origin_country,
        w.style,
        w.description
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }

  renderWhiskies(list);
}

// 6. Event Listener

// Suche
if (searchInput) {
  searchInput.addEventListener("input", () => {
    updateView();
  });
}

// Sortierfeld
if (sortFieldSelect) {
  sortFieldSelect.addEventListener("change", () => {
    updateView();
  });
}

// Sortierrichtung (▲ / ▼)
if (sortDirToggle) {
  sortDirToggle.addEventListener("click", () => {
    currentSortDir = currentSortDir === "asc" ? "desc" : "asc";

    if (currentSortDir === "asc") {
      sortDirToggle.textContent = "▲";
      sortDirToggle.classList.remove("sort-dir-desc");
      sortDirToggle.classList.add("sort-dir-asc");
      sortDirToggle.setAttribute("aria-label", "Aufsteigend sortieren");
    } else {
      sortDirToggle.textContent = "▼";
      sortDirToggle.classList.remove("sort-dir-asc");
      sortDirToggle.classList.add("sort-dir-desc");
      sortDirToggle.setAttribute("aria-label", "Absteigend sortieren");
    }

    updateView();
  });
}

// Detail-Overlay schließen
if (detailClose) {
  detailClose.addEventListener("click", () => {
    closeDetail();
  });
}

if (detailBackdrop) {
  detailBackdrop.addEventListener("click", () => {
    closeDetail();
  });
}

// Auth-Events
if (btnLogin) {
  btnLogin.addEventListener("click", () => {
    openAuthOverlay("login");
  });
}

if (btnRegister) {
  btnRegister.addEventListener("click", () => {
    openAuthOverlay("register");
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    setCurrentUser(null);
  });
}

if (authClose) {
  authClose.addEventListener("click", () => {
    closeAuthOverlay();
  });
}

if (authBackdrop) {
  authBackdrop.addEventListener("click", () => {
    closeAuthOverlay();
  });
}

if (switchToRegister) {
  switchToRegister.addEventListener("click", () => {
    openAuthOverlay("register");
  });
}

if (switchToLogin) {
  switchToLogin.addEventListener("click", () => {
    openAuthOverlay("login");
  });
}

if (authForm) {
  authForm.addEventListener("submit", handleAuthSubmit);
}

// Sterne-Events
if (ratingStars) {
  ratingStars.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const value = Number(target.getAttribute("data-value"));
    if (!value) return;

    if (!currentUser) {
      if (ratingHint) ratingHint.textContent = "Bitte anmelden, um zu bewerten.";
      return;
    }
    if (!currentWhisky) return;

    // ⭐ Toggle-Logik
    let newValue = value;
    if (currentRatingValue === value) {
      newValue = 0; // Bewertung zurücksetzen
    }

    setRatingUI(newValue, ratingNote ? ratingNote.value : currentRatingNote);

    if (ratingHint) {
      if (newValue === 0) {
        ratingHint.textContent = "Bewertung zurückgesetzt.";
      } else {
        ratingHint.textContent = "Bewertung noch nicht gespeichert.";
      }
    }
  });
}

if (ratingSave) {
  ratingSave.addEventListener("click", () => {
    saveCurrentRating();
  });
}

// ESC-Taste: beide Overlays schließen
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDetail();
    closeAuthOverlay();
  }
});

// 7. Start
loadUserFromStorage();
updateSortOptionsForAuth();
loadWhiskies();