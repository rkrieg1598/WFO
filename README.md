# 🌴 White Family Olympics

A retro-Florida companion app for your family games tournament. Players sign up, view live standings, read event rules, share photos, and track their progress. One admin (you) runs the scoreboard.
 
Built with **React + Vite + Supabase**. Mobile-first.

---

## What's inside

| Page | Who | What |
|------|-----|------|
| 🏠 Home | All | Your rank, top 3, last event, next event |
| 🏆 Progress Tracker | All | Live leaderboard (real-time), per-event breakdown |
| 📋 Instructions | All | Rules + photo + Google Map for each event |
| 📸 Photo Gallery | All | Upload, caption, like ❤️, comment 💬, download ⬇️ |
| 🌴 Profile | All | Photo, rank, score, your best events |
| 🔍 Scavenger Hunt | All | Locked until you unlock it (placeholder to build later) |
| 🛠️ Admin Panel | You only | Enter scores, edit rules/maps, assign teams, unlock hunt |

Admin = whoever signs in with **regankrieg@gmail.com**. That account is also a normal competing player.

---

## Setup (about 15 minutes, no coding needed)

### 1. Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → sign up (free) → **New Project**.
2. Pick a name + password, wait ~2 min for it to spin up.

### 2. Set up the database
1. In Supabase, open **SQL Editor** → **New query**.
2. Open `supabase_setup.sql` from this folder, copy ALL of it, paste, click **Run**.
   - This creates every table, security rule, real-time feeds, and the two storage buckets.

### 3. Confirm the storage buckets
- Go to **Storage**. You should see `avatars` and `photos`, both marked **Public**.
- If they're not there, click **New bucket**, name them exactly `avatars` and `photos`, and turn **Public bucket** ON.

### 4. Turn off email confirmation (so the invite link is instant)
- **Authentication → Providers → Email** → turn **OFF** "Confirm email" → Save.
  (Otherwise everyone has to click a confirmation email before logging in.)

### 5. Plug your keys into the app
1. In Supabase: **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
2. In this folder, copy `.env.example` to `.env` and paste them in:
   ```
   VITE_SUPABASE_URL=https://yourproject.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ......
   ```

### 6. Run it locally
```bash
npm install
npm run dev
```
Open the link it prints (usually http://localhost:5173).

### 7. Make your admin account
- Click **Sign Up**, register with **regankrieg@gmail.com**. That account automatically has admin powers (the ☰ menu shows "Admin Panel").

---

## Deploying to your website

```bash
npm run build
```
This creates a `dist/` folder. Upload its contents to your host, **or** connect the repo to [Vercel](https://vercel.com) / [Netlify](https://netlify.com) (both free):
- Build command: `npm run build`
- Output directory: `dist`
- Add the two `VITE_SUPABASE_*` values as Environment Variables in the host's dashboard.

> Single-page-app note: tell your host to redirect all routes to `index.html` (Vercel/Netlify do this automatically). On Netlify, the included `netlify.toml` handles it.

Share your site URL — that's the universal invite link. 🎟️

---

## Running the games (your admin cheat-sheet)

- **Enter scores:** Admin Panel → Scores → pick event → set each player's place → Save. (Saving also marks the event "complete" so Home updates.)
- **Scavenger Hunt:** Teams tab → assign 4 teams of 2. Score it on the Scores tab using **team placement 1–4** (8/6/4/2 pts; teammates get the same place). Unlock the page from Settings when it's time.
- **Rules & maps:** Rules tab → pick event → type instructions, upload a photo, paste a Google Maps embed (Maps → Share → "Embed a map" → copy HTML).

Have fun out there. ☀️🏆
