import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, parse } from "node:path";

import type {
  CompositionConfig,
  FrameSenseConfig,
  GuidanceConfig,
  InferenceConfig,
  PerformanceConfig,
} from "./types.js";
import { validateFrameSenseConfig } from "./validation.js";

export interface ConfigLoadOptions {
  readonly configDirectory?: string;
}

export async function getConfig(options: ConfigLoadOptions = {}): Promise<FrameSenseConfig> {
  const configDirectory = options.configDirectory ?? findConfigDirectory(process.cwd());
  const [composition, inference, guidance, performance] = await Promise.all([
    readJson<CompositionConfig>(configDirectory, "composition"),
    readJson<InferenceConfig>(configDirectory, "inference"),
    readJson<GuidanceConfig>(configDirectory, "guidance"),
    readJson<PerformanceConfig>(configDirectory, "performance"),
  ]);

  return validateFrameSenseConfig({
    composition,
    inference,
    guidance,
    performance,
  });
}

function findConfigDirectory(startDirectory: string): string {
  let currentDirectory = startDirectory;

  while (true) {
    const candidate = join(currentDirectory, "configs");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory || currentDirectory === parse(currentDirectory).root) {
      return join(startDirectory, "configs");
    }

    currentDirectory = parentDirectory;
  }
}

async function readJson<TConfig>(configDirectory: string, category: string): Promise<TConfig> {
  const filePath = join(configDirectory, category, "default.json");
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as TConfig;
}
