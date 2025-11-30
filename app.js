// app.js

// 1. Supabase-Konfiguration – HIER deine Daten eintragen
const SUPABASE_URL = "https://lnbjukymvazrpveyqlsd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuYmp1a3ltdmF6cnB2ZXlxbHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MjQyNjUsImV4cCI6MjA4MDAwMDI2NX0.owwhm0To_GQYlSXbaXc0TMsbAbNxOLeA2SAnRQERnCk";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. DOM-Elemente
const whiskyGrid = document.getElementById("whiskyGrid");
const statusEl = document.getElementById("status");
const searchInput = document.getElementById("searchInput");

let allWhiskies = [];

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
  renderWhiskies(allWhiskies);
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

// 5. Suchfunktion
function applyFilter() {
  const q = (searchInput.value || "").toLowerCase().trim();

  if (!q) {
    renderWhiskies(allWhiskies);
    return;
  }

  const filtered = allWhiskies.filter((w) => {
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

  renderWhiskies(filtered);
}

// 6. Event Listener
searchInput.addEventListener("input", () => {
  applyFilter();
});

// 7. Start
loadWhiskies();
