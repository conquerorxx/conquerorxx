/**************************************************************
 * Node.js "Unified Price" Server
 *  - Maintains a single "actualPrice" as the center
 *  - Does random fluctuation around it
 *  - Provides /price GET and /engine POST for updates
 **************************************************************/
const express = require('express');
const fs = require('fs');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

// 配置 CORS，允许来自 Squarespace 的请求
const corsOptions = {
  origin: 'https://your-squarespace-site.com', // 替换为您的 Squarespace 域名
  methods: ['GET', 'POST']
};
app.use(cors(corsOptions));

/** In-memory data **/
let data = {
  symbol: "MUA",
  actualPrice: 4.60,    // The center price set by "Engine"
  currentPrice: 4.60,   // The actual live price around actualPrice
  password: "IloveRong",// "Engine" password
  transactions: [],
  news: [],
  // 可以添加更多字段，比如 targetDate, forecastedPrice ...
};

const DATA_FILE = './server_data.json';

/** Load from file if exists **/
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      let raw = fs.readFileSync(DATA_FILE, 'utf8');
      data = JSON.parse(raw);
      console.log("Loaded data from file");
    } catch (err) {
      console.error("loadData error:", err);
    }
  }
}

/** Save to file **/
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("saveData error:", err);
  }
}

/** 每隔N秒随机波动一下 currentPrice，围绕 actualPrice **/
function autoFluctuate() {
  // 随机 ±0.05
  let fluct = (Math.random() * 0.1 - 0.05);
  data.currentPrice += fluct;
  // 让 currentPrice 向 actualPrice 缓慢靠拢
  let pullBack = (data.actualPrice - data.currentPrice) * 0.01; 
  data.currentPrice += pullBack;
  // 保证价格不低于0
  if (data.currentPrice < 0) data.currentPrice = 0;
  // 记录一笔交易
  const timestamp = new Date().toLocaleString();
  data.transactions.unshift(`Auto => ${data.currentPrice.toFixed(2)} RMB at ${timestamp}`);
  if (data.transactions.length > 50) data.transactions.pop();

  saveData();
  console.log("Fluctuate =>", data.currentPrice.toFixed(2), "RMB");
}

/**************************************************************
 * API路由
 **************************************************************/
// 1) GET /price => 返回所有价格、交易、新闻
app.get('/price', (req, res) => {
  res.json({
    symbol: data.symbol,
    actualPrice: data.actualPrice,
    currentPrice: data.currentPrice,
    transactions: data.transactions,
    news: data.news
  });
});

// 2) POST /engine => 设置新的 actualPrice (Engine按钮)
app.post('/engine', (req, res) => {
  let { password, newPrice } = req.body;
  if (password !== data.password) {
    return res.status(403).json({ error: "Wrong password" });
  }
  let p = parseFloat(newPrice);
  if (isNaN(p)) {
    return res.status(400).json({ error: "Invalid price" });
  }
  data.actualPrice = p;
  // 强制 currentPrice 立即贴近 actualPrice
  data.currentPrice = p;
  const timestamp = new Date().toLocaleString();
  data.transactions.unshift(`Engine => new actualPrice ${p.toFixed(2)} RMB at ${timestamp}`);
  if (data.transactions.length > 50) data.transactions.pop();

  saveData();
  res.json({ success: true, newActualPrice: p });
});

// 3) 可选：添加 Buy/Sell/News 的 API
// 例如：添加新闻
app.post('/news', (req, res) => {
  const { title, content, media } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required" });
  }
  const timestamp = new Date().toLocaleString();
  data.news.unshift({ title, content, media: media || "No Media", timestamp });
  if (data.news.length > 50) data.news.pop();

  saveData();
  res.json({ success: true, news: data.news[0] });
});

// 4) 可选：添加 Buy/Sell 操作的 API
app.post('/transaction', (req, res) => {
  const { type, quantity, price } = req.body;
  if (!type || !['Buy', 'Sell'].includes(type)) {
    return res.status(400).json({ error: "Type must be 'Buy' or 'Sell'" });
  }
  if (isNaN(quantity) || isNaN(price)) {
    return res.status(400).json({ error: "Valid quantity and price are required" });
  }
  const timestamp = new Date().toLocaleString();
  data.transactions.unshift(`${type} ${quantity} shares at ${price.toFixed(2)} RMB at ${timestamp}`);
  if (data.transactions.length > 50) data.transactions.pop();

  saveData();
  res.json({ success: true, transaction: data.transactions[0] });
});

/**************************************************************
 * 启动服务器
 **************************************************************/
loadData();
setInterval(autoFluctuate, 5000); // 每5秒随机波动一次

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Unified Price Server running on port", PORT);
});
