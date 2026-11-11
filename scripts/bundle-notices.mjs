import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// Bundling redistributes dependency code, so ship its original notices too.
export function bundleNotices() {
  return {
    name: "bundle-notices",
    async generateBundle(_options, bundle) {
      const packages = new Map();
      const visited = new Set();
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        for (const id of Object.keys(chunk.modules)) {
          if (!id.replaceAll("\\", "/").includes("/node_modules/")) continue;
          let directory = path.dirname(id);
          while (!visited.has(directory)) {
            visited.add(directory);
            let pkg;
            try {
              pkg = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
            } catch (error) {
              if (error.code !== "ENOENT") throw error;
            }
            if (pkg?.name && pkg?.version) {
              packages.set(directory, pkg);
              break;
            }
            const parent = path.dirname(directory);
            if (parent === directory) throw new Error(`Cannot locate package for ${id}`);
            directory = parent;
          }
        }
      }
      const sections = [];
      for (const [directory, pkg] of [...packages].sort((a, b) => a[1].name.localeCompare(b[1].name))) {
        const names = await readdir(directory);
        const files = names
          .filter(name => /^(?:licen[cs]e|copying|notice)(?:[.-]|$)/i.test(name)).sort();
        // Some published packages (e.g. agent-base 6) put their license in README.
        if (!files.length) {
          const readme = names.find(name => /^readme(?:\.|$)/i.test(name));
          if (readme && /copyright/i.test(await readFile(path.join(directory, readme), "utf8"))) files.push(readme);
        }
        if (!files.length) throw new Error(`Missing bundled license: ${pkg.name}`);
        sections.push(`${pkg.name}@${pkg.version} (${pkg.license ?? "see below"})`);
        for (const file of files) {
          sections.push(`--- ${file} ---\n${await readFile(path.join(directory, file), "utf8")}`);
        }
      }
      this.emitFile({ type: "asset", fileName: "THIRD_PARTY_NOTICES.txt",
        source: `Third-party code included in this distribution\n\n${sections.join("\n\n")}\n` });
    },
  };
}
