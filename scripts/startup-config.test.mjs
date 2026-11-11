import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm, realpath, lstat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readStartupTimeout, timeoutVariable } from "./startup-config.mjs";

const secret = "DO_NOT_EMIT_TIMEOUT_INPUT";
const invalid = ["", " ", " 1000", "1000 ", "+1000", "-1000", "1.5", "1e4", "0x2710",
  "1000\n", "1000\r", "1000\t", "１０００", "١٠٠٠", "0", "999", "30001", "Infinity", "NaN", "9".repeat(400), secret];

test("timeout parsing preserves default and accepts only bounded ASCII decimal integers", () => {
  assert.deepEqual(readStartupTimeout(undefined), { timeoutMs: 5000 });
  for (const [value, timeoutMs] of [["1000",1000],["10000",10000],["30000",30000],["0001000",1000]]) {
    assert.deepEqual(readStartupTimeout(value), { timeoutMs });
  }
  for (const value of [...invalid, null, 10000, {}, []]) {
    const result = readStartupTimeout(value);
    assert.deepEqual(result, { status: "configuration_error", variable: timeoutVariable,
      message: "Expected an ASCII decimal integer from 1000 to 30000 milliseconds." });
    assert.ok(!JSON.stringify(result).includes(secret));
  }
});

async function fixture(run, { noisy = false } = {}) {
  const tempRoot = await realpath(tmpdir());
  const root = await mkdtemp(path.join(tempRoot, "timeweb-smoke-cli-"));
  try {
    await mkdir(path.join(root,"scripts"));
    await mkdir(path.join(root,"dist"));
    await writeFile(path.join(root,"package.json"), JSON.stringify({ type: "module" }));
    for (const name of ["smoke-start.mjs","smoke-start-series.mjs","startup-probe.mjs","startup-config.mjs"]) {
      await copyFile(new URL(name,import.meta.url),path.join(root,"scripts",name));
    }
    await writeFile(path.join(root,"dist","index.js"), `import fs from 'node:fs';
const file=new URL('../launches.log',import.meta.url);fs.appendFileSync(file,'started\\n');
${noisy ? "if(fs.readFileSync(file,'utf8').split('\\n').length===2)process.stdout.write('fixture-noise');" : ""}
process.stderr.write('Timeweb MCP server started');setInterval(()=>{},1000);`);
    await run(root);
  } finally {
    // Only remove this fixture's fresh, resolved directory under the system temp root.
    const resolved = await realpath(root);
    assert.equal(path.dirname(resolved), tempRoot);
    assert.ok(path.basename(resolved).startsWith("timeweb-smoke-cli-"));
    assert.equal((await lstat(root)).isSymbolicLink(), false);
    await rm(resolved,{ recursive:true, force:true });
  }
}
function cli(root, name, value) {
  return new Promise((resolve,reject) => {
    const env={ ...process.env, TIMEWEB_TOKEN:"" };
    delete env[timeoutVariable];
    if(value!==undefined)env[timeoutVariable]=value;
    const child=spawn(process.execPath,[path.join(root,"scripts",name)],{cwd:root,env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
    let stdout="",stderr="";
    const timer=setTimeout(()=>{child.kill("SIGKILL");reject(new Error("Fixture CLI did not terminate"));},15000);
    child.stdout.on("data",b=>stdout+=b);
    child.stderr.on("data",b=>stderr+=b);
    child.once("error",e=>{clearTimeout(timer);reject(e);});
    child.once("close",code=>{clearTimeout(timer);resolve({code,stdout,stderr});});
  });
}
async function launches(root) {
  try { return (await readFile(path.join(root,"launches.log"),"utf8")).trim().split("\n").length; }
  catch(error) { if(error.code==="ENOENT")return 0;throw error; }
}
for(const name of ["smoke-start.mjs","smoke-start-series.mjs"]) {
  test(`${name} uses default and explicit timeout in real child invocations`, async () => {
    await fixture(async root=>{
      for(const [value,expected] of [[undefined,5000],["10000",10000]]) {
        const before=await launches(root);
        const result=await cli(root,name,value);
        assert.equal(result.code,0,result.stderr);
        assert.equal(result.stderr,"");
        const lines=result.stdout.trim().split("\n");
        const series=name==="smoke-start-series.mjs";
        if(series)assert.equal(JSON.parse(lines.shift()).timeoutMs,expected);
        assert.equal(lines.length,series?6:1);
        for(const line of lines){const entry=JSON.parse(line.slice(line.indexOf("{")));assert.equal(entry.status,"ready");assert.equal(entry.timeoutMs,expected);assert.equal(entry.cleanupMs,1000);}
        assert.equal(await launches(root)-before,series?6:1);
      }
    });
  });
  test(`${name} rejects invalid config once without starting its fixture server`, async () => {
    await fixture(async root=>{
      for(const value of ["",secret,"999","30001"]) {
        const result=await cli(root,name,value);
        assert.equal(result.code,1);
        assert.equal(result.stdout,"");
        assert.equal(result.stderr.trim().split("\n").length,1);
        assert.deepEqual(JSON.parse(result.stderr),readStartupTimeout(value));
        assert.ok(!result.stderr.includes(secret));
        assert.equal(await launches(root),0);
      }
      // In series mode this also proves configuration is checked before readFile(dist).
      await unlink(path.join(root,"dist","index.js"));
      const missing=await cli(root,name,secret);
      assert.equal(missing.code,1);
      assert.deepEqual(JSON.parse(missing.stderr),readStartupTimeout(secret));
      assert.equal(missing.stdout,"");
    });
  });
}
test("series preserves a nonzero outcome when one child pollutes stdout and later children pass", async () => {
  await fixture(async root=>{
    const result=await cli(root,"smoke-start-series.mjs","10000");
    assert.equal(result.code,1);
    assert.equal(await launches(root),6);
    assert.ok(!result.stderr.includes("fixture-noise"));
    const failure=JSON.parse(result.stderr.trim().slice(result.stderr.indexOf("{")));
    assert.equal(failure.status,"stdout_noise");
    assert.equal(failure.timeoutMs,10000);
    assert.equal(result.stdout.trim().split("\n").length,6); // metadata + five successes
  },{noisy:true});
});
