#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { readFileSync } from "fs";
import { HevyClient } from "./api.js";
import { clearApiKey, CONFIG_FILE, getApiKey, setApiKey } from "./config.js";
import { formatDate, highlight, maskKey, muted, renderTable } from "./ui.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as { version: string };

type OutputOptions = {
  json?: boolean;
};

type ListResponse<T> = {
  data?: T[];
  items?: T[];
  workouts?: T[];
  exercises?: T[];
  routines?: T[];
};

function getList<T>(response: T[] | ListResponse<T>): T[] {
  if (Array.isArray(response)) {
    return response;
  }
  return (
    response.data ??
    response.items ??
    response.workouts ??
    response.exercises ??
    response.routines ??
    []
  );
}

function outputJson(payload: unknown): void {
  console.log(JSON.stringify(payload, null, 2));
}

function outputError(error: unknown, options: OutputOptions): void {
  const message = error instanceof Error ? error.message : String(error);
  if (options.json) {
    outputJson({ error: message });
  } else {
    console.error(chalk.red(message));
  }
}

async function requireApiKey(): Promise<{ apiKey: string; source: string }> {
  const { apiKey, source } = await getApiKey();
  if (!apiKey) {
    throw new Error(
      "No API key configured. Run `hevy auth set <api-key>` or set HEVY_API_KEY."
    );
  }
  return { apiKey, source };
}

function createClient(apiKey: string): HevyClient {
  return new HevyClient({ apiKey });
}

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

const program = new Command();
program
  .name("hevy")
  .description("Shiny CLI for the Hevy workout tracking API")
  .version(pkg.version)
  .option("--json", "output machine-readable JSON");

const auth = program.command("auth").description("manage API keys");

auth
  .command("set")
  .argument("<apiKey>", "Hevy API key (UUID)")
  .description("store API key")
  .action(async (apiKey) => {
    const opts = program.opts<OutputOptions>();
    try {
      await setApiKey(apiKey);
      if (opts.json) {
        outputJson({ saved: true, configPath: CONFIG_FILE });
      } else {
        console.log(`${highlight("Saved")}: ${CONFIG_FILE}`);
        console.log(`${highlight("Key")}: ${maskKey(apiKey)}`);
      }
    } catch (error) {
      outputError(error, opts);
      process.exitCode = 1;
    }
  });

auth
  .command("show")
  .description("show current API key")
  .action(async () => {
    const opts = program.opts<OutputOptions>();
    try {
      const { apiKey, source } = await getApiKey();
      if (!apiKey) {
        throw new Error("No API key configured.");
      }
      if (opts.json) {
        outputJson({ apiKey, masked: maskKey(apiKey), source });
      } else {
        console.log(`${highlight("Key")}: ${maskKey(apiKey)} ${muted(`(${source})`)}`);
      }
    } catch (error) {
      outputError(error, opts);
      process.exitCode = 1;
    }
  });

auth
  .command("clear")
  .description("remove stored API key")
  .action(async () => {
    const opts = program.opts<OutputOptions>();
    try {
      await clearApiKey();
      if (opts.json) {
        outputJson({ cleared: true });
      } else {
        console.log(`${highlight("Cleared")}: ${CONFIG_FILE}`);
      }
    } catch (error) {
      outputError(error, opts);
      process.exitCode = 1;
    }
  });

const workouts = program.command("workouts").description("workout operations");

workouts
  .command("list")
  .description("list workouts")
  .option("-p, --page <number>", "page number", "1")
  .option("-s, --page-size <number>", "page size", "10")
  .action(async (options) => {
    const opts = program.opts<OutputOptions>();
    const spinner = opts.json ? null : ora("Fetching workouts...").start();
    try {
      const { apiKey } = await requireApiKey();
      const client = createClient(apiKey);
      const page = toNumber(options.page, 1);
      const pageSize = toNumber(options.pageSize, 10);
      const response = await client.get<unknown>("/workouts", { page, pageSize });
      const items = getList<any>(response as any);

      if (opts.json) {
        outputJson({ page, pageSize, workouts: items });
      } else {
        spinner?.succeed(`Loaded ${items.length} workouts`);
        const rows = items.map((workout: any) => [
          workout.id ?? "—",
          workout.title ?? workout.name ?? "Untitled",
          formatDate(workout.start_time ?? workout.startTime ?? workout.date),
          workout.duration ?? workout.duration_minutes ?? "—",
        ]);
        console.log(renderTable(["ID", "Title", "Start", "Duration"], rows));
      }
    } catch (error) {
      spinner?.fail("Failed to fetch workouts");
      outputError(error, opts);
      process.exitCode = 1;
    }
  });

workouts
  .command("show")
  .description("show workout details")
  .argument("<id>", "workout ID")
  .action(async (id) => {
    const opts = program.opts<OutputOptions>();
    const spinner = opts.json ? null : ora("Fetching workout...").start();
    try {
      const { apiKey } = await requireApiKey();
      const client = createClient(apiKey);
      const response = await client.get<Record<string, unknown>>(`/workouts/${id}`);
      if (opts.json) {
        outputJson(response);
      } else {
        spinner?.succeed("Workout loaded");
        const rows = Object.entries(response).map(([key, value]) => [
          chalk.cyan(key),
          formatValue(value),
        ]);
        console.log(renderTable(["Field", "Value"], rows));
      }
    } catch (error) {
      spinner?.fail("Failed to fetch workout");
      outputError(error, opts);
      process.exitCode = 1;
    }
  });

workouts
  .command("count")
  .description("count workouts")
  .action(async () => {
    const opts = program.opts<OutputOptions>();
    const spinner = opts.json ? null : ora("Counting workouts...").start();
    try {
      const { apiKey } = await requireApiKey();
      const client = createClient(apiKey);
      const response = await client.get<Record<string, unknown>>("/workouts/count");
      const count = (response as { count?: number }).count ?? response;
      if (opts.json) {
        outputJson({ count });
      } else {
        spinner?.succeed("Workouts counted");
        console.log(`${highlight("Total")}: ${count}`);
      }
    } catch (error) {
      spinner?.fail("Failed to count workouts");
      outputError(error, opts);
      process.exitCode = 1;
    }
  });

const exercises = program.command("exercises").description("exercise catalog");

async function handleExercisesList(
  options: { page?: string; pageSize?: string; query?: string },
  opts: OutputOptions
): Promise<void> {
  const spinner = opts.json ? null : ora("Fetching exercises...").start();
  try {
    const { apiKey } = await requireApiKey();
    const client = createClient(apiKey);
    const page = toNumber(options.page, 1);
    const pageSize = toNumber(options.pageSize, 25);
    const response = await client.get<unknown>("/exercises", { page, pageSize });
    let items = getList<any>(response as any);

    if (options.query) {
      const query = String(options.query).toLowerCase();
      items = items.filter((exercise: any) =>
        String(exercise.name ?? "").toLowerCase().includes(query)
      );
    }

    if (opts.json) {
      outputJson({ page, pageSize, exercises: items });
    } else {
      spinner?.succeed(`Loaded ${items.length} exercises`);
      const rows = items.map((exercise: any) => [
        exercise.id ?? "—",
        exercise.name ?? "—",
        exercise.muscle_group ?? exercise.muscleGroup ?? "—",
        exercise.equipment ?? "—",
      ]);
      console.log(renderTable(["ID", "Name", "Muscle", "Equipment"], rows));
    }
  } catch (error) {
    spinner?.fail("Failed to fetch exercises");
    outputError(error, opts);
    process.exitCode = 1;
  }
}

exercises
  .command("list")
  .description("list exercises")
  .option("-p, --page <number>", "page number", "1")
  .option("-s, --page-size <number>", "page size", "25")
  .option("-q, --query <query>", "filter by name")
  .action(async (options) => {
    const opts = program.opts<OutputOptions>();
    await handleExercisesList(options, opts);
  });

exercises
  .command("search")
  .description("search exercises by name")
  .argument("<query>", "search query")
  .action(async (query) => {
    const opts = program.opts<OutputOptions>();
    await handleExercisesList({ query, page: "1", pageSize: "50" }, opts);
  });

const routines = program.command("routines").description("routine library");

routines
  .command("list")
  .description("list routines")
  .option("-p, --page <number>", "page number", "1")
  .option("-s, --page-size <number>", "page size", "10")
  .action(async (options) => {
    const opts = program.opts<OutputOptions>();
    const spinner = opts.json ? null : ora("Fetching routines...").start();
    try {
      const { apiKey } = await requireApiKey();
      const client = createClient(apiKey);
      const page = toNumber(options.page, 1);
      const pageSize = toNumber(options.pageSize, 10);
      const response = await client.get<unknown>("/routines", { page, pageSize });
      const items = getList<any>(response as any);

      if (opts.json) {
        outputJson({ page, pageSize, routines: items });
      } else {
        spinner?.succeed(`Loaded ${items.length} routines`);
        const rows = items.map((routine: any) => [
          routine.id ?? "—",
          routine.title ?? routine.name ?? "Untitled",
          formatDate(routine.updated_at ?? routine.updatedAt ?? routine.created_at),
        ]);
        console.log(renderTable(["ID", "Title", "Updated"], rows));
      }
    } catch (error) {
      spinner?.fail("Failed to fetch routines");
      outputError(error, opts);
      process.exitCode = 1;
    }
  });

routines
  .command("show")
  .description("show routine details")
  .argument("<id>", "routine ID")
  .action(async (id) => {
    const opts = program.opts<OutputOptions>();
    const spinner = opts.json ? null : ora("Fetching routine...").start();
    try {
      const { apiKey } = await requireApiKey();
      const client = createClient(apiKey);
      const response = await client.get<Record<string, unknown>>(`/routines/${id}`);
      if (opts.json) {
        outputJson(response);
      } else {
        spinner?.succeed("Routine loaded");
        const rows = Object.entries(response).map(([key, value]) => [
          chalk.cyan(key),
          formatValue(value),
        ]);
        console.log(renderTable(["Field", "Value"], rows));
      }
    } catch (error) {
      spinner?.fail("Failed to fetch routine");
      outputError(error, opts);
      process.exitCode = 1;
    }
  });

program
  .command("stats")
  .description("summary snapshot")
  .action(async () => {
    const opts = program.opts<OutputOptions>();
    const spinner = opts.json ? null : ora("Building stats...").start();
    try {
      const { apiKey } = await requireApiKey();
      const client = createClient(apiKey);
      const [countResponse, workoutsResponse] = await Promise.all([
        client.get<Record<string, unknown>>("/workouts/count"),
        client.get<unknown>("/workouts", { page: 1, pageSize: 3 }),
      ]);
      const workoutsCount = (countResponse as { count?: number }).count ?? countResponse;
      const workouts = getList<any>(workoutsResponse as any);
      const latest = workouts[0];

      if (opts.json) {
        outputJson({ workoutsCount, latestWorkout: latest ?? null });
      } else {
        spinner?.succeed("Stats ready");
        const rows = [
          ["Workouts", workoutsCount],
          ["Latest", latest ? (latest.title ?? latest.name ?? "Workout") : "—"],
          [
            "Latest Date",
            latest ? formatDate(latest.start_time ?? latest.startTime ?? latest.date) : "—",
          ],
        ];
        console.log(renderTable(["Metric", "Value"], rows));
      }
    } catch (error) {
      spinner?.fail("Failed to load stats");
      outputError(error, opts);
      process.exitCode = 1;
    }
  });

program.parseAsync().catch((error) => {
  outputError(error, program.opts<OutputOptions>());
  process.exitCode = 1;
});
