import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const CATEGORY_COLORS = {
  restaurant: "#FF6B6B",
  cafe: "#FFD93D",
  gym: "#6BCB77",
  retail: "#4D96FF",
  health: "#C77DFF",
  hotel: "#FF9F1C",
  default: "#A0AEC0",
};

const CATEGORY_ICONS = {
  restaurant: "🍽️", cafe: "☕", gym: "💪",
  retail: "🛍️", health: "🏥", hotel: "🏨", default: "📍",
};

function createColoredIcon(category) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
  const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.default;
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${color};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      width:36px;height:36px;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 12px rgba(0,0,0,0.3);
      border:2px solid white;
    "><span style="transform:rotate(45deg);font-size:16px">${icon}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

function MapController({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, 15); }, [center]);
  return null;
}

export default function App() {
  const [location, setLocation] = useState([40.7128, -74.006]);
  const [businesses, setBusinesses] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tab, setTab] = useState("businesses"); // businesses | suggestions

  // Get user location on load
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setLocation([pos.coords.latitude, pos.coords.longitude]),
      () => {}
    );
  }, []);

  // Fetch businesses from backend
  const fetchBusinesses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses?lat=${location[0]}&lng=${location[1]}&query=${searchQuery}`);
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch (e) {
      // Demo fallback data
      setBusinesses(DEMO_BUSINESSES.map(b => ({
        ...b,
        lat: location[0] + (Math.random() - 0.5) * 0.01,
        lng: location[1] + (Math.random() - 0.5) * 0.01,
      })));
    }
    setLoading(false);
  };

  // Get AI suggestions
  const getAiSuggestions = async () => {
    setAiLoading(true);
    setTab("suggestions");
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businesses, location }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (e) {
      // Fallback to Claude API directly
      await callClaudeDirectly();
    }
    setAiLoading(false);
  };

  const callClaudeDirectly = async () => {
    const categoryCounts = businesses.reduce((acc, b) => {
      acc[b.category] = (acc[b.category] || 0) + 1;
      return acc;
    }, {});

    const prompt = `You are a business intelligence advisor. Analyze these businesses in the area:
${JSON.stringify(categoryCounts, null, 2)}

Total businesses: ${businesses.length}
Location: ${location[0].toFixed(4)}, ${location[1].toFixed(4)}

Suggest 4 business types that would THRIVE here based on what's missing or underrepresented. 
For each, respond ONLY with JSON array (no markdown):
[{"type":"Business Name","reason":"Why it would thrive","score":85,"icon":"emoji","investment":"$50k-$100k","competition":"Low"}]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    const text = data.content?.map(c => c.text).join("") || "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    setSuggestions(JSON.parse(clean));
  };

  useEffect(() => { fetchBusinesses(); }, [location]);

  const filtered = activeFilter === "all"
    ? businesses
    : businesses.filter(b => b.category === activeFilter);

  const categories = ["all", ...new Set(businesses.map(b => b.category))];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', sans-serif", background: "#0A0E1A" }}>
      {/* Header */}
      <header style={{
        background: "linear-gradient(135deg, #0D1B2A 0%, #1B2838 100%)",
        borderBottom: "1px solid rgba(99,179,237,0.15)",
        padding: "0 24px",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 1000,
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 28 }}>🐝</div>
          <div>
            <div style={{ color: "#63B3ED", fontWeight: 800, fontSize: 20, letterSpacing: "-0.5px" }}>BuzzTips</div>
            <div style={{ color: "#4A5568", fontSize: 11, letterSpacing: "2px", textTransform: "uppercase" }}>Business Intelligence</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ display: "flex", gap: 8, flex: 1, maxWidth: 480, margin: "0 32px" }}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchBusinesses()}
            placeholder="Search area, city, or zip code..."
            style={{
              flex: 1, padding: "10px 16px", borderRadius: 10,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(99,179,237,0.2)",
              color: "#E2E8F0", fontSize: 14, outline: "none",
            }}
          />
          <button onClick={fetchBusinesses} style={{
            padding: "10px 20px", borderRadius: 10, background: "#63B3ED",
            border: "none", color: "#0A0E1A", fontWeight: 700, cursor: "pointer", fontSize: 14,
          }}>Search</button>
        </div>

        <button onClick={getAiSuggestions} disabled={aiLoading} style={{
          padding: "10px 20px", borderRadius: 10,
          background: "linear-gradient(135deg, #667eea, #764ba2)",
          border: "none", color: "white", fontWeight: 700, cursor: "pointer",
          fontSize: 14, display: "flex", alignItems: "center", gap: 8,
          opacity: aiLoading ? 0.7 : 1,
        }}>
          {aiLoading ? "🤖 Analyzing..." : "✨ AI Suggest"}
        </button>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <aside style={{
          width: sidebarOpen ? 360 : 0,
          minWidth: sidebarOpen ? 360 : 0,
          background: "#0D1B2A",
          borderRight: "1px solid rgba(99,179,237,0.1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "all 0.3s ease",
        }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(99,179,237,0.1)" }}>
            {["businesses", "suggestions"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "14px", border: "none", cursor: "pointer",
                background: tab === t ? "rgba(99,179,237,0.1)" : "transparent",
                color: tab === t ? "#63B3ED" : "#4A5568",
                fontWeight: tab === t ? 700 : 400,
                fontSize: 13, textTransform: "capitalize",
                borderBottom: tab === t ? "2px solid #63B3ED" : "2px solid transparent",
                transition: "all 0.2s",
              }}>
                {t === "businesses" ? `📍 Businesses (${businesses.length})` : `✨ AI Suggestions`}
              </button>
            ))}
          </div>

          {/* Filter chips */}
          {tab === "businesses" && (
            <div style={{ padding: "12px 16px", display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1px solid rgba(99,179,237,0.1)" }}>
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveFilter(cat)} style={{
                  padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                  background: activeFilter === cat ? "#63B3ED" : "rgba(255,255,255,0.05)",
                  color: activeFilter === cat ? "#0A0E1A" : "#718096",
                  border: "1px solid rgba(99,179,237,0.2)", fontWeight: 600,
                }}>
                  {cat === "all" ? "All" : `${CATEGORY_ICONS[cat] || "📍"} ${cat}`}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {tab === "businesses" && (
              loading ? (
                <div style={{ color: "#4A5568", textAlign: "center", marginTop: 40 }}>🔍 Finding businesses...</div>
              ) : filtered.map((biz, i) => (
                <div key={i} onClick={() => setSelectedBusiness(biz)} style={{
                  padding: "14px 16px", marginBottom: 10, borderRadius: 12,
                  background: selectedBusiness?.name === biz.name ? "rgba(99,179,237,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${selectedBusiness?.name === biz.name ? "rgba(99,179,237,0.4)" : "rgba(255,255,255,0.06)"}`,
                  cursor: "pointer", transition: "all 0.2s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{CATEGORY_ICONS[biz.category] || "📍"}</span>
                    <div>
                      <div style={{ color: "#E2E8F0", fontWeight: 600, fontSize: 14 }}>{biz.name}</div>
                      <div style={{ color: "#4A5568", fontSize: 12 }}>{biz.address}</div>
                    </div>
                    <div style={{
                      marginLeft: "auto", padding: "2px 8px", borderRadius: 6,
                      background: CATEGORY_COLORS[biz.category] + "22",
                      color: CATEGORY_COLORS[biz.category] || "#A0AEC0",
                      fontSize: 11, fontWeight: 600,
                    }}>{biz.category}</div>
                  </div>
                  {biz.rating && (
                    <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: 12, color: "#718096" }}>
                      <span>⭐ {biz.rating}</span>
                      {biz.reviewCount && <span>({biz.reviewCount} reviews)</span>}
                    </div>
                  )}
                </div>
              ))
            )}

            {tab === "suggestions" && (
              aiLoading ? (
                <div style={{ textAlign: "center", color: "#718096", marginTop: 60 }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
                  <div>Analyzing {businesses.length} businesses...</div>
                  <div style={{ fontSize: 12, marginTop: 8, color: "#4A5568" }}>Claude AI is thinking</div>
                </div>
              ) : suggestions.length === 0 ? (
                <div style={{ textAlign: "center", color: "#4A5568", marginTop: 60 }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>✨</div>
                  <div>Click "AI Suggest" to get business recommendations</div>
                </div>
              ) : suggestions.map((s, i) => (
                <div key={i} style={{
                  padding: 16, marginBottom: 12, borderRadius: 14,
                  background: "linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1))",
                  border: "1px solid rgba(102,126,234,0.2)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 28 }}>{s.icon || "💡"}</span>
                    <div>
                      <div style={{ color: "#E2E8F0", fontWeight: 700, fontSize: 15 }}>{s.type}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(107,203,119,0.2)", color: "#6BCB77", fontSize: 11, fontWeight: 600 }}>
                          {s.score}% Fit Score
                        </span>
                        <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(255,107,107,0.15)", color: "#FF6B6B", fontSize: 11 }}>
                          {s.competition} Competition
                        </span>
                      </div>
                    </div>
                  </div>
                  <p style={{ color: "#A0AEC0", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{s.reason}</p>
                  <div style={{ marginTop: 10, fontSize: 12, color: "#667eea" }}>💰 Est. Investment: {s.investment}</div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            position: "absolute", left: sidebarOpen ? -1 : 0, top: "50%",
            transform: "translateY(-50%)", zIndex: 1000,
            background: "#1B2838", border: "1px solid rgba(99,179,237,0.3)",
            color: "#63B3ED", padding: "12px 6px", cursor: "pointer",
            borderRadius: sidebarOpen ? "0 8px 8px 0" : "8px",
            fontSize: 12,
          }}>{sidebarOpen ? "◀" : "▶"}</button>

          <MapContainer
            center={location}
            zoom={15}
            style={{ width: "100%", height: "100%" }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='© OpenStreetMap © CARTO'
            />
            <MapController center={location} />
            <Circle center={location} radius={500} pathOptions={{ color: "#63B3ED", fillOpacity: 0.05, weight: 1 }} />
            {filtered.map((biz, i) => (
              <Marker
                key={i}
                position={[biz.lat, biz.lng]}
                icon={createColoredIcon(biz.category)}
                eventHandlers={{ click: () => setSelectedBusiness(biz) }}
              >
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <strong>{biz.name}</strong><br />
                    <span style={{ color: "#666", fontSize: 12 }}>{biz.category}</span><br />
                    {biz.rating && <span>⭐ {biz.rating}</span>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Stats overlay */}
          <div style={{
            position: "absolute", bottom: 24, right: 24, zIndex: 1000,
            background: "rgba(13,27,42,0.95)", borderRadius: 12, padding: "16px 20px",
            border: "1px solid rgba(99,179,237,0.2)", backdropFilter: "blur(10px)",
          }}>
            <div style={{ color: "#4A5568", fontSize: 11, textTransform: "uppercase", letterSpacing: "1px" }}>Area Stats</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", marginTop: 8 }}>
              {[
                ["Total", businesses.length],
                ["Categories", new Set(businesses.map(b => b.category)).size],
                ["Top Type", businesses.reduce((acc, b) => { acc[b.category] = (acc[b.category]||0)+1; return acc; }, {})],
              ].map(([label, val], i) => (
                <div key={i}>
                  <div style={{ color: "#63B3ED", fontWeight: 700, fontSize: 18 }}>
                    {i === 2 ? Object.entries(val).sort((a,b)=>b[1]-a[1])[0]?.[0] || "-" : val}
                  </div>
                  <div style={{ color: "#718096", fontSize: 11 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Demo data for when API is unavailable
const DEMO_BUSINESSES = [
  { name: "The Coffee House", category: "cafe", address: "123 Main St", rating: 4.5, reviewCount: 234 },
  { name: "Bella Italia", category: "restaurant", address: "45 Oak Ave", rating: 4.2, reviewCount: 189 },
  { name: "FitLife Gym", category: "gym", address: "78 Park Blvd", rating: 4.7, reviewCount: 412 },
  { name: "Urban Boutique", category: "retail", address: "22 Fashion St", rating: 3.9, reviewCount: 67 },
  { name: "City Health Clinic", category: "health", address: "90 Wellness Dr", rating: 4.8, reviewCount: 521 },
  { name: "Grand Hotel", category: "hotel", address: "1 Central Plaza", rating: 4.4, reviewCount: 1203 },
  { name: "Burger Shack", category: "restaurant", address: "55 Fast Lane", rating: 3.8, reviewCount: 88 },
  { name: "Brew & Bean", category: "cafe", address: "12 Hipster Row", rating: 4.6, reviewCount: 302 },
  { name: "Tech Accessories", category: "retail", address: "33 Digital Ave", rating: 4.0, reviewCount: 145 },
  { name: "Sunrise Yoga", category: "gym", address: "7 Zen Court", rating: 4.9, reviewCount: 267 },
];
