# Mikro Business Dashboard

A real-time analytics dashboard for Mikro DB, built with React, Node.js, and PostgreSQL.

## Features
- **Executive Summary:** Daily pulse, trends, and branch performance.
- **Salesman Leaderboard:** Revenue and customer reach per salesperson.
- **Customer Insights:** Top 20 customers and AR Aging (overdue payments).
- **Inventory Tracking:** Best-selling products by volume and revenue.

## Setup & Running

### Prerequisites
- Node.js installed.
- `psql` client installed (for database connectivity).
- `.env` file with Supabase credentials in the root directory.

### 1. Start the Backend
```bash
cd dashboard-app
npm install
npm run dev
```
The server will run at `http://localhost:3001`.

### 2. Start the Frontend
```bash
cd dashboard-app/frontend
npm install
npm run dev
```
The interface will be available at `http://localhost:5173`.

## Architecture
- **Backend:** Express.js with `pg` for read-only SQL execution.
- **Frontend:** React + Vite + Recharts for data visualization.
- **Styling:** Custom CSS for a clean, professional "Enterprise" look.
