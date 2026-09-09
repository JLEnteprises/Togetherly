const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();

function fail(message) {
  console.error(`\nRuntime Discovery Repair FAILED: ${message}`);
  process.exit(1);
}

function full(rel) {
  return path.join(root, ...rel.split('/'));
}

function read(rel) {
  const file = full(rel);
  if (!fs.existsSync(file)) fail(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function write(rel, source) {
  fs.writeFileSync(full(rel), source.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}

function runNpm(args, label) {
  console.log(`\n> ${label}`);
  let result;
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const command = ['npm.cmd', ...args].join(' ');
    result = spawnSync(comspec, ['/d', '/s', '/c', command], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: false,
    });
  } else {
    result = spawnSync('npm', args, { cwd: root, stdio: 'inherit' });
  }
  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with code ${result.status}.`);
}

// 1) Make Windows PowerShell write runtime-config.json without UTF-8 BOM.
{
  const rel = 'scripts/start-togetherly-tunnel.ps1';
  let source = read(rel);

  const oldLine = "$config | ConvertTo-Json | Set-Content -Path (Join-Path $RepoRoot 'runtime-config.json') -Encoding utf8";
  const newBlock = [
    "$runtimeConfigPath = Join-Path $RepoRoot 'runtime-config.json'",
    "$runtimeConfigJson = $config | ConvertTo-Json",
    "$utf8NoBom = New-Object System.Text.UTF8Encoding($false)",
    "[System.IO.File]::WriteAllText($runtimeConfigPath, $runtimeConfigJson + [Environment]::NewLine, $utf8NoBom)"
  ].join('\n');

  if (source.includes(newBlock)) {
    console.log('No-BOM PowerShell writer already present.');
  } else if (source.includes(oldLine)) {
    source = source.replace(oldLine, newBlock);
    write(rel, source);
  } else {
    fail('Could not find the expected runtime-config Set-Content line.');
  }
}

// 2) Make client parsing defensive and invalidate stale cached tunnel URL.
{
  const rel = 'src/services/backend/runtimeConfig.ts';
  let source = read(rel);

  source = source.replace(
    "const CACHE_KEY = 'togetherly.runtime-api-url.v1';",
    "const CACHE_KEY = 'togetherly.runtime-api-url.v2';"
  );

  const oldParse = "const payload = await response.json() as { apiUrl?: unknown };";
  const newParse = [
    "const raw = await response.text();",
    "const payload = JSON.parse(raw.replace(/^\\uFEFF/, '')) as { apiUrl?: unknown };"
  ].join('\n      ');

  if (source.includes(oldParse)) {
    source = source.replace(oldParse, newParse);
  }

  if (!source.includes("const CACHE_KEY = 'togetherly.runtime-api-url.v2';")) {
    fail('Could not update the runtime API cache key.');
  }
  if (!source.includes("raw.replace(/^\\uFEFF/, '')")) {
    fail('Could not install BOM-safe runtime config parsing.');
  }

  write(rel, source);
}

// 3) Clean the current runtime-config.json locally right now if it exists.
{
  const rel = 'runtime-config.json';
  const file = full(rel);
  if (fs.existsSync(file)) {
    let raw = fs.readFileSync(file, 'utf8');
    raw = raw.replace(/^\uFEFF/, '');
    try {
      const parsed = JSON.parse(raw);
      const clean = JSON.stringify(parsed, null, 2) + '\n';
      fs.writeFileSync(file, clean, { encoding: 'utf8' });
      console.log('Rewrote runtime-config.json as UTF-8 without BOM.');
    } catch (error) {
      fail(`runtime-config.json is not valid JSON: ${error.message}`);
    }
  }
}

console.log('\nRuntime discovery source audit clean.');

runNpm(['run', 'typecheck'], 'Frontend typecheck');
runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\nRuntime Discovery BOM Repair completed successfully.');
console.log('NEXT: close the current tunnel windows and run your fixed server+tunnel BAT again.');
console.log('That next launcher run will push a BOM-free runtime-config.json to GitHub.');
console.log('Then force-close and reopen Togetherly on the iPhone.');
