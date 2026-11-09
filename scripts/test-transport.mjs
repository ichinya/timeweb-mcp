import { mkdir, mkdtemp, realpath, lstat, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { build } from 'tsdown';

const root = fileURLToPath(new URL('..', import.meta.url));
const entry = path.join(root, 'tests/transport.test.ts');
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const options = { ...parsed.options, rootDir: root, noEmit: true, declaration: false, declarationMap: false, moduleResolution: ts.ModuleResolutionKind.Bundler };
const program = ts.createProgram([entry], options);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => root, getCanonicalFileName: f => f, getNewLine: () => '\n' }));
  process.exitCode = 1;
} else {
  const cache = path.join(root, 'node_modules/.cache');
  await mkdir(cache, { recursive: true });
  const cacheReal = await realpath(cache);
  const workspaceReal = await realpath(root);
  const relativeCache = path.relative(workspaceReal, cacheReal);
  if (relativeCache.startsWith('..') || path.isAbsolute(relativeCache) || (await lstat(cache)).isSymbolicLink()) throw new Error('Test cache must stay inside checkout');
  const temp = await mkdtemp(path.join(cacheReal, 'timeweb-mcp-transport-'));
  try {
    await build({ config: false, tsconfig: false, entry: [entry.replaceAll('\\', '/')], outDir: temp, clean: true,
      format: ['esm'], platform: 'node', target: 'node20.0.0', dts: false, sourcemap: false,
      external: id => id.startsWith('node:') || id === 'axios' || id === 'zod' || id.startsWith('@modelcontextprotocol/') });
    const exit = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--test', path.join(temp, 'transport.test.js')], {
        cwd: root, stdio: 'inherit', windowsHide: true,
        env: { ...process.env, TIMEWEB_TOKEN: '', TIMEWEB_TEST_ROOT: root },
      });
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve(signal ? 1 : code ?? 1));
    });
    process.exitCode = Number(exit);
  } finally {
    // The only recursive removal target is this runner's fresh, verified directory.
    const target = await realpath(temp);
    if (path.dirname(target) !== cacheReal || !path.basename(target).startsWith('timeweb-mcp-transport-') || (await lstat(temp)).isSymbolicLink()) {
      throw new Error('Unsafe test cleanup target');
    }
    await rm(temp, { recursive: true, force: true });
  }
}
