# jev-crowd

A tiny animated moral-probe website for TypeSafe's Jev classifier.

Users type a **fictional, hypothetical moral dilemma** and watch 42 tiny humans move between three classifier outcomes:

- **ACT** — intervene / take the proposed action
- **CONFLICTED** — morally torn or underdetermined
- **DON'T ACT** — do not intervene

The animation is probability-aware: when the distribution changes, only the minimum number of tiny humans needed to represent the new distribution switch camps.

> **This visualizes classifier outputs, not a correct moral answer. Humans here doesn't represent real humans**

## Run locally

Requires Node.js 18+.

```bash
npm start
```

Then open `http://localhost:3000`.

Without an API key, the site runs in a clearly labelled **Preview Mode** so the UI and animation can be tested.

## Enable Jev

Set the API key as a server-side environment variable:

```bash
export TYPESAFE_API_KEY="your_key_here"
npm start
```

The browser only calls `/api/classify`. The API key stays on the server.

The server asks Jev two questions in parallel:

1. A `noul` gate: is this a fictional moral dilemma appropriate for the playground?
2. A `choice` classification: `act`, `dont_act`, or `conflicted`.

## Scope

This demo is intentionally framed around fictional philosophy questions. The scope gate rejects inputs that appear to be real-world plans to hurt someone, instructions for wrongdoing, self-harm, political persuasion, targeted hate/harassment, or requests to judge a real identifiable person.

The site does **not** claim that Jev's output is morally correct, representative of public opinion, or representative of real humans.

## Structure

```text
jev-crowd/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── server.mjs
├── package.json
├── .env.example
└── README.md
```
