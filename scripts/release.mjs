import { execSync } from "node:child_process";
import semver from "semver";
import { parseCommits } from "conventional-commits-parser";

function git(command) {
  return execSync(`git ${command}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
  }).trim();
}

const tags = git("tag --sort=-version:refname");

const latestTag = tags
  .split("\n")
  .find((tag) => semver.valid(tag.replace(/^v/, "")));

const currentVersion = latestTag
  ? latestTag.replace(/^v/, "")
  : "0.0.0";

console.log(`Current version: ${currentVersion}`);

const range = latestTag ? `${latestTag}..HEAD` : "HEAD";

const log = git(
  `log ${range} --format=%B%n---COMMIT-END---`
);

const commits = log
  .split("---COMMIT-END---")
  .map((commit) => commit.trim())
  .filter(Boolean)
  .map((commit) => parseCommits(commit));

let releaseType = null;

for (const commit of commits) {
  if (commit.header?.includes("BREAKING CHANGE") || commit.notes?.length) {
    releaseType = "major";
    break;
  }

  if (commit.type === "feat") {
    releaseType = releaseType === "major" ? "major" : "minor";
  }

  if (commit.type === "fix" && !releaseType) {
    releaseType = "patch";
  }
}

if (!releaseType) {
  console.log("No release-worthy commits found.");
  process.exit(0);
}

const nextVersion = semver.inc(currentVersion, releaseType);
const tag = `v${nextVersion}`;

console.log(`Release type: ${releaseType}`);
console.log(`Next version: ${nextVersion}`);
console.log(`Creating tag: ${tag}`);

git(`tag -a ${tag} -m "Release ${tag}"`);
git(`push origin ${tag}`);

console.log(`Released ${tag}`);