// app.js

// 1. Supabase-Konfiguration – HIER deine Daten eintragen
const SUPABASE_URL = "https://lnbjukymvazrpveyqlsd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuYmp1a3ltdmF6cnB2ZXlxbHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MjQyNjUsImV4cCI6MjA4MDAwMDI2NX0.owwhm0To_GQYlSXbaXc0TMsbAbNxOLeA2SAnRQERnCk";

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
const authBar = document.getElementById("authBar");
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

// Zustand für Detail & Rating
let allWhiskies = [];
let currentSort = "name_asc";

let currentUser = null;
let authMode = "login"; // "login" oder "register"
const LS_USER_KEY = "gi_current_user";

let currentWhisky = null;
let currentRatingValue = 0;
let currentRatingNote = "";

// --- Auth-Helfer ---

function setCurrentUser(user) {
  currentUser = user;
  if (user) {
    const store = {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
    };
    localStorage.setItem(LS_USER_KEY, JSON.stringify(store));
  } else {
    localStorage.removeItem(LS_USER_KEY);
  }
  updateAuthUI();
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
  } catch {
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
}

function openAuthOverlay(mode) {
  if (!authOverlay) return;

  authMode = mode;
  authMessage.textContent = "";
  authEmail.value = "";
  authPassword.value = "";
  authDisplayName.value = "";

  if (mode === "login") {
    authTitle.textContent = "Anmelden";
    authHint.textContent =
      "Melde dich mit deiner E-Mail und deinem Passwort an.";
    authDisplayName.parentElement.classList.add("hidden");
    authSubmit.textContent = "Anmelden";
    switchToLogin.classList.add("hidden");
    switchToRegister.classList.remove("hidden");
  } else {
    authTitle.textContent = "Registrieren";
    authHint.textContent =
      "Lege ein Konto an, um deine verkosteten Whiskys zu speichern.";
    authDisplayName.parentElement.classList.remove("hidden");
    authSubmit.textContent = "Registrieren";
    switchToLogin.classList.remove("hidden");
    switchToRegister.classList.add("hidden");
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
  const displayName = authDisplayName.value.trim();

  if (!email || !password) {
    authMessage.textContent = "Bitte E-Mail und Passwort eingeben.";
    return;
  }

  if (authMode === "register" && !displayName) {
    authMessage.textContent = "Bitte einen Anzeigenamen angeben.";
    return;
  }

  authMessage.textContent = "Bitte warten …";

  try {
    if (authMode === "register") {
      const { data, error } = await supabaseClient
        .from("users_green_island")
        .insert([
          {
            email,
            password_hash: password, // später durch echten Hash ersetzen
            display_name: displayName,
          },
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
    authMessage.textContent =
      "Unerwarteter Fehler. Bitte später erneut versuchen.";
  }
}

// 3. Whiskys laden
async function loadWhiskies() {
  if (!statusEl) return;

  statusEl.textContent = "Lade Whiskys …";

  const { data, error } = await supabaseClient
    .from("whiskies_green_island")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    statusEl.textContent = "Fehler beim Laden der Whiskys.";
    return;
  }

  allWhiskies = data || [];
  statusEl.textContent = `${allWhiskies.length} Whisky(s) in der Demo geladen.`;

  updateView();
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

    // Klick auf die Karte öffnet die Detailansicht
    card.addEventListener("click", () => {
      openDetail(w);
    });

    whiskyGrid.appendChild(card);
  }
}

// Detail öffnen/schließen
function openDetail(w) {
  if (!detailOverlay) return;

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

  detailOverlay.classList.add("is-visible");
  detailOverlay.setAttribute("aria-hidden", "false");
}

function closeDetail() {
  if (!detailOverlay) return;
  detailOverlay.classList.remove("is-visible");
  detailOverlay.setAttribute("aria-hidden", "true");
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
        w.description,
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