# Dark Plains

TypeScript roguelike pirate game. Next.js on Vercel, Supabase for auth and multiplayer.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
```

## Env

See `.env.example`. Production also needs `NEXT_PUBLIC_SITE_URL` (password-reset mail). Hosted cutover steps live in [`docs/supabase-manual-checklist.md`](docs/supabase-manual-checklist.md).

## Where work lives

- Live tracker: [`docs/STATUS.md`](docs/STATUS.md)
- Executable queue: [GitHub Issues](https://github.com/Zacc-wind/Dark-plains/issues)
- Design (not the tracker): [`docs/multiplayer-roadmap.md`](docs/multiplayer-roadmap.md), [`docs/database-deployment-plan.md`](docs/database-deployment-plan.md), [`docs/progression-content-roadmap.md`](docs/progression-content-roadmap.md)
