# Welcome to Jett and Rick's Starter Kit

Based on a base-stack for Forge 42 projects. This is an ESM Vite stack with Remix.run / React Router v7.

It includes a basic setup for a project with react-router v7 framework mode and:

- React 19 & react-compiler
- TypeScript
- TailwindCSS
- Vite
- Vitest (unit tests)
- Scripting
- Biome (linter & formatter)
- Knip (remove unused code)
- i18n support (client and server)
- Icons spritesheet generator
- lefthook hooks
- CI checks for quality control
- react-router-devtools
- Hono server
- .env var handling for server and client
- SEO robots.txt, sitemap-index and sitemap built in.

## Additional Libraries (Rick Added)

- [Zod](https://zod.dev/): (for type checking)
- [dotenvx](https://dotenvx.com/): (for .env handling) Note: brew install dotenvx/brew/dotenvx
- [Conform](https://conform.guide/): (for form validation)
- [ShadcnUI](https://ui.shadcn.com/): (for UI components, added Lucide-React)
- [Consola](https://github.com/consola/consola): (for logging) see ~/utils/logger.ts

## Internationalization

This stack uses i18next for internationalization. It supports both client and server side translations.
Features included out of the box:

- Support for multiple languages
- Typesafe resources
- client side translations are fetched only when needed
- language switcher
- language detector (uses the request to detect the language, falls back to your fallback language)

## Hono server

This stack uses Hono for the server. More information about Hono can be found [here](https://honojs.dev/).
Another important thing to note is that we use a dependency called `react-router-hono-server` which is a wrapper for Hono that allows us to use Hono in our React Router application.

The server comes preconfigured with:

- i18next middleware
- caching middleware for assets
- easily extendable global application context
- .env injection into context

In order to add your own middleware, extend the context, or anything along those lines, all you have to do is edit the server
inside the `entry.server.tsx` file.

## Encrypted .env Files (dotenvx)

This stack uses dotenvx to encrypt your .env files. More information about dotenvx can be found [here](https://dotenvx.com/).
We are committing .env.production and .env.example to the repository. env.keys has public and private keys and is NOT commited. Not sure how to share across team yet as there doesnt seem to be an integrated way.

## .env handling

This stack parses your `.env` file and injects it into the server context. For the client side, in the `root.tsx` file, we use the `useLoaderData` hook to get the `clientEnv` from the server and set it as a global variable on the `window` called `env`.
If you need to access the env variables in both environments, you can create a polyEnv helper like this:

```ts
// app/utils/env.ts
// This will return the process.env on the server and window.env on the client
export const polyEnv = typeof process !== "undefined" ? process.env : window.env;
```

The server will fail at runtime if you don't set your `.env` file properly.

## Getting started

Fork the repository, Install the dependencies, and run:

```bash
pnpm install
pnpm run dev
```
