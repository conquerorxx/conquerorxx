/**************************************************************
 * Engine Xie - Truly Unstoppable Node.js Server
 * 1) Keeps data in memory (optionally in a JSON file).
 * 2) Auto-updates the price randomly on a set interval.
 * 3) Provides /engine-xie GET + override endpoints.
 **************************************************************/
const express = require('express');
const fs = require('fs');

// We'll keep data in memory, but we can also persist to JSON file below.
let engineData = {
  symbol: "ENGINE-XIE",
  companyInfo: "Truly unstoppable. Runs 24/7 on Node.js.",
  currentPrice: 4.6.00,
  dayHigh: 4.9.00,
  dayLow: 4.3.00,
  volume: 0,
  fiftyTwoWkHigh: 6.10,
  fiftyTwoWkLow: 0.50,
  transactions: [],
  news: [],
  password: "IloveRong",
  lastResetDate: new Date().toISOString().slice(0,10)  // for daily reset
};

// If you want a local JSON file for persistence
const DATA_FILE = './engine_xie_data.json';

/**************************************************************
 * Load from file if exists
 **************************************************************/
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      let raw = fs.readFileSync(DATA_FILE, 'utf8');
      let parsed = JSON.parse(raw);
      engineData = parsed;
      console.log("[LoadData] Loaded from file:", DATA_FILE);
    } catch(err) {
      console.error("[LoadData] Error reading JSON file:", err);
    }
  }
}

/**************************************************************
 * Save to file
 **************************************************************/
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(engineData, null, 2));
    // console.log("[SaveData] Wrote to file:", DATA_FILE);
  } catch(err) {
    console.error("[SaveData] Error writing file:", err);
  }
}

/**************************************************************
 * Auto-update function (unstoppable).
 * random +/- up to 2% of currentPrice => unpredictable
 **************************************************************/
function autoUpdate() {
  let maxPerc = 0.02; // ±2%
  let changePerc = Math.random() * 2*maxPerc - maxPerc;
  let change = engineData.currentPrice * changePerc;
  engineData.currentPrice += change;

  // never drop below 1 or your 52wkLow
  if (engineData.currentPrice < engineData.fiftyTwoWkLow) {
    engineData.currentPrice = engineData.fiftyTwoWkLow;
  }

  // day high/low
  if (engineData.currentPrice>engineData.dayHigh) {
    engineData.dayHigh = engineData.currentPrice;
  }
  if (engineData.currentPrice<engineData.dayLow) {
    engineData.dayLow = engineData.currentPrice;
  }

  // volume
  engineData.volume += Math.floor(Math.random()*1000);

  // transaction log
  let timeStr = new Date().toLocaleTimeString();
  engineData.transactions.unshift(`Auto => ${engineData.currentPrice.toFixed(2)} at ${timeStr}`);
  if (engineData.transactions.length>20) {
    engineData.transactions.pop();
  }

  // daily reset if date changed
  let todayStr = new Date().toISOString().slice(0,10);
  if (todayStr !== engineData.lastResetDate) {
    engineData.dayHigh = engineData.currentPrice;
    engineData.dayLow = engineData.currentPrice;
    engineData.volume = 0;
    engineData.lastResetDate = todayStr;
  }

  saveData();
  console.log(`[AutoUpdate] Price now ${engineData.currentPrice.toFixed(2)}`);
}

// Load data from file at start
loadData();

// Start unstoppable interval every 60 seconds
setInterval(autoUpdate, 60*1000);

// Express server
const app = express();
app.use(express.json());

/**************************************************************
 * GET /engine-xie
 * Return entire data for squarespace or kiosk to read
 **************************************************************/
app.get('/engine-xie', (req, res) => {
  res.json(engineData);
});

/**************************************************************
 * POST /engine-xie/override
 * Admin override. body: { password, newPrice }
 **************************************************************/
app.post('/engine-xie/override', (req, res) => {
  let {password, newPrice} = req.body || {};
  if (password!==engineData.password) {
    return res.status(403).json({error:"Wrong password"});
  }
  let val = parseFloat(newPrice);
  if (isNaN(val)) {
    return res.status(400).json({error:"Invalid price"});
  }
  engineData.currentPrice = val;
  if (val>engineData.dayHigh) engineData.dayHigh=val;
  if (val<engineData.dayLow) engineData.dayLow=val;
  engineData.transactions.unshift(`Override => ${val.toFixed(2)} at ${new Date().toLocaleTimeString()}`);
  if(engineData.transactions.length>20) {
    engineData.transactions.pop();
  }
  saveData();
  res.json({success:true, newPrice:val});
});

/**************************************************************
 * POST /engine-xie/news
 * Add news. body: { password, title, content }
 **************************************************************/
app.post('/engine-xie/news', (req, res) => {
  let {password, title, content} = req.body;
  if (password!==engineData.password) {
    return res.status(403).json({error:"Wrong password"});
  }
  if(!title||!content) {
    return res.status(400).json({error:"title & content needed"});
  }
  engineData.news.unshift({
    title,
    content,
    date: new Date().toLocaleDateString()
  });
  if(engineData.news.length>20) {
    engineData.news.pop();
  }
  saveData();
  res.json({success:true});
});

/**************************************************************
 * Start server on port 3000 (or any)
 **************************************************************/
const PORT= process.env.PORT||3000;
app.listen(PORT, () => {
  console.log(`Engine Xie unstoppable server running on port ${PORT}...`);
});
