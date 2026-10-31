# Obsidian Study — setup guide

A responsive Next.js + Tailwind CSS study dashboard with Supabase email-magic-link authentication and cloud-backed tasks, subjects, and completed focus sessions.

## 1. Requirements
- Node.js 20.9+ (LTS recommended)
- A free Supabase account: https://supabase.com
- A terminal (PowerShell, Windows Terminal, Linux terminal, or VS Code terminal)

## 2. Run locally
Extract this ZIP, open the extracted `study-command-center-nextjs` folder in VS Code, and run:

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`.
Open http://localhost:3000.

The app works in local mode without Supabase, and stores the current workspace in this browser's local storage.

## 3. Create the Supabase project
1. Create a project at https://supabase.com/dashboard.
2. Open Project Settings → API (or Connect) and copy the Project URL and publishable key / anon key.
3. Put them in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

4. In Supabase, open SQL Editor → New query.
5. Paste and run the complete `supabase/schema.sql` file from this project. It creates the three tables and Row Level Security policies.
6. In Supabase Authentication → URL Configuration, add your local URL `http://localhost:3000` to the allowed redirect URLs.
7. Restart the Next.js dev server after changing `.env.local` (`Ctrl+C`, then `npm run dev`).
8. In the app, choose **Connect sync**, enter your email, and use the magic link sent to your inbox.

Never put a Supabase service-role key in a `NEXT_PUBLIC_` variable or in browser code. The publishable/anon key is designed for browser use when Row Level Security is enabled.

## 4. Use on phone and laptop
### During development on the same Wi-Fi
Start the dev server so it listens on your local network:

```bash
npm run dev -- --hostname 0.0.0.0
```

Find your laptop's LAN IP (for example, `192.168.1.10`) and open `http://YOUR-LAPTOP-IP:3000` on your phone. Allow the port through your firewall if prompted. This only works while both devices are on the same network and the laptop's server is running.

### For access from anywhere
Deploy the repository to GitHub and import it into Vercel. Add the same two environment variables in Vercel Project Settings → Environment Variables, deploy, then add your deployed domain to Supabase Authentication → URL Configuration. Open that URL on both devices and sign in with the same email. Cloud data is scoped per user and protected by Row Level Security.

## 5. Current implementation notes
- Task creation and completion, subject creation/progress, focus timer, weekly analytics, and local persistence are implemented.
- Supabase auth uses email magic links.
- Task, subject and completed-session writes are sent to Supabase when configured and signed in.
- A fresh Supabase account starts with no cloud records; this starter does not automatically upload the demo sample tasks/subjects into the cloud. Add your own tasks and subjects after sign-in.
- For production use, test sign-in redirect settings and build/deploy the app before relying on it as your only record.
