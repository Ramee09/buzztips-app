const express = require("express");
const cors = require("cors");
const axios = require("axios");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET /api/businesses - fetch nearby businesses using Google Places API
app.get("/api/businesses", async (req, res) => {
  const { lat, lng, query, radius = 1000 } = req.query;
  const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

  if (!GOOGLE_API_KEY) {
    return res.status(500).json({ error: "Google Places API key not configured" });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
    const params = {
      location: `${lat},${lng}`,
      radius,
      key: GOOGLE_API_KEY,
      ...(query ? { keyword: query } : { type: "establishment" }),
    };

    const { data } = await axios.get(url, { params });

    const businesses = data.results.map((place) => ({
      name: place.name,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      address: place.vicinity,
      category: mapGoogleTypeToCategory(place.types),
      rating: place.rating,
      reviewCount: place.user_ratings_total,
      placeId: place.place_id,
      openNow: place.opening_hours?.open_now,
    }));

    res.json({ businesses, total: businesses.length });
  } catch (err) {
    console.error("Places API error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/suggest - AI-powered business suggestion
app.post("/api/suggest", async (req, res) => {
  const { businesses, location } = req.body;

  const categoryCounts = businesses.reduce((acc, b) => {
    acc[b.category] = (acc[b.category] || 0) + 1;
    return acc;
  }, {});

  const prompt = `You are a business intelligence advisor analyzing a geographic area.

Current business landscape:
${JSON.stringify(categoryCounts, null, 2)}

Total businesses found: ${businesses.length}
Location coordinates: ${location[0].toFixed(4)}, ${location[1].toFixed(4)}

Based on what exists and what's missing, suggest exactly 4 business types that would THRIVE here.
Consider: market gaps, complementary services, foot traffic synergies, and underserved needs.

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  {
    "type": "Business Type Name",
    "reason": "Detailed 2-sentence explanation of why this would succeed here",
    "score": 92,
    "icon": "🏪",
    "investment": "$30k-$80k",
    "competition": "Low"
  }
]`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content.map((c) => c.text).join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const suggestions = JSON.parse(clean);
    res.json({ suggestions });
  } catch (err) {
    console.error("Claude API error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/health", (req, res) => res.json({ status: "ok", service: "BuzzTips API" }));

function mapGoogleTypeToCategory(types) {
  if (!types) return "default";
  if (types.includes("restaurant") || types.includes("food")) return "restaurant";
  if (types.includes("cafe") || types.includes("bakery")) return "cafe";
  if (types.includes("gym") || types.includes("fitness")) return "gym";
  if (types.includes("store") || types.includes("shopping_mall")) return "retail";
  if (types.includes("hospital") || types.includes("pharmacy") || types.includes("doctor")) return "health";
  if (types.includes("lodging")) return "hotel";
  return "default";
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`BuzzTips API running on port ${PORT}`));
