# Collection Control System

A specialized Relationship Officer (RO) terminal for managing field collections, member repayments, and cash tallying.

## 🚀 Overview

The **Collection Control System** is a robust web application designed for financial field operations. It allows Relationship Officers to:
- View assigned Center meeting schedules.
- Record member-wise repayments.
- Perform automated cash tallying with denominations.
- Track real-time collection efficiency.

## 🛠️ Technology Stack

- **Frontend:** React, Vite, TailwindCSS, React Icons.
- **Backend:** Node.js, Express, Supabase (PostgreSQL).
- **Deployment:** Vercel (Frontend), Render (Backend).

## 📂 Project Structure

```text
├── backend/            # Express.js API
├── frontend/           # React Application
├── package.json        # Root workspace and build scripts
└── README.md
```

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (v18+)
- Supabase Account

### Setup
1. Clone the repository.
2. Install dependencies for all parts:
   ```bash
   npm run install:all
   ```
3. Configure Backend `.env`:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   PORT=5007
   ALLOWED_ORIGIN=*
   ```
4. Configure Frontend Variables (Optional for local):
   Create `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:5007
   ```

### Running Locally
- **Development (Both):** Use two terminals or a root script.
- **Production Dry-run:**
  ```bash
  npm run prod
  ```

## 🌐 Deployment Instructions

### Backend (Render)
1. Link your GitHub repo to Render.
2. Root Directory: `backend` (or use the root `package.json`).
3. Build Command: `npm install`
4. Start Command: `node index.js`
5. Set Environment Variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGIN`).

### Frontend (Vercel)
1. Link your GitHub repo to Vercel.
2. Framework: Vite.
3. Root Directory: `frontend`.
4. Build Command: `npm run build`
5. Output Directory: `dist`.
6. Set Environment Variable: `VITE_API_URL` (pointing to your Render backend).

## 📄 License
MIT
