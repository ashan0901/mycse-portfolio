This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, copy `.env.local.example` to `.env.local` and set your Supabase values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_FEE_RATE=0.0112
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deploy on Netlify

This project includes `netlify.toml` and uses `@netlify/plugin-nextjs` (configured in Netlify UI or auto-detected with the plugin).

1. Push the `mycse-portfolio` project to a Git repository.
2. In Netlify, create/import the site from that repo.
3. Set **Base directory** to `mycse-portfolio` if the repo root is the parent folder.
4. Build settings (from `netlify.toml`): build command `npm run build`, publish `.next`.
5. Add environment variables in Netlify:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_FEE_RATE` (optional, defaults in app logic)
6. In Supabase Auth URL settings, add your Netlify site URL (and custom domain, if used) to redirect/allowed URLs.

Apply Supabase migrations in `supabase/migrations/` (including `0002_cds.sql`) to your hosted database before using CDS features.

> Compatibility note: this app uses Next.js 16 with `proxy.ts` and `cacheComponents`/prefetch config. Netlify’s OpenNext/Next Runtime support can lag behind the newest Next.js features; if the Netlify build/runtime fails, consider deploying to Vercel for full Next.js 16 support or test the Netlify build after connecting the repo.
