# Komal's Portfolio AI Assistant — Backend

This is the backend API that powers the AI chatbot on Komal Singh's portfolio website.

## What it does
- Receives chat messages from the portfolio frontend
- Sends them to Claude (Anthropic API) along with a knowledge base about Komal as context
- Returns Claude's response to display in the chat widget
- Detects when a visitor is a potential job/freelance lead and automatically emails a notification

## Architecture
This is a single serverless function (`api/chat.js`) deployed on Vercel. It exists separately from the portfolio's static site (hosted on GitHub Pages) because:
1. The Claude API key must never be exposed in browser-side code
2. Vercel functions run server-side, keeping the key secure as an environment variable

## Environment Variables (set in Vercel dashboard, never in code)
- `ANTHROPIC_API_KEY` — Claude API key from console.anthropic.com
- `RESEND_API_KEY` — API key from resend.com (free tier) for sending lead notification emails
- `NOTIFICATION_EMAIL` — the email address that should receive lead notifications (Komal's email)

## Deployment
1. Push this repo to GitHub
2. Connect the repo in Vercel (vercel.com → New Project → Import)
3. Add the three environment variables above in Vercel's project settings
4. Deploy — Vercel will give you a URL like `https://komal-chatbot-api.vercel.app`
5. Use `https://komal-chatbot-api.vercel.app/api/chat` as the endpoint URL in the portfolio's chat widget JavaScript

## Local testing
Not required for this project, but if testing locally, use the Vercel CLI:
```
npm install -g vercel
vercel dev
```

## Tech stack
- Vercel Serverless Functions (Node.js)
- Anthropic Claude API (claude-sonnet-4-6)
- Resend API (transactional email)
