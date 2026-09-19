# GROW MORE SOLUTIONS — FINAL WEBSITE

This build combines:
- Professional responsive storefront using the supplied GROW MORE logo
- Admin editor for Header/Site, Home/Hero, Products, Pricing, Contact/Social and section ON/OFF
- Admin login
- Customer registration/login/logout
- Customer dashboard / My Products / Order History
- Product plan durations: Monthly, 6 Months, Yearly, Lifetime
- Cashfree hosted checkout
- Server-side Cashfree order creation and payment verification
- Cashfree webhook signature verification
- Entitlements created only after a verified PAID status
- Protected EA/Indicator file downloads
- Admin dashboard for users, orders and access management
- SQLite database; no external database service required

## 1) Install
Install Node.js 18+.

In this folder:
npm install

## 2) Configure .env
Copy `.env.example` to `.env`.

Generate an admin password hash:
node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 12))"

Paste that hash into ADMIN_PASSWORD_HASH.

For Cashfree, put your own App ID and Secret Key in `.env`.
Do NOT send the secret key in chat or put it in frontend files.

## 3) Run
npm start

Open:
http://localhost:3000

Admin:
http://localhost:3000/admin.html

## 4) Cashfree
The website creates the order on the server, opens Cashfree Hosted Checkout using the payment session ID, then verifies payment server-side. Cashfree's current web integration documents this Create Order -> payment session -> checkout -> server-side status flow.

Configure the webhook URL in your Cashfree dashboard:
https://YOUR-DOMAIN.com/api/cashfree/webhook

The webhook handler verifies `x-webhook-signature` against the raw request body before changing payment/access state.

## 5) Production
Use HTTPS and a persistent server/volume because SQLite and private product files are stored on disk.
Set:
SITE_URL=https://yourdomain.com
CASHFREE_ENV=production

Keep secret keys only in environment variables.

## 6) Recurring AutoPay
This version gives customers fixed-duration access after a successful one-time payment.
If you want true automatic monthly UPI/Card/eNACH renewal, that requires Cashfree Subscriptions/mandate APIs and merchant-side enablement. The product catalog is already structured with Monthly/6M/Yearly/Lifetime plan durations so that recurring billing can be added without redesigning the site.

## Important
Before going live, test sandbox payments, webhooks, downloads, refunds/failed payments, duplicate webhooks, and access expiry. Review Cashfree's current merchant terms and pricing/eligibility for your account.
