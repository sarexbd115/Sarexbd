# SAREXBD v6

## Local setup
1. Install Node.js 20+ and PostgreSQL 15+.
2. Create a PostgreSQL database.
3. Copy `.env.example` to `.env`.
4. Set `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, and `CORS_ORIGIN`.
5. Run the SQL schema:
   `psql "$DATABASE_URL" -f schema.sql`
6. Run:
   `npm install`
   `npm run db:seed`
   `npm start`
7. Open `/` for the shop and `/admin.html` for admin.

## Production checklist
- Use HTTPS.
- Use a strong unique admin password.
- Use a managed PostgreSQL database with backups.
- Set NODE_ENV=production.
- Restrict CORS to the real domain.
- Rotate SESSION_SECRET before launch.
- Add image storage/CDN before uploading many product photos.
- Connect a real payment gateway only after business/payment verification.
- Never commit `.env` to Git.
