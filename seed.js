import "dotenv/config";
import argon2 from "argon2";
import { pool } from "./db.js";
const password = process.env.ADMIN_PASSWORD;
if (!password) throw new Error("Set ADMIN_PASSWORD in .env first");
await pool.query("CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())");
await pool.query("CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT DEFAULT '', price NUMERIC(12,2) NOT NULL, discount NUMERIC(12,2) DEFAULT 0, stock INTEGER NOT NULL DEFAULT 0, image_url TEXT DEFAULT '', active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())");
const hash = await argon2.hash(password, { type: argon2.argon2id });
await pool.query("INSERT INTO admins(username,password_hash) VALUES($1,$2) ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash",["admin",hash]);
await pool.query(`INSERT INTO products(name,slug,description,price,stock,image_url) VALUES
('Premium Leather Wallet','premium-leather-wallet','Premium genuine leather wallet from SAREXBD',750,20,''),
('Premium Leather Belt','premium-leather-belt','Premium genuine leather belt from SAREXBD',600,20,'')
ON CONFLICT(slug) DO NOTHING`);
console.log("SAREXBD database seeded.");
await pool.end();