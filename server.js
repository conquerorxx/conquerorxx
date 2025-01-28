/**************************************************************
 * Node.js "Unified Price" Server
 *  - Maintains a single "actualPrice" as the center
 *  - Does random fluctuation around it
 *  - Provides /price GET and /engine POST for updates
 **************************************************************/
const express = require('express');
const fs = require('fs');

const app = express();
app.use(express.json());

/** In-memory data **/
let data = {
  symbol: "MUA",
  actualPrice: 4.60,    // The center price set by "Engine"
  currentPrice: 4.60,   // The actual live price around actualPrice
  password: "IloveRong",// "Engine" password
  transactions: [],
  news: [],
  // 你也可以加更多字段，比如 targetDate, forecastedPrice ...
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
  // 随机 ± 0.05
  let fluct = (Math.random()*0.1 - 0.05);
  data.currentPrice += fluct;
  // 让currentPrice向actualPrice缓慢靠拢 (可以做更多自定义)
  let pullBack = (data.actualPrice - data.currentPrice)*0.01; 
  data.currentPrice += pullBack;
  // 可根据需求限制上下限
  // 记录一笔交易
  data.transactions.unshift(`Auto => ${data.currentPrice.toFixed(2)}`);
  if (data.transactions.length>50) data.transactions.pop();

  saveData();
  console.log("Fluctuate =>", data.currentPrice.toFixed(2));
}

/**************************************************************
 * API路由
 **************************************************************/
// 1) GET /price => 返回所有价格、交易、新闻
app.get('/price', (req, res)=>{
  res.json({
    symbol: data.symbol,
    actualPrice: data.actualPrice,
    currentPrice: data.currentPrice,
    transactions: data.transactions,
    news: data.news
  });
});

// 2) POST /engine => 设置新的 actualPrice (Engine按钮)
app.post('/engine', (req,res)=>{
  let { password, newPrice } = req.body;
  if (password!==data.password) {
    return res.status(403).json({ error:"Wrong password" });
  }
  let p = parseFloat(newPrice);
  if (isNaN(p)) {
    return res.status(400).json({ error:"Invalid price" });
  }
  data.actualPrice = p;
  // 强制 currentPrice 立即贴近 actualPrice
  data.currentPrice = p;
  data.transactions.unshift(`Engine => new actualPrice ${p.toFixed(2)}`);
  if (data.transactions.length>50) data.transactions.pop();

  saveData();
  res.json({ success:true, newActualPrice: p });
});

// 3) 你也可以加 Buy/Sell/News的API

/**************************************************************
 * 启动服务器
 **************************************************************/
loadData();
setInterval(autoFluctuate, 5000); // 每5秒随机波动一次

const PORT = process.env.PORT||3000;
app.listen(PORT, ()=>{
  console.log("Unified Price Server on port", PORT);
});
