import { execFileSync } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function parseVersion(version) {
  const match = versionPattern.exec(version);

  if (!match) {
    throw new Error(`Package version "${version}" is not valid SemVer`);
  }

  const prerelease = match[4]?.split(".") ?? [];
  for (const identifier of prerelease) {
    if (
      /^\d+$/.test(identifier) &&
      identifier.length > 1 &&
      identifier[0] === "0"
    ) {
      throw new Error(`Package version "${version}" is not valid SemVer`);
    }
  }

  return {
    raw: version,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  };
}

function comparePrerelease(left, right) {
  if (left.length === 0 && right.length === 0) {
    return 0;
  }
  if (left.length === 0) {
    return 1;
  }
  if (right.length === 0) {
    return -1;
  }

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = left[index];
    const rightIdentifier = right[index];

    if (leftIdentifier === undefined) {
      return -1;
    }
    if (rightIdentifier === undefined) {
      return 1;
    }
    if (leftIdentifier === rightIdentifier) {
      continue;
    }

    const leftIsNumber = /^\d+$/.test(leftIdentifier);
    const rightIsNumber = /^\d+$/.test(rightIdentifier);

    if (leftIsNumber && rightIsNumber) {
      return Number(leftIdentifier) < Number(rightIdentifier) ? -1 : 1;
    }
    if (leftIsNumber) {
      return -1;
    }
    if (rightIsNumber) {
      return 1;
    }

    return leftIdentifier < rightIdentifier ? -1 : 1;
  }

  return 0;
}

export function compareVersions(leftVersion, rightVersion) {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);

  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) {
      return left[key] < right[key] ? -1 : 1;
    }
  }

  return comparePrerelease(left.prerelease, right.prerelease);
}

export function determineRelease(previousVersion, currentVersion) {
  parseVersion(previousVersion);
  parseVersion(currentVersion);

  const result = {
    changed: previousVersion !== currentVersion,
    version: currentVersion,
    tag: `v${currentVersion}`,
  };

  if (result.changed && compareVersions(previousVersion, currentVersion) >= 0) {
    throw new Error(
      `Package version ${currentVersion} must be greater than ${previousVersion}`,
    );
  }

  return result;
}

async function run() {
  const beforeSha = process.env.BEFORE_SHA;
  if (!beforeSha || /^0+$/.test(beforeSha)) {
    throw new Error("BEFORE_SHA must point to the previous main commit");
  }

  const currentPackage = JSON.parse(await readFile("package.json", "utf8"));
  const previousPackage = JSON.parse(
    execFileSync("git", ["show", `${beforeSha}:package.json`], {
      encoding: "utf8",
    }),
  );
  const release = determineRelease(
    previousPackage.version,
    currentPackage.version,
  );
  const output = [
    `changed=${String(release.changed)}`,
    `version=${release.version}`,
    `tag=${release.tag}`,
    `previous=${previousPackage.version}`,
  ].join("\n");

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${output}\n`, "utf8");
  } else {
    console.log(output);
  }

  if (release.changed) {
    console.log(
      `Package version increased from ${previousPackage.version} to ${release.version}`,
    );
  } else {
    console.log(`Package version remains ${release.version}; release skipped`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
