const express = require("express");
const cors = require("cors");
const app = express();
 
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
 
// Creates the storage table once on server startup if it doesn't exist yet
pool.query(`
  CREATE TABLE IF NOT EXISTS user_data (
    username TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => console.log("user_data table ready"))
  .catch(err => console.error("Failed to create user_data table:", err.message));
 
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options("*", cors());
app.use(express.json({ limit: "10mb" }));
 
const API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 3000;
 
app.post("/api/ai", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: "API key not configured on server" });
  }
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
 
// Load a user's saved app data
app.get("/api/data/:username", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT data FROM user_data WHERE username = $1",
      [req.params.username]
    );
    if (result.rows.length === 0) {
      return res.json({ data: null });
    }
    res.json({ data: result.rows[0].data });
  } catch (err) {
    console.error("GET /api/data error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
 
// Save (create or overwrite) a user's app data
app.post("/api/data/:username", async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO user_data (username, data, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (username) DO UPDATE SET data = $2, updated_at = NOW()`,
      [req.params.username, JSON.stringify(req.body)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("POST /api/data error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
 
app.get("/", (req, res) => res.send("R·Packer API is running ✓"));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
