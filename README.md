# hevy-cli

Shiny, colorful CLI for the Hevy workout tracking API.

## Features

- `hevy auth set/show/clear` for API key management
- Workouts: list, show, count
- Exercises: list, search
- Routines: list, show
- Stats summary snapshot
- `--json` for machine-readable output

## Install

```bash
npm install
npm run build
```

For local usage without publishing:

```bash
npm link
```

## Auth

Save your API key once (stored at `~/.config/hevy-cli/config.json`):

```bash
hevy auth set <api-key>
```

Or use an environment variable:

```bash
export HEVY_API_KEY=your-key
```

## Usage

```bash
hevy --help
hevy auth show
hevy workouts list --page 1 --page-size 10
hevy workouts show <id>
hevy workouts count
hevy exercises list --query "bench"
hevy exercises search "deadlift"
hevy routines list
hevy routines show <id>
hevy stats
```

Machine-readable output:

```bash
hevy workouts list --json
```

## Development

```bash
npm run dev -- --help
```
