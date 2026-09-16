const express = require("express");
const session = require("express-session");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "data", "novabank.db"));

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "novabank-demo-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 4 }
}));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  card_frozen INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  account_number TEXT,
  ifsc TEXT,
  note TEXT,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('credit','debit')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

const user = db.prepare("SELECT id FROM users WHERE email=?").get("sahil@example.com");
if (!user) {
  const info = db.prepare("INSERT INTO users (name,email,password,balance) VALUES (?,?,?,?)")
    .run("Sahil Khan","sahil@example.com","123456",84520.40);
  const insert = db.prepare("INSERT INTO transactions (user_id,name,amount,type,created_at) VALUES (?,?,?,?,?)");
  const seed = db.transaction(() => {
    insert.run(info.lastInsertRowid,"Salary Credit",85000,"credit","2026-09-16 09:30:00");
    insert.run(info.lastInsertRowid,"Swiggy",620,"debit","2026-09-15 20:14:00");
    insert.run(info.lastInsertRowid,"Electricity Bill",2380,"debit","2026-09-12 18:20:00");
    insert.run(info.lastInsertRowid,"Rahul Sharma",4500,"debit","2026-09-10 13:42:00");
    insert.run(info.lastInsertRowid,"Cashback",310,"credit","2026-09-08 11:10:00");
  });
  seed();
}

function auth(req,res,next){
  if(!req.session.userId) return res.status(401).json({message:"Please sign in first."});
  next();
}
function accountData(userId){
  const u=db.prepare("SELECT balance, card_frozen FROM users WHERE id=?").get(userId);
  const transactions=db.prepare(`
    SELECT name, amount, type,
      strftime('%Y-%m-%d %H:%M:%S', created_at) as date
    FROM transactions WHERE user_id=? ORDER BY id DESC
  `).all(userId).map(t=>({...t, date:formatDate(t.date)}));
  return {balance:u.balance, transactions, frozen:!!u.card_frozen};
}
function formatDate(value){
  const d=new Date(value.replace(" ","T")+"Z");
  if(Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
}

app.post("/api/auth/login",(req,res)=>{
  const {email,password}=req.body||{};
  const u=db.prepare("SELECT id,name,email FROM users WHERE email=? AND password=?").get(email,password);
  if(!u) return res.status(401).json({message:"Invalid email or password."});
  req.session.userId=u.id;
  res.json({message:"Logged in",user:u});
});
app.post("/api/auth/logout",(req,res)=>req.session.destroy(()=>res.json({message:"Logged out"})));
app.get("/api/auth/session",(req,res)=>res.json({loggedIn:!!req.session.userId}));

app.get("/api/account",auth,(req,res)=>res.json(accountData(req.session.userId)));

app.post("/api/account/deposit",auth,(req,res)=>{
  const amount=Number(req.body.amount);
  if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({message:"Enter a valid amount."});
  const tx=db.transaction(()=>{
    db.prepare("UPDATE users SET balance=balance+? WHERE id=?").run(amount,req.session.userId);
    db.prepare("INSERT INTO transactions (user_id,name,amount,type) VALUES (?,?,?,'credit')").run(req.session.userId,"Cash deposit",amount);
  });
  tx();res.json(accountData(req.session.userId));
});

app.post("/api/account/withdraw",auth,(req,res)=>{
  const amount=Number(req.body.amount);
  const u=db.prepare("SELECT balance FROM users WHERE id=?").get(req.session.userId);
  if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({message:"Enter a valid amount."});
  if(amount>u.balance) return res.status(400).json({message:"Insufficient balance."});
  const tx=db.transaction(()=>{
    db.prepare("UPDATE users SET balance=balance-? WHERE id=?").run(amount,req.session.userId);
    db.prepare("INSERT INTO transactions (user_id,name,amount,type) VALUES (?,?,?,'debit')").run(req.session.userId,"Cash withdrawal",amount);
  });
  tx();res.json(accountData(req.session.userId));
});

app.post("/api/transfer",auth,(req,res)=>{
  const {recipient,accountNumber,ifsc,note}=req.body||{};
  const amount=Number(req.body.amount);
  const u=db.prepare("SELECT balance FROM users WHERE id=?").get(req.session.userId);
  if(!recipient||!accountNumber||!ifsc||!Number.isFinite(amount)||amount<=0) return res.status(400).json({message:"Please complete all transfer details."});
  if(!/^\d{6,20}$/.test(String(accountNumber))) return res.status(400).json({message:"Account number should contain 6-20 digits."});
  if(amount>u.balance) return res.status(400).json({message:"Insufficient balance."});
  const tx=db.transaction(()=>{
    db.prepare("UPDATE users SET balance=balance-? WHERE id=?").run(amount,req.session.userId);
    db.prepare("INSERT INTO transactions (user_id,name,account_number,ifsc,note,amount,type) VALUES (?,?,?,?,?,?,'debit')")
      .run(req.session.userId,recipient,accountNumber,ifsc,note||"",amount);
  });
  tx();res.json(accountData(req.session.userId));
});

app.get("/api/transactions/export",auth,(req,res)=>{
  const rows=db.prepare("SELECT created_at,name,type,amount FROM transactions WHERE user_id=? ORDER BY id DESC").all(req.session.userId);
  const csv=[["Date","Description","Type","Amount"],...rows.map(r=>[r.created_at,r.name,r.type,r.amount])]
    .map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  res.json({csv});
});

app.post("/api/card/freeze",auth,(req,res)=>{
  const current=db.prepare("SELECT card_frozen FROM users WHERE id=?").get(req.session.userId).card_frozen;
  const frozen=current?0:1;
  db.prepare("UPDATE users SET card_frozen=? WHERE id=?").run(frozen,req.session.userId);
  res.json({frozen:!!frozen});
});

app.use(express.static(path.join(__dirname,"public")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT,()=>console.log(`NovaBank running at http://localhost:${PORT}`));
