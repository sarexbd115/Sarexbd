import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import argon2 from "argon2";
import { pool } from "./db.js";

const app = express();
app.use(helmet({ contentSecurityPolicy:false }));
app.use(express.json({limit:"100kb"}));
app.use(cookieParser());
app.use(express.static("."));

const loginLimit = rateLimit({windowMs:15*60*1000, max:10, standardHeaders:true, legacyHeaders:false});
const sessions = new Map();
const auth = (req,res,next)=>{
  const token=req.cookies.sarex_session;
  const s=sessions.get(token);
  if(!s || s.expires<Date.now()) return res.status(401).json({error:"Unauthorized"});
  req.admin=s; next();
};

app.get("/api/health",(req,res)=>res.json({ok:true,service:"SAREXBD"}));
app.get("/api/products",async(req,res)=>{
  const r=await pool.query("SELECT id,name,slug,description,price,discount,stock,image_url FROM products WHERE active=true ORDER BY id");
  res.json(r.rows);
});

app.post("/api/admin/login",loginLimit,async(req,res)=>{
  const {username,password}=req.body||{};
  const r=await pool.query("SELECT * FROM admins WHERE username=$1",[username||""]);
  if(!r.rowCount || !(await argon2.verify(r.rows[0].password_hash,password||""))) return res.status(401).json({error:"Invalid login"});
  const token=crypto.randomBytes(32).toString("hex");
  sessions.set(token,{username:r.rows[0].username,expires:Date.now()+8*60*60*1000});
  res.cookie("sarex_session",token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:8*60*60*1000});
  res.json({ok:true});
});
app.post("/api/admin/logout",auth,(req,res)=>{sessions.delete(req.cookies.sarex_session);res.clearCookie("sarex_session");res.json({ok:true})});
app.get("/api/admin/me",auth,(req,res)=>res.json({username:req.admin.username}));

app.post("/api/orders",async(req,res)=>{
  const {customer_name,phone,address,delivery_area,items}=req.body||{};
  if(!customer_name||!phone||!address||!["dhaka","outside"].includes(delivery_area)||!Array.isArray(items)||!items.length) return res.status(400).json({error:"Missing order information"});
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    let subtotal=0, lines=[];
    for(const item of items){
      const q=Math.max(1,Math.min(99,Number(item.quantity)||1));
      const p=await client.query("SELECT id,name,price,discount,stock FROM products WHERE id=$1 AND active=true FOR UPDATE",[item.product_id]);
      if(!p.rowCount) throw new Error("Product unavailable");
      const x=p.rows[0];
      if(x.stock<q) throw new Error(`Insufficient stock for ${x.name}`);
      const unit=Math.max(0,Number(x.price)-Number(x.discount||0));
      subtotal += unit*q;
      lines.push({p:x,q,unit});
      await client.query("UPDATE products SET stock=stock-$1,updated_at=NOW() WHERE id=$2",[q,x.id]);
    }
    const delivery=delivery_area==="dhaka"?80:130;
    const total=subtotal+delivery;
    const o=await client.query(`INSERT INTO orders(customer_name,phone,address,delivery_area,delivery_charge,subtotal,total) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,total`,[customer_name,phone,address,delivery_area,delivery,subtotal,total]);
    for(const l of lines) await client.query("INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity) VALUES($1,$2,$3,$4,$5)",[o.rows[0].id,l.p.id,l.p.name,l.unit,l.q]);
    await client.query("COMMIT");
    res.status(201).json({ok:true,order_id:o.rows[0].id,total:o.rows[0].total,whatsapp:process.env.WHATSAPP_NUMBER||"8801610244533"});
  }catch(e){await client.query("ROLLBACK");res.status(400).json({error:e.message})}finally{client.release()}
});

app.get("/api/admin/orders",auth,async(req,res)=>{
  const r=await pool.query(`SELECT o.*, COALESCE(json_agg(json_build_object('product_name',i.product_name,'quantity',i.quantity,'unit_price',i.unit_price)) FILTER(WHERE i.id IS NOT NULL),'[]') items
  FROM orders o LEFT JOIN order_items i ON i.order_id=o.id GROUP BY o.id ORDER BY o.created_at DESC`);
  res.json(r.rows);
});
app.patch("/api/admin/orders/:id/status",auth,async(req,res)=>{
  const {status}=req.body||{};
  if(!["Pending","Confirmed","Processing","Delivered","Cancelled"].includes(status)) return res.status(400).json({error:"Invalid status"});
  await pool.query("UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2",[status,req.params.id]);
  res.json({ok:true});
});
app.post("/api/admin/products",auth,async(req,res)=>{
  const {name,slug,description="",price,discount=0,stock=0,image_url=""}=req.body||{};
  const r=await pool.query("INSERT INTO products(name,slug,description,price,discount,stock,image_url) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[name,slug,description,price,discount,stock,image_url]);
  res.status(201).json(r.rows[0]);
});
app.patch("/api/admin/products/:id",auth,async(req,res)=>{
  const {name,description,price,discount,stock,image_url,active}=req.body||{};
  const r=await pool.query(`UPDATE products SET name=COALESCE($1,name),description=COALESCE($2,description),price=COALESCE($3,price),discount=COALESCE($4,discount),stock=COALESCE($5,stock),image_url=COALESCE($6,image_url),active=COALESCE($7,active),updated_at=NOW() WHERE id=$8 RETURNING *`,[name,description,price,discount,stock,image_url,active,req.params.id]);
  res.json(r.rows[0]);
});

const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`SAREXBD running on port ${port}`));
