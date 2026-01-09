# Vibe Monorepo

A full-stack Next.js application with:

- Web App: Next.js 15, React 19, TypeScript  
- API: tRPC + Inngest routes  
- Worker: Inngest background functions for sandboxed code execution  
- Database: Prisma ORM with PostgreSQL  

---

## 🚀 Repository Architecture

This repository is organized into logical “packages” and directories to make it easy to reason about responsibilities and ownership in a monorepo layout.

```
.
├── prisma/                     # Prisma schema & migrations
├── public/                     # Static assets (SVGs, icons)
├── sandbox-templates/          # Base templates for code sandboxes
├── src/
│   ├── app/                    # Next.js app routes, Layout & global CSS
│   │   ├── (home)/             # Home, sign-in, sign-up, pricing pages
│   │   └── api/                # Inngest & tRPC HTTP endpoints
│   ├── components/             # UI components & MagicUI patterns
│   ├── hooks/                  # Custom React hooks
│   ├── innpest/                # Inngest client & functions
│   ├── lib/                    # Utilities & Prisma client
│   ├── modules/                # Feature modules: home, projects, messages, usage
│   ├── trpc/                   # tRPC client/server init & routers
│   └── types.ts                # Shared TypeScript types
├── .eslintrc.mjs               # ESLint config
├── next.config.ts              # Next.js config
├── tsconfig.json               # TypeScript config
├── package.json                # Root dependencies & scripts
└── README.md                   # ← you are here
```

### Logical Package Listing

| Package       | Path                          | Description                                  |
| ------------- | ----------------------------- | -------------------------------------------- |
| @vibe/web     | ./src/app                     | Next.js UI, pages, global providers, styling |
| @vibe/api     | ./src/app/api                 | REST & tRPC HTTP handlers (Next.js API routes) |
| @vibe/worker  | ./src/inngest                 | Inngest background functions and workers     |
| @vibe/db      | ./prisma & ./src/lib/db.ts    | Prisma schema, migrations & Prisma client    |

---

## 📦 Requirements & Shared Dependencies

Minimum system requirements and major shared libraries used across the monorepo:

- Node: >= 22.12.0, npm: >= 11.2.0 (from package.json "engines")
- TypeScript, Next.js, React
- Prisma (with Accelerate extension)
- tRPC + @trpc/react-query
- Inngest
- Tailwind CSS + PostCSS
- @radix-ui components, clsx, date-fns, zod, superjson, and more

See full dependency list in [package.json](./package.json).

---

## ⚙️ Development Workflow

Follow these steps to run the project locally.

### 1. Prerequisites

- Node.js v22.12.0 or later and npm v11.2.0 or later
- PostgreSQL instance available and reachable
- Create a `.env` file in the project root (see Environment Variables table below)

### 2. Install dependencies

Use the project's lockfile to install reproducible dependencies:

```bash
npm ci
```

### 3. Prisma Setup

Generate the Prisma client and run development migrations:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Prisma configuration and schema live in `prisma/schema.prisma`. The generated client is configured to use Prisma Accelerate in `src/lib/db.ts`.

### 4. Environment variables (copy from example)

If new environment variables are added or you’re onboarding a new developer:

```bash
cp .env.example .env
# Then edit .env accordingly
```

### 5. Start development server

```bash
npm run dev
```

Visit:
- Frontend & API: http://localhost:3000

Inngest functions are registered and served via Next.js endpoints defined under `src/app/api`.

### 6. Lint & Format

Run linting and formatting as part of your development flow:

```bash
npm run lint
npm run format
```

---

## 🧰 Scripts (package.json)

The primary scripts in the root `package.json`:

| Script        | Command                     | Purpose                              |
| ------------- | --------------------------- | -------------------------------------|
| dev           | npm run dev                 | Run Next.js in development (with turbopack) |
| build         | npm run build               | Build Next.js for production         |
| start         | npm run start               | Start Next.js production server      |
| lint          | npm run lint                | Run ESLint                           |
| format        | npm run format              | Run Prettier to format code          |

Source: the `scripts` section of [package.json](./package.json).

---

## 🔌 Ports & Endpoints

| Service           | Path / URL                      | Notes |
| ----------------- | ------------------------------- | ----- |
| Next.js (web + api)| http://localhost:3000          | Main frontend and baked API routes |
| tRPC              | /api/trpc                       | tRPC HTTP endpoint (see src/app/api/trpc/[trpc]/route.ts) |
| Inngest           | /api/inngest                    | Inngest serve endpoint (see src/app/api/inngest/route.ts) |

---

## 📝 Environment Variables

A concise table with the common environment variables used across the app. Marked as Required vs Optional.

| ENV                  | Required | Description |
| -------------------- | -------- | ----------- |
| DATABASE_URL         | Yes      | PostgreSQL connection string (used by Prisma) |
| NEXT_PUBLIC_*        | Depends  | Public runtime variables exposed to the client |
| CLERK_*              | Optional | Clerk configuration if using Clerk auth (present in deps) |
| INNGEST_API_KEY / INNGEST_AUTH_TOKEN | Optional | Inngest authentication token used for production integrations |

Example (in project root `.env`):

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
# NEXT_PUBLIC_API_URL=http://localhost:3000
# INNGEST_API_KEY=...
# CLERK_...=...
```

---

## 🏗 Build & Deploy Commands

High-level build and deployment responsibilities per logical package:

| Package       | Build / Deploy Commands                                  | Description                           |
| ------------- | -------------------------------------------------------- | --------------------------------------|
| @vibe/web     | npm run build && npm run start                           | Build and run Next.js in production   |
| @vibe/db      | npx prisma generate <br> npx prisma migrate deploy       | Generate client & deploy migrations   |
| @vibe/api     | (bundled with Next.js build)                             | Handled by Next.js build & runtime    |
| @vibe/worker  | (deployed via Inngest endpoint)                          | Functions registered via /api/inngest |

Deployment checklist:
- Ensure DATABASE_URL points to the production database
- Run `npx prisma migrate deploy` during deployment
- Provide Inngest auth token for production triggers if needed
- Configure any provider-specific environment variables (e.g., Clerk, Vercel)

---

## 📦 Shared Services & Internals (notes)

- Prisma client is extended with Prisma Accelerate in `src/lib/db.ts`.
- tRPC is mounted at `/api/trpc` with a fetch handler (see `src/app/api/trpc/[trpc]/route.ts`).
- Inngest functions are registered in `src/app/api/inngest/route.ts` and defined in `src/inngest/functions.ts`.
- Sandbox creation and background work uses the @e2b code-interpreter and the Inngest agent kit.

---

## 🤝 Contributing

We welcome contributions. Please follow these steps:

1. Fork the repository.  
2. Create a feature branch:
   git checkout -b feat/your-feature  
3. Commit your changes and push:
   git push origin feat/your-feature  
4. Open a Pull Request with a clear description of your changes and any relevant context.

Guidelines:
- Keep changes scoped to a single logical change per PR.
- Run linting and formatting before submitting: npm run lint && npm run format.
- Include tests or manual verification steps for significant changes.

---

## 📖 Further Reading

- Next.js Docs: https://nextjs.org/docs  
- Prisma Docs: https://pris.ly/d/prisma  
- tRPC Docs: https://trpc.io/docs  
- Inngest Docs: https://docs.inngest.com  
- Tailwind CSS: https://tailwindcss.com/docs

---

Enjoy building with Vibe! 🎉