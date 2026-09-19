require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SITE_URL = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const ROOT = __dirname;
const PUBLIC = ROOT;
const PRIVATE = path.join(ROOT, "private_products");
const UPLOADS = path.join(ROOT, "uploads");
for (const d of [PRIVATE, UPLOADS]) fs.mkdirSync(d, {recursive:true});

const db = new Database(path.join(ROOT, "growmore.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Indicator',
  description TEXT DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  monthly REAL NOT NULL DEFAULT 0,
  six_months REAL NOT NULL DEFAULT 0,
  yearly REAL NOT NULL DEFAULT 0,
  lifetime REAL NOT NULL DEFAULT 0,
  image TEXT DEFAULT '',
  file_name TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  plan TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'CREATED',
  cf_payment_id TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT DEFAULT '',
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);
CREATE TABLE IF NOT EXISTS entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  plan TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, product_id, order_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(product_id) REFERENCES products(id),
  FOREIGN KEY(order_id) REFERENCES orders(id)
);
CREATE TABLE IF NOT EXISTS access_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  entitlement_id INTEGER NOT NULL,
  tradingview_username TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  admin_note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entitlement_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(product_id) REFERENCES products(id),
  FOREIGN KEY(entitlement_id) REFERENCES entitlements(id)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS webhook_events (
  event_key TEXT PRIMARY KEY,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// Backward-compatible database migration for older Render SQLite databases.
function productColumns() {
  return new Set(db.prepare("PRAGMA table_info(products)").all().map(c => c.name));
}
let pc = productColumns();
if (!pc.has("image")) db.exec("ALTER TABLE products ADD COLUMN image TEXT DEFAULT ''");
if (!pc.has("file_name")) db.exec("ALTER TABLE products ADD COLUMN file_name TEXT DEFAULT ''");
if (!pc.has("active")) db.exec("ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
pc = productColumns();
if (pc.has("image_url")) db.exec("UPDATE products SET image = COALESCE(NULLIF(image,''), image_url)");

const defaultSettings = {
  brand_name: "GROW MORE SOLUTIONS",
  browser_title: "GROW MORE SOLUTIONS",
  logo_url: "/logo.jpeg",
  hero_image_url: "/hero.jpeg",
  feature_title: "Why GROW MORE?",
  feature_intro: "Tools built around clean workflows, automation and access control.",
  feature1_title: "TradingView", feature1_text: "Indicators and signal tools for chart-based execution.",
  feature2_title: "MT4 / MT5", feature2_text: "Expert Advisors and automation-ready products.",
  feature3_title: "Protected Access", feature3_text: "Paid products appear in the customer account after verified payment.",
  feature4_title: "Support", feature4_text: "Connect through the contact and social links you control.",
  platform_title: "Platforms",
  platforms_list: "TradingView|MetaTrader 4|MetaTrader 5|AI Trading Tools|Forex|Crypto|Gold",
  about_customer_title: "Customer area",
  about_customer_text: "Register, purchase a product, see payment/order history, check expiry and securely access entitled files.",
  about_customer_button: "Open My Account",
  hero_kicker: "AI • TRADINGVIEW • MT4 • MT5",
  hero_title: "Trade Smarter. Build More.",
  hero_description: "Professional trading indicators, EAs and AI-powered tools for disciplined market execution.",
  hero_btn1_text: "Explore Products",
  hero_btn1_link: "#products",
  hero_btn2_text: "Login",
  hero_btn2_link: "/login.html",
  header_menu_home: "Home",
  header_menu_products: "Products",
  header_menu_pricing: "Pricing",
  header_menu_about: "About",
  header_menu_contact: "Contact",
  admin_link_text: "Admin",
  footer_text: "© GROW MORE SOLUTIONS. All rights reserved.",
  contact_heading: "Let's build your trading edge.",
  contact_text: "For product access, support and business enquiries, contact us directly.",
  whatsapp: "",
  email: "",
  telegram: "",
  instagram: "",
  youtube: "",
  show_features: "1",
  show_products: "1",
  show_pricing: "1",
  show_about: "1",
  show_platforms: "1",
  about_title: "Built for traders who value clarity.",
  about_text: "GROW MORE SOLUTIONS provides trading tools, indicators and EAs designed for practical chart workflows and automation."
};
const setStmt = db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)");
for (const [k,v] of Object.entries(defaultSettings)) setStmt.run(k,v);

const seedCount = db.prepare("SELECT COUNT(*) c FROM products").get().c;
if (!seedCount) {
  db.prepare(`INSERT INTO products(name,type,description,price,monthly,six_months,yearly,lifetime,active,image)
    VALUES(?,?,?,?,?,?,?,?,1,?)`).run(
      "GROW MORE INDICATOR", "TradingView Indicator",
      "Professional invite-only TradingView indicator from GROW MORE SOLUTIONS. Access is activated after verified payment and admin approval.",
      1999, 3999, 6999, 10999, 24999, "/grow-more-indicator.png"
  );
} else {
  const demo = db.prepare("SELECT id FROM products WHERE name='GROW MORE Smart Signals' LIMIT 1").get();
  if (demo) {
    db.prepare(`UPDATE products SET name=?,type=?,description=?,price=?,monthly=?,six_months=?,yearly=?,lifetime=?,active=1,image=? WHERE id=?`).run(
      "GROW MORE INDICATOR", "TradingView Indicator",
      "Professional invite-only TradingView indicator from GROW MORE SOLUTIONS. Access is activated after verified payment and admin approval.",
      1999, 3999, 6999, 10999, 24999, "/grow-more-indicator.png", demo.id
    );
  }
}

function settings() {
  const rows = db.prepare("SELECT key,value FROM settings").all();
  return Object.fromEntries(rows.map(r=>[r.key,r.value]));
}
function setSetting(key,value) {
  db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,String(value ?? ""));
}
function publicUser(id) {
  return db.prepare("SELECT id,name,email,phone,created_at FROM users WHERE id=?").get(id);
}
function hashToken(token) { return crypto.createHash("sha256").update(token).digest("hex"); }
function createSession(userId, role="user") {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = Date.now() + Number(process.env.SESSION_DAYS || 7)*86400000;
  db.prepare("INSERT INTO sessions(token_hash,user_id,role,expires_at) VALUES(?,?,?,?)")
    .run(hashToken(token), userId, role, expires);
  return token;
}
function session(req) {
  const token = req.headers.cookie?.match(/(?:^|; )gm_session=([^;]+)/)?.[1];
  if (!token) return null;
  const s = db.prepare("SELECT * FROM sessions WHERE token_hash=? AND expires_at>?").get(hashToken(token), Date.now());
  if (!s) return null;
  return { ...s, user: publicUser(s.user_id) };
}
function requireUser(req,res,next) {
  const s = session(req);
  if (!s || s.role !== "user") return res.status(401).json({error:"Login required"});
  req.auth=s; next();
}
function requireAdmin(req,res,next) {
  const s = session(req);
  if (!s || s.role !== "admin") return res.status(401).json({error:"Admin login required"});
  req.auth=s; next();
}
function durationFor(plan) {
  const now = new Date();
  if (plan === "Lifetime") return {start: now.toISOString(), end:null};
  const months = plan === "Monthly" ? 1 : plan === "6 Months" ? 6 : 12;
  const end = new Date(now);
  end.setMonth(end.getMonth()+months);
  return {start:now.toISOString(), end:end.toISOString()};
}
function priceFor(product, plan) {
  if (plan === "Monthly") return Number(product.monthly || product.price);
  if (plan === "6 Months") return Number(product.six_months || 0);
  if (plan === "Yearly") return Number(product.yearly || 0);
  if (plan === "Lifetime") return Number(product.lifetime || 0);
  return Number(product.price || 0);
}
function grantEntitlement(order) {
  const d = durationFor(order.plan);
  db.prepare(`INSERT OR IGNORE INTO entitlements(user_id,product_id,order_id,plan,starts_at,expires_at,active)
    VALUES(?,?,?,?,?,?,1)`).run(order.user_id,order.product_id,order.id,order.plan,d.start,d.end);
}
function markPaid(orderId, paymentId="") {
  const order = db.prepare("SELECT * FROM orders WHERE order_id=?").get(orderId);
  if (!order) return false;
  db.prepare("UPDATE orders SET status='PAID', cf_payment_id=?, paid_at=COALESCE(NULLIF(paid_at,''),CURRENT_TIMESTAMP) WHERE order_id=?")
    .run(paymentId || order.cf_payment_id || "", orderId);
  grantEntitlement(db.prepare("SELECT * FROM orders WHERE order_id=?").get(orderId));
  return true;
}

async function cashfree(pathname, options={}) {
  const env = (process.env.CASHFREE_ENV || "sandbox").toLowerCase();
  const host = env === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
  const r = await fetch(host + pathname, {
    ...options,
    headers: {
      "Content-Type":"application/json",
      "x-client-id":process.env.CASHFREE_CLIENT_ID || "",
      "x-client-secret":process.env.CASHFREE_CLIENT_SECRET || "",
      "x-api-version":process.env.CASHFREE_API_VERSION || "2025-01-01",
      ...(options.headers||{})
    }
  });
  const txt = await r.text();
  let data; try { data=JSON.parse(txt); } catch { data={raw:txt}; }
  if (!r.ok) {
    const e = new Error(data.message || data.error_description || `Cashfree HTTP ${r.status}`);
    e.status=r.status; e.data=data; throw e;
  }
  return data;
}
function verifyWebhook(req) {
  const sig=req.headers["x-webhook-signature"];
  const ts=req.headers["x-webhook-timestamp"];
  const secret=process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_CLIENT_SECRET;
  if (!sig || !ts || !secret || !req.rawBody) return false;
  const age=Math.abs(Date.now()-Number(ts));
  if (!Number.isFinite(age) || age > 5*60*1000) return false;
  const computed=crypto.createHmac("sha256",secret).update(String(ts)+req.rawBody).digest("base64");
  try { return crypto.timingSafeEqual(Buffer.from(computed),Buffer.from(sig)); } catch { return false; }
}

// Webhook needs raw body before JSON parsing.
app.post("/api/cashfree/webhook", express.raw({type:"application/json"}), (req,res)=>{
  req.rawBody=req.body?.toString("utf8") || "";
  if (!verifyWebhook(req)) return res.status(400).send("Invalid signature");
  let payload; try { payload=JSON.parse(req.rawBody); } catch { return res.status(400).send("Bad JSON"); }

  const eventKey = crypto.createHash("sha256").update(req.rawBody).digest("hex");
  try {
    db.prepare("INSERT INTO webhook_events(event_key) VALUES(?)").run(eventKey);
  } catch { return res.status(200).send("Duplicate"); }

  const data=payload.data || {};
  const orderId=data.order?.order_id || data.order_id || payload.order_id;
  const paymentId=data.payment?.cf_payment_id || data.cf_payment_id || "";
  const status=String(data.payment?.payment_status || data.payment_status || "").toUpperCase();
  if (orderId && status === "SUCCESS") markPaid(orderId,paymentId);
  if (orderId && ["FAILED","CANCELLED","USER_DROPPED"].includes(status))
    db.prepare("UPDATE orders SET status=? WHERE order_id=? AND status!='PAID'").run(status,orderId);
  res.status(200).send("OK");
});

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));

const imageStorage=multer.diskStorage({
  destination:(_req,_file,cb)=>cb(null,UPLOADS),
  filename:(_req,file,cb)=>cb(null,`${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path.extname(file.originalname).toLowerCase()}`)
});
const fileStorage=multer.diskStorage({
  destination:(_req,_file,cb)=>cb(null,PRIVATE),
  filename:(_req,file,cb)=>cb(null,`${Date.now()}-${crypto.randomBytes(8).toString("hex")}${path.extname(file.originalname).toLowerCase()}`)
});
const uploadImage=multer({storage:imageStorage,limits:{fileSize:5*1024*1024},fileFilter:(_r,f,cb)=>cb(null,/^image\/(jpeg|png|webp|gif)$/.test(f.mimetype))});
const uploadProduct=multer({storage:fileStorage,limits:{fileSize:(Number(process.env.MAX_UPLOAD_MB)||100)*1024*1024}});

app.use((req,res,next)=>{ if(req.path.startsWith("/api/")){res.setHeader("Cache-Control","no-store");} next(); });
app.get("/api/site", (_req,res)=>res.json({settings:settings()}));
app.get("/api/products", (_req,res)=>{
  res.json(db.prepare("SELECT id,name,type,description,price,monthly,six_months,yearly,lifetime,image,active FROM products WHERE active=1 ORDER BY id DESC").all());
});

app.post("/api/auth/register", (req,res)=>{
  const {name,email,phone,password}=req.body||{};
  if (!name || !email || !password || password.length<6) return res.status(400).json({error:"Name, email and password (6+ chars) are required"});
  try {
    const info=db.prepare("INSERT INTO users(name,email,phone,password_hash) VALUES(?,?,?,?)")
      .run(String(name).trim(),String(email).trim().toLowerCase(),String(phone||"").trim(),bcrypt.hashSync(password,12));
    const token=createSession(info.lastInsertRowid,"user");
    res.setHeader("Set-Cookie",`gm_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Number(process.env.SESSION_DAYS||7)*86400}`);
    res.json({user:publicUser(info.lastInsertRowid)});
  } catch { res.status(409).json({error:"Email already registered"}); }
});
app.post("/api/auth/login", (req,res)=>{
  const {email,password}=req.body||{};
  const user=db.prepare("SELECT * FROM users WHERE email=?").get(String(email||"").trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password||"",user.password_hash)) return res.status(401).json({error:"Invalid email or password"});
  const token=createSession(user.id,"user");
  res.setHeader("Set-Cookie",`gm_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Number(process.env.SESSION_DAYS||7)*86400}`);
  res.json({user:publicUser(user.id)});
});
app.post("/api/auth/logout",(req,res)=>{
  const token=req.headers.cookie?.match(/(?:^|; )gm_session=([^;]+)/)?.[1];
  if(token) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hashToken(token));
  res.setHeader("Set-Cookie","gm_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ok:true});
});
app.get("/api/auth/me",(req,res)=>{
  const s=session(req); res.json({user:s?.user||null,role:s?.role||null});
});

app.post("/api/cashfree/create-order", requireUser, async (req,res)=>{
  try {
    const product=db.prepare("SELECT * FROM products WHERE id=? AND active=1").get(Number(req.body.productId));
    const plan=String(req.body.plan||"Monthly");
    if(!product) return res.status(404).json({error:"Product not found"});
    const amount=priceFor(product,plan);
    if(!amount || amount<=0) return res.status(400).json({error:"This plan has no price. Set it in Admin."});
    const orderId=`GM_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const order=await cashfree("/pg/orders",{
      method:"POST",
      body:JSON.stringify({
        order_id:orderId,
        order_amount:amount,
        order_currency:"INR",
        customer_details:{
          customer_id:`GMU_${req.auth.user.id}`,
          customer_name:req.auth.user.name,
          customer_email:req.auth.user.email,
          customer_phone:req.auth.user.phone || "9999999999"
        },
        order_meta:{
          return_url:`${SITE_URL}/payment-result.html?order_id={order_id}`,
          notify_url:`${SITE_URL}/api/cashfree/webhook`
        },
        order_note:`${product.name} - ${plan}`
      })
    });
    db.prepare(`INSERT INTO orders(order_id,user_id,product_id,plan,amount,status)
      VALUES(?,?,?,?,?,'CREATED')`).run(orderId,req.auth.user.id,product.id,plan,amount);
    res.json({orderId,paymentSessionId:order.payment_session_id,environment:(process.env.CASHFREE_ENV||"sandbox")});
  } catch(e) {
    console.error(e);
    res.status(500).json({error:"Could not create Cashfree order. Payment gateway is not configured or available yet."});
  }
});

app.get("/api/cashfree/verify/:orderId", requireUser, async (req,res)=>{
  try {
    const order=db.prepare("SELECT * FROM orders WHERE order_id=? AND user_id=?").get(req.params.orderId,req.auth.user.id);
    if(!order) return res.status(404).json({error:"Order not found"});
    const payments=await cashfree(`/pg/orders/${encodeURIComponent(order.order_id)}/payments`,{method:"GET"});
    const success=(Array.isArray(payments)?payments:[]).find(p=>String(p.payment_status).toUpperCase()==="SUCCESS");
    if(success) markPaid(order.order_id,String(success.cf_payment_id||""));
    const fresh=db.prepare("SELECT * FROM orders WHERE order_id=?").get(order.order_id);
    res.json({order:fresh, payments});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get("/api/me/products", requireUser, (req,res)=>{
  const rows=db.prepare(`
    SELECT e.*, p.name,p.type,p.description,p.image,o.order_id,o.amount,o.status
    FROM entitlements e JOIN products p ON p.id=e.product_id JOIN orders o ON o.id=e.order_id
    WHERE e.user_id=? ORDER BY e.id DESC`).all(req.auth.user.id);
  const now=Date.now();
  res.json(rows.map(x=>({...x,active:!!x.active && (!x.expires_at || new Date(x.expires_at).getTime()>now)})));
});
app.get("/api/me/orders", requireUser, (req,res)=>{
  res.json(db.prepare(`SELECT o.*,p.name FROM orders o JOIN products p ON p.id=o.product_id WHERE o.user_id=? ORDER BY o.id DESC`).all(req.auth.user.id));
});
app.post("/api/access-requests", requireUser, (req,res)=>{
  const entitlementId=Number(req.body?.entitlementId);
  const username=String(req.body?.tradingviewUsername||"").trim();
  if(!entitlementId || username.length<2 || username.length>80) return res.status(400).json({error:"Enter your exact TradingView username."});
  const e=db.prepare(`SELECT e.*,p.name product_name FROM entitlements e JOIN products p ON p.id=e.product_id WHERE e.id=? AND e.user_id=? AND e.active=1`).get(entitlementId,req.auth.user.id);
  if(!e) return res.status(404).json({error:"Paid product access not found."});
  const existing=db.prepare("SELECT * FROM access_requests WHERE entitlement_id=?").get(entitlementId);
  if(existing){ db.prepare("UPDATE access_requests SET tradingview_username=?,status='PENDING',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(username,existing.id); return res.json({ok:true,id:existing.id,status:"PENDING"}); }
  const info=db.prepare(`INSERT INTO access_requests(user_id,product_id,entitlement_id,tradingview_username,status) VALUES(?,?,?,?, 'PENDING')`).run(req.auth.user.id,e.product_id,e.id,username);
  res.json({ok:true,id:info.lastInsertRowid,status:"PENDING"});
});
app.get("/api/me/access-requests", requireUser, (req,res)=>{
  const rows=db.prepare(`SELECT ar.*,p.name product_name,e.plan,e.expires_at FROM access_requests ar JOIN products p ON p.id=ar.product_id JOIN entitlements e ON e.id=ar.entitlement_id WHERE ar.user_id=? ORDER BY ar.id DESC`).all(req.auth.user.id);
  res.json(rows);
});

app.get("/api/download/:entitlementId", requireUser, (req,res)=>{
  const e=db.prepare(`SELECT e.*,p.file_name FROM entitlements e JOIN products p ON p.id=e.product_id WHERE e.id=? AND e.user_id=?`).get(Number(req.params.entitlementId),req.auth.user.id);
  if(!e || !e.active || (e.expires_at && new Date(e.expires_at).getTime()<=Date.now())) return res.status(403).send("Access expired or unavailable.");
  if(!e.file_name) return res.status(404).send("Product file has not been uploaded yet.");
  const file=path.join(PRIVATE,e.file_name);
  if(!fs.existsSync(file)) return res.status(404).send("Product file not found.");
  res.download(file,e.file_name);
});

// Admin
app.post("/api/admin/login",(req,res)=>{
  const {password}=req.body||{};
  const plain=process.env.ADMIN_PASSWORD || "GROWMORE123";
  const hash=String(process.env.ADMIN_PASSWORD_HASH || "").trim();
  const validBcrypt=/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
  const ok = validBcrypt ? bcrypt.compareSync(password||"",hash) : String(password||"")===String(plain);
  if(!ok) return res.status(401).json({error:"Invalid admin password"});
  const token=createSession(0,"admin");
  res.setHeader("Set-Cookie",`gm_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Number(process.env.SESSION_DAYS||7)*86400}`);
  res.json({ok:true});
});
app.get("/api/admin/me",requireAdmin,(_req,res)=>res.json({ok:true}));

app.get("/api/admin/data",requireAdmin,(_req,res)=>{
  const s=settings();
  const products=db.prepare("SELECT * FROM products ORDER BY id DESC").all();
  const users=db.prepare("SELECT id,name,email,phone,created_at FROM users ORDER BY id DESC").all();
  const orders=db.prepare(`SELECT o.*,u.name user_name,u.email,p.name product_name FROM orders o JOIN users u ON u.id=o.user_id JOIN products p ON p.id=o.product_id ORDER BY o.id DESC LIMIT 200`).all();
  const stats={
    users:db.prepare("SELECT COUNT(*) c FROM users").get().c,
    orders:db.prepare("SELECT COUNT(*) c FROM orders").get().c,
    paid:db.prepare("SELECT COUNT(*) c FROM orders WHERE status='PAID'").get().c,
    revenue:db.prepare("SELECT COALESCE(SUM(amount),0) n FROM orders WHERE status='PAID'").get().n
  };
  res.json({settings:s,products,users,orders,stats});
});
app.post("/api/admin/settings",requireAdmin,(req,res)=>{
  const allowed=new Set(Object.keys(defaultSettings));
  for(const [k,v] of Object.entries(req.body||{})) if(allowed.has(k)) setSetting(k,v);
  res.json({ok:true,settings:settings()});
});
app.post("/api/admin/logo",requireAdmin,uploadImage.single("logo"),(req,res)=>{
  if(!req.file) return res.status(400).json({error:"Image required"});
  setSetting("logo_url","/uploads/"+req.file.filename);
  res.json({ok:true,url:"/uploads/"+req.file.filename});
});
app.post("/api/admin/hero-image",requireAdmin,uploadImage.single("hero"),(req,res)=>{
  if(!req.file) return res.status(400).json({error:"Image required"});
  setSetting("hero_image_url","/uploads/"+req.file.filename);
  res.json({ok:true,url:"/uploads/"+req.file.filename});
});
app.post("/api/admin/product-image",requireAdmin,uploadImage.single("image"),(req,res)=>{
  if(!req.file) return res.status(400).json({error:"Image required"});
  res.json({ok:true,url:"/uploads/"+req.file.filename});
});
app.post("/api/admin/products",requireAdmin,uploadProduct.single("file"),(req,res)=>{
  const b=req.body||{};
  const image=b.image||"";
  const info=db.prepare(`INSERT INTO products(name,type,description,price,monthly,six_months,yearly,lifetime,image,file_name,active)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
    String(b.name||"New Product"),String(b.type||"Indicator"),String(b.description||""),
    Number(b.price||0),Number(b.monthly||0),Number(b.six_months||0),Number(b.yearly||0),Number(b.lifetime||0),
    image,req.file?.filename||"",Number(b.active??1)?1:0
  );
  res.json({ok:true,id:info.lastInsertRowid});
});
app.put("/api/admin/products/:id",requireAdmin,uploadProduct.single("file"),(req,res)=>{
  const b=req.body||{};
  const old=db.prepare("SELECT * FROM products WHERE id=?").get(Number(req.params.id));
  if(!old) return res.status(404).json({error:"Product not found"});
  db.prepare(`UPDATE products SET name=?,type=?,description=?,price=?,monthly=?,six_months=?,yearly=?,lifetime=?,image=?,file_name=?,active=? WHERE id=?`).run(
    b.name??old.name,b.type??old.type,b.description??old.description,
    Number(b.price??old.price),Number(b.monthly??old.monthly),Number(b.six_months??old.six_months),
    Number(b.yearly??old.yearly),Number(b.lifetime??old.lifetime),b.image??old.image,
    req.file?.filename||old.file_name,Number(b.active??old.active)?1:0,old.id
  );
  res.json({ok:true});
});
app.delete("/api/admin/products/:id",requireAdmin,(req,res)=>{
  const p=db.prepare("SELECT * FROM products WHERE id=?").get(Number(req.params.id));
  if(p?.file_name) { try{fs.unlinkSync(path.join(PRIVATE,p.file_name))}catch{} }
  db.prepare("DELETE FROM products WHERE id=?").run(Number(req.params.id));
  res.json({ok:true});
});
app.post("/api/admin/entitlements/:id/extend",requireAdmin,(req,res)=>{
  const e=db.prepare("SELECT * FROM entitlements WHERE id=?").get(Number(req.params.id));
  if(!e) return res.status(404).json({error:"Entitlement not found"});
  const extraMonths=Number(req.body.months||1);
  let end=e.expires_at?new Date(e.expires_at):new Date();
  end.setMonth(end.getMonth()+extraMonths);
  db.prepare("UPDATE entitlements SET expires_at=?,active=1 WHERE id=?").run(end.toISOString(),e.id);
  res.json({ok:true});
});
app.get("/api/admin/access-requests",requireAdmin,(_req,res)=>{
  res.json(db.prepare(`SELECT ar.*,u.name user_name,u.email,u.phone,p.name product_name,e.plan,e.expires_at FROM access_requests ar JOIN users u ON u.id=ar.user_id JOIN products p ON p.id=ar.product_id JOIN entitlements e ON e.id=ar.entitlement_id ORDER BY CASE ar.status WHEN 'PENDING' THEN 0 ELSE 1 END, ar.id DESC LIMIT 500`).all());
});
app.put("/api/admin/access-requests/:id",requireAdmin,(req,res)=>{
  const id=Number(req.params.id); const status=String(req.body?.status||"PENDING").toUpperCase(); const note=String(req.body?.adminNote||"").trim().slice(0,500);
  if(!["PENDING","GRANTED","REJECTED"].includes(status)) return res.status(400).json({error:"Invalid status"});
  const row=db.prepare("SELECT * FROM access_requests WHERE id=?").get(id); if(!row) return res.status(404).json({error:"Access request not found"});
  db.prepare("UPDATE access_requests SET status=?,admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(status,note,id); res.json({ok:true});
});

app.get("/api/admin/entitlements",requireAdmin,(_req,res)=>{
  res.json(db.prepare(`SELECT e.*,u.name user_name,u.email,p.name product_name,o.order_id
    FROM entitlements e JOIN users u ON u.id=e.user_id JOIN products p ON p.id=e.product_id JOIN orders o ON o.id=e.order_id
    ORDER BY e.id DESC LIMIT 500`).all());
});

app.use("/uploads",express.static(UPLOADS));
app.use(express.static(PUBLIC));
app.get("/{*splat}",(req,res)=>res.sendFile(path.join(PUBLIC,"index.html")));

app.listen(PORT,()=>console.log(`GROW MORE SOLUTIONS running at ${SITE_URL}`));
