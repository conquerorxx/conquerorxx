/**************************************************************
 * Engine Xie - Truly Unstoppable Node.js Server
 * - Hourly news generation
 * - 3-month news retention
 * - Daily price history (since Oct 1, 2024)
 * - Next day "dayOpen" = previous day's "close"
 **************************************************************/
const express = require('express');
const fs = require('fs');
const axios = require('axios'); // For fetching images/videos from an external API

// ------------------------------
// The in-memory state, persisted to JSON file
// ------------------------------
let engineData = {
  symbol: "ENGINE-XIE",
  companyInfo: "Truly unstoppable. Runs 24/7 on Node.js.",
  
  // Real-time daily stats
  currentPrice: 4.6,
  dayOpen: 4.6,
  dayHigh: 4.9,
  dayLow: 4.3,
  volume: 0,
  
  fiftyTwoWkHigh: 6.10,
  fiftyTwoWkLow: 0.50,

  // Logs
  transactions: [],
  news: [],

  // For password-protected endpoints
  password: "IloveRong",

  // For daily reset & news generation
  lastResetDate: new Date().toISOString().slice(0, 10),
  lastNewsHour: null,

  // Full daily price history
  // Each item: { date, open, close, high, low, volume }
  priceHistory: []
};

const DATA_FILE = './engine_xie_data.json';

/**************************************************************
 * Load data from file if it exists
 **************************************************************/
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      let raw = fs.readFileSync(DATA_FILE, 'utf8');
      let parsed = JSON.parse(raw);
      engineData = parsed;
      console.log("[LoadData] Loaded from file:", DATA_FILE);
    } catch (err) {
      console.error("[LoadData] Error reading JSON file:", err);
    }
  }
}

/**************************************************************
 * Save data to file
 **************************************************************/
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(engineData, null, 2));
    // console.log("[SaveData] Wrote to file:", DATA_FILE);
  } catch (err) {
    console.error("[SaveData] Error writing file:", err);
  }
}

/**************************************************************
 * removeOldNews()
 * Keep only the last 3 months of news
 **************************************************************/
function removeOldNews() {
  let threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3); // subtract 3 months
  engineData.news = engineData.news.filter(item => {
    let itemTime = new Date(item.timestamp || item.date); 
    return itemTime >= threeMonthsAgo;
  });
}

/**************************************************************
 * dailyResetIfNeeded()
 * - If the local Beijing date has changed, finalize the previous
 *   day's data and add it to priceHistory.
 * - Then reset for the new day, with dayOpen = previous close.
 **************************************************************/
function dailyResetIfNeeded() {
  let beijingNowStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
  let beijingNow = new Date(beijingNowStr);
  let dateOnly = beijingNow.toISOString().slice(0, 10);

  // If the date changed, finalize yesterday’s data and reset
  if (dateOnly !== engineData.lastResetDate) {
    // 1) Save *yesterday’s* daily candle to priceHistory
    //    (only if date >= "2024-10-01" or whatever logic you prefer)
    if (engineData.lastResetDate >= "2024-10-01") {
      engineData.priceHistory.push({
        date: engineData.lastResetDate,
        open: engineData.dayOpen,
        close: engineData.currentPrice,
        high: engineData.dayHigh,
        low: engineData.dayLow,
        volume: engineData.volume
      });
    }

    // 2) Reset for the new day
    //    The "dayOpen" = the *previous day's closing price*
    let prevClose = engineData.currentPrice;
    engineData.dayOpen = prevClose;
    engineData.dayHigh = prevClose;
    engineData.dayLow = prevClose;
    engineData.volume = 0;

    // 3) Update lastResetDate
    engineData.lastResetDate = dateOnly;

    console.log(`[DailyReset] Finalized data for ${engineData.priceHistory.slice(-1)[0]?.date}, now resetting.`);
  }
}

/**************************************************************
 * autoUpdate()
 * - Called every minute: random +/- up to 2% of currentPrice
 * - Then check if we need a daily reset
 **************************************************************/
function autoUpdate() {
  let maxPerc = 0.02; // ±2%
  let changePerc = Math.random() * (2 * maxPerc) - maxPerc;
  let change = engineData.currentPrice * changePerc;
  engineData.currentPrice += change;

  // never drop below 52wkLow
  if (engineData.currentPrice < engineData.fiftyTwoWkLow) {
    engineData.currentPrice = engineData.fiftyTwoWkLow;
  }

  // update day high/low
  if (engineData.currentPrice > engineData.dayHigh) {
    engineData.dayHigh = engineData.currentPrice;
  }
  if (engineData.currentPrice < engineData.dayLow) {
    engineData.dayLow = engineData.currentPrice;
  }

  // volume
  engineData.volume += Math.floor(Math.random() * 1000);

  // transaction log
  let timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Shanghai' });
  engineData.transactions.unshift(`Auto => ${engineData.currentPrice.toFixed(2)} at ${timeStr}`);
  if (engineData.transactions.length > 20) {
    engineData.transactions.pop();
  }

  // check daily reset
  dailyResetIfNeeded();

  saveData();
  console.log(`[AutoUpdate] Price now ${engineData.currentPrice.toFixed(2)}`);
}

/**************************************************************
 * News Generation Functions
 *  1) autoNewsCheck: checks every minute if the hour changed
 *  2) fetchRandomPicture: fetch from Pexels
 **************************************************************/
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || "YOUR_PEXELS_API_KEY_HERE";

async function fetchRandomPicture(query = "finance") {
  if (!PEXELS_API_KEY || PEXELS_API_KEY === "YOUR_PEXELS_API_KEY_HERE") {
    console.warn("[fetchRandomPicture] No real Pexels API Key. Returning null.");
    return null;
  }
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=80&page=1`;
    const resp = await axios.get(url, {
      headers: {
        Authorization: PEXELS_API_KEY
      }
    });
    if (resp.data && resp.data.photos && resp.data.photos.length > 0) {
      let photosArr = resp.data.photos;
      let randomIndex = Math.floor(Math.random() * photosArr.length);
      return photosArr[randomIndex];
    }
  } catch (err) {
    console.error("[fetchRandomPicture] Error:", err);
  }
  return null;
}

// Check each minute if the hour changed in Beijing => post news
async function autoNewsCheck() {
  let beijingNowStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
  let beijingNow = new Date(beijingNowStr);
  let currentHour = beijingNow.getHours();

  if (engineData.lastNewsHour === null) {
    // Force a first news item on startup
    engineData.lastNewsHour = currentHour - 1;
  }

  if (currentHour !== engineData.lastNewsHour) {
    console.log(`[autoNewsCheck] Hour changed from ${engineData.lastNewsHour} to ${currentHour}. Creating news...`);

    const randomPhoto = await fetchRandomPicture("finance");
    let imageUrl = randomPhoto ? randomPhoto.src.medium : null;
    let photographer = randomPhoto ? randomPhoto.photographer : "Anonymous";

    let newNewsItem = {
      title: "Hourly Update: " + beijingNow.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }),
      content: "Automated news from Engine Xie. Photographer: " + photographer,
      date: beijingNow.toLocaleDateString('en-US', { timeZone: 'Asia/Shanghai' }),
      timestamp: beijingNow.toISOString(),
      imageUrl: imageUrl
    };

    engineData.news.unshift(newNewsItem);

    // remove news older than 3 months
    removeOldNews();

    engineData.lastNewsHour = currentHour;
    saveData();
    console.log(`[autoNewsCheck] Posted news with image: ${imageUrl}`);
  }
}

/**************************************************************
 * Initialization
 **************************************************************/
loadData();

// If dayOpen is missing, set it to currentPrice
if (typeof engineData.dayOpen === "undefined") {
  engineData.dayOpen = engineData.currentPrice;
}

// Start unstoppable intervals
// 1) Price auto-update every 60 seconds
setInterval(autoUpdate, 60 * 1000);
// 2) News check every 60 seconds
setInterval(autoNewsCheck, 60 * 1000);

/**************************************************************
 * Express Server
 **************************************************************/
const app = express();
app.use(express.json());

/**************************************************************
 * GET /engine-xie
 * Return entire data
 **************************************************************/
app.get('/engine-xie', (req, res) => {
  res.json(engineData);
});

/**************************************************************
 * POST /engine-xie/override
 * Admin override. body: { password, newPrice }
 **************************************************************/
app.post('/engine-xie/override', (req, res) => {
  let { password, newPrice } = req.body || {};
  if (password !== engineData.password) {
    return res.status(403).json({ error: "Wrong password" });
  }
  let val = parseFloat(newPrice);
  if (isNaN(val)) {
    return res.status(400).json({ error: "Invalid price" });
  }
  engineData.currentPrice = val;

  // update day high/low
  if (val > engineData.dayHigh) engineData.dayHigh = val;
  if (val < engineData.dayLow) engineData.dayLow = val;

  engineData.transactions.unshift(
    `Override => ${val.toFixed(2)} at ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Shanghai' })}`
  );
  if (engineData.transactions.length > 20) {
    engineData.transactions.pop();
  }

  saveData();
  res.json({ success: true, newPrice: val });
});

/**************************************************************
 * POST /engine-xie/news
 * Add a custom news item. body: { password, title, content }
 **************************************************************/
app.post('/engine-xie/news', (req, res) => {
  let { password, title, content } = req.body;
  if (password !== engineData.password) {
    return res.status(403).json({ error: "Wrong password" });
  }
  if (!title || !content) {
    return res.status(400).json({ error: "title & content needed" });
  }

  let beijingNowStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
  let beijingNow = new Date(beijingNowStr);

  let newNewsItem = {
    title,
    content,
    date: beijingNow.toLocaleDateString('en-US', { timeZone: 'Asia/Shanghai' }),
    timestamp: beijingNow.toISOString()
  };

  engineData.news.unshift(newNewsItem);
  removeOldNews();
  saveData();
  res.json({ success: true });
});

/**************************************************************
 * Start server on port 3000 (or any)
 **************************************************************/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Engine Xie unstoppable server running on port ${PORT}...`);
});
