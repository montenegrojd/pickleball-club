This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Pickleball Club - Tuesday Night League

A web application for managing pickleball club sessions, matches, and player statistics.

## Features

- 🏓 Session management with player check-in/check-out
- 🤖 Automated matchmaking with rotation rules
- 📊 Live scoring and statistics tracking
- 🏆 Leaderboards (daily and all-time)
- 🔒 Simple authentication with shared key
- 💾 Dual storage: JSON file or Firestore

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the template and set your authentication key:

```bash
cp env.template .env.local
# Edit .env.local and set AUTH_SECRET_KEY
```

### 3. Choose Storage Backend

#### Option A: JSON File Storage (Default)

No additional setup needed. Data is stored in `data/db.json`.

```bash
# In .env.local
USE_FIRESTORE=false
```

#### Option B: Firestore (Recommended for Production)

**For Local Development with Emulator:**

1. Start the Firestore emulator (in one terminal):
   ```bash
   npm run emulator
   ```

2. Configure environment (in `.env.local`):
   ```bash
   USE_FIRESTORE=true
   FIRESTORE_EMULATOR_HOST=localhost:8080
   GOOGLE_CLOUD_PROJECT=pickleball-dev
   ```

3. Optional: Migrate existing data from JSON:
   ```bash
   npm run migrate
   ```

4. Start the dev server (in another terminal):
   ```bash
   npm run dev
   ```

5. Access Emulator UI: [http://localhost:4000](http://localhost:4000)

**For Production (Cloud Run):**

Set environment variables in Cloud Run:
```bash
USE_FIRESTORE=true
GOOGLE_CLOUD_PROJECT=your-production-project-id
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### 5. Authenticate

Visit: `http://localhost:3000/auth?key=YOUR_SECRET_KEY`

Replace `YOUR_SECRET_KEY` with the value you set for `AUTH_SECRET_KEY` in `.env.local`.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run emulator` - Start Firestore emulator
- `npm run migrate` - Migrate JSON data to Firestore

## Docker Deployment

### Build Image

```bash
docker build -t pickleballclub:latest .
```

### Run Container

```bash
docker run -p 8080:8080 \
  -e AUTH_SECRET_KEY=your-secret-key \
  -e USE_FIRESTORE=true \
  -e GOOGLE_CLOUD_PROJECT=your-project-id \
  pickleballclub:latest
```

Access at: [http://localhost:8080](http://localhost:8080)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── auth/              # Authentication
│   └── hall-of-fame/      # All-time leaderboard
├── components/            # React components
│   ├── Leaderboard.tsx
│   ├── MatchControl.tsx
│   ├── MatchHistory.tsx
│   └── Roster.tsx
├── lib/
│   ├── matchmaker.ts      # Automated matchmaking logic
│   ├── types.ts           # TypeScript interfaces
│   └── storage/           # Storage adapters
│       ├── json-adapter.ts      # JSON file storage
│       ├── firestore-adapter.ts # Firestore storage
│       └── index.ts             # Storage factory
└── proxy.ts               # Authentication middleware

data/
└── db.json                # JSON storage (if USE_FIRESTORE=false)

scripts/
└── migrate-to-firestore.js # Data migration script
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET_KEY` | Yes | Shared key for player authentication |
| `AUTH_COOKIE_VALUE` | No | Custom cookie value (default: "authenticated") |
| `USE_FIRESTORE` | No | Use Firestore instead of JSON (default: false) |
| `FIRESTORE_EMULATOR_HOST` | No | Firestore emulator host (e.g., localhost:8080) |
| `GOOGLE_CLOUD_PROJECT` | If Firestore | GCP project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Local only | Path to service account key |

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
