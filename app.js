// app.js

// 1. Supabase-Konfiguration – HIER deine Daten eintragen
const SUPABASE_URL = "https://lnbjukymvazrpveyqlsd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuYmp1a3ltdmF6cnB2ZXlxbHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MjQyNjUsImV4cCI6MjA4MDAwMDI2NX0.owwhm0To_GQYlSXbaXc0TMsbAbNxOLeA2SAnRQERnCk";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. DOM-Elemente
const whiskyGrid = document.getElementById("whiskyGrid");
const statusEl = document.getElementById("status");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

const detailOverlay = document.getElementById("detailOverlay");
const detailBackdrop = document.getElementById("detailBackdrop");
const detailClose = document.getElementById("detailClose");
const detailImage = document.getElementById("detailImage");
const detailName = document.getElementById("detailName");
const detailMeta = document.getElementById("detailMeta");
const detailPrice = document.getElementById("detailPrice");
const detailDescription = document.getElementById("detailDescription");

let allWhiskies = [];
let currentSort = "name_asc";

// 3. Whiskys laden
async function loadWhiskies() {
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

  // Statt direkt renderWhiskies → alles über updateView laufen lassen
  updateView();
}

// 4. Whiskys rendern
function renderWhiskies(list) {
  whiskyGrid.innerHTML = "";

  if (!list.length) {
    whiskyGrid.innerHTML = "<p>Keine Whiskys gefunden.</p>";
    return;
  }

  for (const w of list) {
    const card = document.createElement("article");
    card.className = "whisky-card";

    const img = document.createElement("img");
    img.src = w.image_url || "https://dummyimage.com/400x220/111111/ffffff&text=Whisky";
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
    desc.textContent = w.description || "Noch keine Beschreibung hinterlegt.";

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "Demo";

    card.appendChild(img);
    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(desc);
    card.appendChild(badge);

    whiskyGrid.appendChild(card);
  }
}

function openDetail(w) {
  if (!detailOverlay) return;

  // Bild
  detailImage.src = w.image_url || "https://dummyimage.com/400x260/111111/ffffff&text=Whisky";
  detailImage.alt = w.name || "Whisky";

  // Name
  detailName.textContent = w.name || "Unbekannter Whisky";

  // Meta (Destillerie, Land, Stil, Vol%)
  const parts = [];
  if (w.distillery) parts.push(w.distillery);
  if (w.origin_country) parts.push(w.origin_country);
  if (w.style) parts.push(w.style);
  if (w.abv != null) parts.push(`${w.abv}% Vol.`);
  detailMeta.textContent = parts.join(" · ") || "Keine weiteren Angaben";

  // Preis
  if (w.price_eur != null) {
    detailPrice.textContent = `Preis im Pub: ${w.price_eur.toFixed(2)} €`;
  } else {
    detailPrice.textContent = "";
  }

  // Beschreibung
  detailDescription.textContent =
    w.description || "Für diesen Whisky liegt noch keine Beschreibung vor.";

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
  const q = (searchInput.value || "").toLowerCase().trim();
  currentSort = sortSelect ? sortSelect.value : "name_asc";

  // 1. Kopie der Daten für Sortierung
  let list = [...allWhiskies];

  // 2. Sortierung anwenden
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

  // 3. Filter nach Suchtext
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

  // 4. Rendern
  renderWhiskies(list);
}

    // Klick auf die Karte öffnet die Detailansicht
    card.addEventListener("click", () => {
      openDetail(w);
    });

    whiskyGrid.appendChild(card);

// 6. Event Listener
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

// ESC-Taste schließt ebenfalls
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDetail();
  }
});
// 7. Start – jetzt wirklich aus Supabase laden
loadWhiskies();