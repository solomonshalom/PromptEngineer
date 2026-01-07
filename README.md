# PromptEngineer

Master the art of prompt engineering through interactive typing challenges. Learn techniques like zero-shot prompting, chain-of-thought, few-shot learning, and more — all while improving your typing speed.

## Features

- **Challenge Mode** — Real-time prompt engineering challenges with AI evaluation
- **Race Mode** — Compete against Claude's typing speed
- **Adaptive Difficulty** — Challenges adjust based on your performance
- **Lesson Curriculum** — Structured modules covering prompt engineering fundamentals to advanced techniques
- **Live WPM Tracking** — Real-time words-per-minute with history charts
- **Leaderboards** — Compete globally for the highest WPM
- **Shareable Results** — Unique short URLs with OpenGraph images for social sharing
- **Keyboard Sounds** — Satisfying mechanical keyboard audio feedback

## Tech Stack

- **Next.js 16** (App Router) + **React 19**
- **InstantDB** — Real-time database with offline support
- **Groq API** — Fast AI evaluation for prompt scoring
- **Tailwind CSS 4** — Styling
- **GSAP** — Animations
- **Howler.js** — Audio

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your keys

# Push database schema
npx instant-cli push schema
npx instant-cli push perms

# Run development server
pnpm dev
```

## Environment Variables

```env
NEXT_PUBLIC_INSTANT_APP_ID=   # InstantDB App ID
INSTANT_ADMIN_TOKEN=          # InstantDB Admin Token
GROQ_API_KEY=                 # Groq API Key
NEXT_PUBLIC_APP_URL=          # Your app URL (for OG images)
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm lint` | Run ESLint |
| `npx instant-cli push schema` | Push database schema |
| `npx instant-cli push perms` | Push permission rules |

## License

MIT
