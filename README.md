# GROW MORE SOLUTIONS — Final Website

Professional trading website for GROW MORE SOLUTIONS.

## Included
- GROW MORE INDICATOR product
- Final pricing: Monthly ₹3,999 | 6 Months ₹6,999 | Yearly ₹10,999 | Lifetime ₹24,999
- Customer registration/login
- My Products and order history
- TradingView username/access request
- Admin dashboard
- Cashfree checkout hooks and webhook verification
- Protected downloads for future EA/bot products
- Responsive design

## Local run
1. Install Node.js 18+
2. `npm install`
3. Copy `.env.example` to `.env`
4. `npm start`
5. Website: http://localhost:3000
6. Admin: http://localhost:3000/admin.html

Default admin password: `GROWMORE123` (change `ADMIN_PASSWORD` in production).

## Render
Build command: `npm install`
Start command: `npm start`
If no admin environment variable is configured, the site accepts the default `GROWMORE123` so the first login is simple. For production, set `ADMIN_PASSWORD` in Render Environment.

Cashfree keys must be added in Render Environment before real payments are enabled.
TradingView invite-only access is granted manually by the script author on TradingView after the customer submits the username/access request.
