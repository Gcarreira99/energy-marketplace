import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

// Lists direct dependencies that are missing from node_modules or installed at a
// different version than package-lock.json pins, e.g. after pulling a commit that
// added a package.
export function staleDependencies(dir) {
  const manifest = readJson(join(dir, "package.json")) ?? {};
  const lockPackages = readJson(join(dir, "package-lock.json"))?.packages ?? {};
  const names = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  return names.filter((name) => {
    const installed = readJson(join(dir, "node_modules", name, "package.json"));
    if (!installed) return true;
    const locked = lockPackages[`node_modules/${name}`]?.version;
    return locked !== undefined && locked !== installed.version;
  });
}

export function needsInstall(dir) {
  return !existsSync(join(dir, "node_modules")) || staleDependencies(dir).length > 0;
}
