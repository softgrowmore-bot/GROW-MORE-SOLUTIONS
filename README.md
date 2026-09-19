# GROW MORE SOLUTIONS — Full Website

Professional trading website for GROW MORE SOLUTIONS.

## Included
- GROW MORE INDICATOR — TradingView Invite-only product
- Final pricing: Monthly ₹3,999 | 6 Months ₹6,999 | Yearly ₹10,999 | Lifetime ₹24,999
- Customer registration and login
- My Account and order history
- TradingView username/access request workflow
- Admin dashboard with products, orders, users and access approval
- Cashfree checkout hooks and webhook verification
- Protected downloads for future EA/bot products
- Terms, Privacy and Refund pages
- Responsive dark FinTech design

## Production
Render build command: `npm install`
Render start command: `npm start`

Set these Render environment variables for production:
- `ADMIN_PASSWORD_HASH` — bcrypt hash of your admin password
- `CASHFREE_ENV` — `sandbox` or `production`
- `CASHFREE_CLIENT_ID`
- `CASHFREE_CLIENT_SECRET`
- `CASHFREE_WEBHOOK_SECRET` (recommended)
- `SITE_URL=https://grow-more-solutions.onrender.com`

The site supports the fallback admin password `GROWMORE123` only when no valid bcrypt hash is configured. Replace it with a proper Render secret before production payments.

TradingView invite-only access is manually granted by the script author after verified payment; the website collects the customer's exact TradingView username and tracks the request status.
