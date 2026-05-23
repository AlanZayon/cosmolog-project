This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Copy environment variables and start the Rust API (see [apps/api/README.md](apps/api/README.md)):

```bash
cp .env.example .env.local
# Add NEXT_PUBLIC_API_URL=http://127.0.0.1:8080 to .env.local

cd apps/api && cargo run   # terminal 1
```

Then run the Next.js app:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Docker (full dev stack)

Local Postgres + API + Next.js:

```bash
cp apps/api/.env.docker.example apps/api/.env.docker
# Edit apps/api/.env.docker — Supabase URL + anon key (auth still uses Supabase)

docker compose -f docker-compose.dev.yml up --build
```

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| API      | http://localhost:8080 |
| Postgres | `localhost:5434` (user/pass/db: `cosmolog` / `cosmolog` / `cosmolog_dev`) |

## Dev Container

Open the repo in VS Code / Cursor → **Reopen in Container**. The dev container includes Rust, Node, and Postgres (via compose). Inside the container:

```bash
# terminal 1
cd apps/api && cargo run

# terminal 2
npm run dev
```

Set `DATABASE_URL=postgres://cosmolog:cosmolog@postgres:5432/cosmolog_dev` in `apps/api/.env` (or use `.env.docker` values).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
