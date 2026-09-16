# NovaBank Banking System

NovaBank is a **full-stack banking simulation project** built for learning and portfolio practice.

## What is included?

### Frontend
- Responsive banking dashboard
- Login screen
- Balance and account overview
- Money transfer
- Deposit and withdrawal
- Transaction search/filter
- Debit card freeze/unfreeze
- Spending analytics
- Dark mode
- CSV statement export

### Backend
- Node.js + Express server
- SQLite database
- Session-based demo authentication
- REST API endpoints
- Server-side balance validation
- Transaction storage in database
- Transfer/deposit/withdrawal APIs
- Card status API

## Tech Stack
HTML, CSS, JavaScript, Node.js, Express, SQLite, express-session

## Demo Login
Email: `sahil@example.com`
Password: `123456`

## Run locally

1. Install Node.js.
2. Open this project folder in a terminal.
3. Run:

```bash
npm install
npm start
```

4. Open `http://localhost:3000`

The SQLite database is created automatically inside `data/`.

## API routes

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/account`
- `POST /api/account/deposit`
- `POST /api/account/withdraw`
- `POST /api/transfer`
- `GET /api/transactions/export`
- `POST /api/card/freeze`

## Project structure

```text
novabank-banking-system/
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── data/
│   └── novabank.db       # created automatically
├── server.js
├── package.json
├── .gitignore
└── README.md
```

## Important note

This is a **demo banking application**. It does not connect to a real bank, payment gateway, or real money. The credentials are intentionally demo credentials.
