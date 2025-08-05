# How To Work with libraries and scripts in this starter kit

This Typescript project uses 'pnpm' as the package manager. It is a drop-in replacement for 'npm' and 'yarn'.

## Type Checking

Type checking is done using 'tsc'. It is a drop-in replacement for 'tsc'.

To run type checking, use the following command:

```bash
pnpm run typecheck
```

## Biome

Biome is a linter and formatter for JavaScript, TypeScript, CSS, HTML, and JSON. It is a drop-in replacement for ESLint and Prettier.

To run Biome, use the following command:

```bash
biome check
biome format
```

It's also possible to run biome as a pre-commit hook. See the .pre-commit-config.yaml file for more information. There is also a pnpm script: `pnpm run check:fix`

## Lefthook

Lefthook is a pre-commit hook manager. It is used to run scripts before a commit is made. See the lefthook.yml for more information.

## Knip

Knip is a tool to find unused code in your codebase. It is used to find unused code in the codebase. See the knip.json file for more information. There is also a pnpm script: `pnpm run check:unused:fix`

## Overrides

Sometimes it can be hard to get clean results to make a commit. In that case, you can modify the biome.json, lefthook.yml, or knip.json files to override the default behavior.

e.g. we are using biome to check for unused code, but we want to allow unused code in the 'supabase' directory. We can modify the biome.json file to ignore the 'supabase' directory.
