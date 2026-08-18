# TradeMitra

An MNC-grade Paper Trading Platform (Equity & F&O) heavily inspired by the Groww app's UI/UX and workflows.

**Author**: Sumer Kumar
**Architecture**: Monorepo (Turborepo + pnpm workspaces), Screaming Architecture, DDD, Repository Pattern, PostgreSQL Connection Pooling, and Real-time Socket.io streaming.

---

## 🛠️ Project Stack & Architecture

- **Root Workspace**: Turborepo, pnpm workspaces, TypeScript
- **Backend (`apps/api`)**: Node.js, Express, TypeScript, Socket.io, native `pg` driver (no ORMs)
- **Frontend (`apps/web`)**: React.js, Vite, Tailwind CSS (Groww Dark Theme), Zustand
- **Database**: PostgreSQL (native raw SQL migrations)
- **Shared Package (`packages/shared`)**: Shared TS DTOs, Enums, and Interfaces
- **Database Package (`packages/database`)**: Singleton connection pooler and lifecycle manager

---

## 📋 Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v20.0.0` or higher
- **pnpm**: `v9.0.0` or higher
- **PostgreSQL**: `v15` or higher (optional, resilient in-memory fallback is active)

---

## 🚀 Quick Start Guide

### 1. Clone & Initialize the Workspace

Install all dependencies and link the workspace packages:
```bash
# Run from the root directory
pnpm install
```

### 2. Configure Environment Variables

Copy the example environment file to the root of the workspace (and to `apps/api` if necessary, though the root is checked):
```bash
cp .env.example .env
```
*(If on Windows PowerShell: `Copy-Item .env.example .env`)*

Configure your database credentials in the `.env` file:
```ini
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trademitra_db
DB_USER=postgres
DB_PASSWORD=your_password
```

### 3. Database Setup (Optional)

If your local PostgreSQL is running, execute the initial DDL migrations and seed the mock NIFTY contracts and Sumer Kumar's demo wallet (₹10 Lakhs margin):

```bash
# Compile packages
pnpm build

# Run migration script
pnpm --filter @trademitra/database db:migrate

# Run seed script
pnpm --filter @trademitra/database db:seed
```
*Note: If no PostgreSQL instance is running or connection fails, the platform will automatically activate its resilient in-memory store so you can still experience the full trading lifecycle.*

---

## 🏃 Running the Application

You can run both the frontend and backend simultaneously or individually.

### Run Both Simultaneously (Recommended)
This runs both servers in development/watch mode using Turborepo:
```bash
pnpm dev
```

### Run Backend Only (`apps/api`)
```bash
pnpm --filter @trademitra/api dev
```
- **REST Endpoint**: `http://localhost:4000/api/v1`
- **Swagger Documentation**: `http://localhost:4000/api-docs`
- **Socket.io Host**: `ws://localhost:4000`

### Run Frontend Only (`apps/web`)
```bash
pnpm --filter @trademitra/web dev
```
- **Vite Web URL**: `http://localhost:5173`

---

## 🏗️ Monorepo Structures

### Monorepo "Screaming Architecture" Target
```
trademitra-workspace/
├── package.json & pnpm-workspace.yaml
├── turbo.json
├── apps/
│   ├── api/          # Express API & socket.io tick broadcaster
│   └── web/          # React + Vite + Tailwind frontend app (Groww UI)
└── packages/
    ├── database/     # High-performance pg PoolManager Singleton
    └── shared/       # Shared TypeScript DTOs, Enums, and Interfaces
```

### Build & Clean Scripts
- Build all apps and workspace packages: `pnpm build`
- Format entire codebase: `pnpm format`
- Deep clean workspace dependencies and build targets: `pnpm clean`
