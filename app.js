// app.js

// 1. Supabase-Konfiguration
const SUPABASE_URL = "https://lnbjukymvazrpveyqlsd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuYmp1a3ltdmF6cnB2ZXlxbHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MjQyNjUsImV4cCI6MjA4MDAwMDI2NX0.owwhm0To_GQYlSXbaXc0TMsbAbNxOLeA2SAnRQERnCk";

function renderStars(value) {
  const v = Number(value) || 0;
  if (!v) return "–";
  const full = "★".repeat(Math.min(5, v));
  const empty = "☆".repeat(Math.max(0, 5 - v));
  return full + empty;
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. DOM-Elemente
const whiskyGrid = document.getElementById("whiskyGrid");
const statusEl = document.getElementById("status");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

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
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");

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
let currentSort = "name_asc";

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
    if (loginButton) loginButton.classList.add("hidden");
    if (logoutButton) logoutButton.classList.remove("hidden");
  } else {
    authStatus.textContent = "Als Gast unterwegs";
    if (loginButton) loginButton.classList.remove("hidden");
    if (logoutButton) logoutButton.classList.add("hidden");
  }

  refreshRatingSection();
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

  if (!currentRatingValue) {
    ratingHint.textContent = "Bitte mindestens einen Stern vergeben.";
    return;
  }

  try {
    ratingHint.textContent = "Speichere Bewertung …";

    const { error } = await supabaseClient
      .from("ratings_green_island")
      .upsert(
        {
          user_id: currentUser.id,
          whisky_id: currentWhisky.id,
          rating: currentRatingValue,
          notes: currentRatingNote
        },
        {
          onConflict: "user_id,whisky_id"
        }
      );

    if (error) {
      console.error(error);
      ratingHint.textContent = "Bewertung konnte nicht gespeichert werden.";
      return;
    }

    ratingHint.textContent = "Bewertung gespeichert.";
    loadRatingStats();
  } catch (err) {
    console.error(err);
    ratingHint.textContent = "Bewertung konnte nicht gespeichert werden.";
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
    if (w.price_eur != null) {
      priceEl.textContent = `${w.price_eur.toFixed(2)} €`;
    }

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
      summaryParts.push(`Ø ${avgRounded.toFixed(1)} (${stats.count})`);
    }

    if (currentUser && myRating) {
      summaryParts.push(`Deine Bewertung: ${renderStars(myRating)}`);
    }

    if (!summaryParts.length) {
      ratingSummary.textContent = "Noch keine Bewertungen.";
    } else {
      ratingSummary.textContent = summaryParts.join(" · ");
    }

    card.appendChild(ratingSummary);

    // Klick öffnet Detail
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

  if (w.price_eur != null) {
    detailPrice.textContent = `Preis im Pub: ${w.price_eur.toFixed(2)} €`;
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
  currentSort = sortSelect ? sortSelect.value : "name_asc";

  let list = [...allWhiskies];

  list.sort((a, b) => {
    switch (currentSort) {
      case "name_asc":
        return (a.name || "").localeCompare(b.name || "");
      case "name_desc":
        return (b.name || "").localeCompare(a.name || "");
      case "price_asc":
        return (a.price_eur ?? 999999) - (b.price_eur ?? 999999);
      case "price_desc":
        return (b.price_eur ?? -1) - (a.price_eur ?? -1);
      case "abv_asc":
        return (a.abv ?? 0) - (b.abv ?? 0);
      case "abv_desc":
        return (b.abv ?? 0) - (a.abv ?? 0);
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

// Suche & Sortierung
if (searchInput) {
  searchInput.addEventListener("input", () => {
    updateView();
  });
}

if (sortSelect) {
  sortSelect.addEventListener("change", () => {
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
if (loginButton) {
  loginButton.addEventListener("click", () => {
    openAuthOverlay("login");
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
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
      if (ratingHint) {
        ratingHint.textContent = "Bitte anmelden, um zu bewerten.";
      }
      return;
    }
    if (!currentWhisky) return;

    setRatingUI(value, ratingNote ? ratingNote.value : currentRatingNote);
    if (ratingHint) {
      ratingHint.textContent = "Bewertung noch nicht gespeichert.";
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
loadWhiskies();