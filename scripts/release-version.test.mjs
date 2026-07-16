import assert from "node:assert/strict";
import test from "node:test";
import {
  compareVersions,
  determineRelease,
  parseVersion,
} from "./release-version.mjs";

test("does not create a release when package version is unchanged", () => {
  assert.deepEqual(determineRelease("0.1.7", "0.1.7"), {
    changed: false,
    version: "0.1.7",
    tag: "v0.1.7",
  });
});

test("creates a release tag when package version increases", () => {
  assert.deepEqual(determineRelease("0.1.7", "0.1.8"), {
    changed: true,
    version: "0.1.8",
    tag: "v0.1.8",
  });
});

test("rejects a version downgrade", () => {
  assert.throws(
    () => determineRelease("0.2.0", "0.1.9"),
    /must be greater than/,
  );
});

test("supports SemVer prerelease ordering", () => {
  assert.equal(compareVersions("1.0.0-beta.2", "1.0.0-beta.11"), -1);
  assert.equal(compareVersions("1.0.0-rc.1", "1.0.0"), -1);
});

test("rejects invalid package versions", () => {
  assert.throws(() => parseVersion("v1.0.0"), /valid SemVer/);
  assert.throws(() => parseVersion("1.0"), /valid SemVer/);
  assert.throws(() => parseVersion("01.0.0"), /valid SemVer/);
});
