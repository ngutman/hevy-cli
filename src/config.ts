import fs from "fs/promises";
import path from "path";
import os from "os";

export const CONFIG_DIR = path.join(os.homedir(), ".config", "hevy-cli");
export const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export type Config = {
  apiKey?: string;
};

export async function readConfig(): Promise<Config> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8");
    return JSON.parse(raw) as Config;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function writeConfig(config: Config): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
}

export async function setApiKey(apiKey: string): Promise<void> {
  const config = await readConfig();
  config.apiKey = apiKey;
  await writeConfig(config);
}

export async function clearApiKey(): Promise<void> {
  await writeConfig({});
}

export async function getApiKey(): Promise<{ apiKey?: string; source: "env" | "config" | "missing" }> {
  const envKey = process.env.HEVY_API_KEY;
  if (envKey) {
    return { apiKey: envKey, source: "env" };
  }
  const config = await readConfig();
  if (config.apiKey) {
    return { apiKey: config.apiKey, source: "config" };
  }
  return { apiKey: undefined, source: "missing" };
}
