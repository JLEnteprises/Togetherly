const fs = require('fs');
const path = require('path');

const project = process.cwd();
let ts;
try {
  ts = require(path.join(project, 'node_modules', 'typescript'));
} catch {
  throw new Error('TypeScript was not found in node_modules. Run npm.cmd install first, then rerun this repair.');
}

function full(rel) { return path.join(project, rel); }
function read(rel) {
  const p = full(rel);
  if (!fs.existsSync(p)) throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}
function write(rel, text) {
  fs.writeFileSync(full(rel), text.replace(/\n/g, '\r\n'), 'utf8');
}
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function ensureNamedImport(text, name, moduleName) {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`import\\s*\\{([\\s\\S]*?)\\}\\s*from\\s*['"]${escaped}['"];`);
  const match = text.match(re);
  if (match) {
    const names = match[1].split(',').map((x) => x.trim()).filter(Boolean);
    if (!names.includes(name)) {
      names.push(name);
      const replacement = `import { ${names.join(', ')} } from '${moduleName}';`;
      return text.replace(match[0], replacement);
    }
    return text;
  }

  // No named import from tokens existed. Add one after the last import.
  const importMatches = [...text.matchAll(/^import .*?;\s*$/gm)];
  const statement = `import { ${name} } from '${moduleName}';\n`;
  if (!importMatches.length) return statement + text;
  const last = importMatches[importMatches.length - 1];
  const insertAt = last.index + last[0].length;
  return text.slice(0, insertAt) + '\n' + statement + text.slice(insertAt);
}

function transformPaletteLookups(rel) {
  let text = read(rel);
  const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, kind);
  const replacements = [];
  let needsStandaloneHelper = false;

  function visit(node) {
    if (ts.isElementAccessExpression(node) && node.argumentExpression) {
      const arg = node.argumentExpression.getText(source);
      const expr = node.expression;

      // participantPalettes[color] -> participantPalette(color)
      if (ts.isIdentifier(expr) && expr.text === 'participantPalettes') {
        replacements.push({
          start: node.getStart(source),
          end: node.getEnd(),
          replacement: `participantPalette(${arg})`,
        });
        needsStandaloneHelper = true;
      }

      // theme.participantPalettes[color] -> theme.participantPalette(color)
      if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'participantPalettes') {
        const owner = expr.expression.getText(source);
        replacements.push({
          start: node.getStart(source),
          end: node.getEnd(),
          replacement: `${owner}.participantPalette(${arg})`,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  if (!replacements.length) return false;

  // Apply from the end so source offsets remain valid.
  replacements.sort((a, b) => b.start - a.start);
  for (const item of replacements) {
    text = text.slice(0, item.start) + item.replacement + text.slice(item.end);
  }

  if (needsStandaloneHelper) {
    text = ensureNamedImport(text, 'participantPalette', '@/theme/tokens');
  }

  write(rel, text);
  console.log(`Repaired palette lookup typing in ${rel} (${replacements.length})`);
  return true;
}

// The dynamic participant palette is intentionally a function at the type-safe
// boundary. A Proxy remains only as a compatibility surface for any non-index use.
{
  const rel = 'src/theme/useAppTheme.ts';
  let text = read(rel);
  text = ensureNamedImport(text, 'participantPalette', './tokens');

  text = text.replace(
    '  const me = participantPalettes[myColor];',
    '  const me = participantPalette(myColor);'
  );
  text = text.replace(
    '  const partner = participantPalettes[partnerColor];',
    '  const partner = participantPalette(partnerColor);'
  );

  if (!text.includes('    participantPalette,\n')) {
    text = text.replace(
      '    participantPalettes,\n',
      '    participantPalettes,\n    participantPalette,\n'
    );
  }

  write(rel, text);
  console.log('Made useAppTheme participant palettes definite.');
}

// Transform every TS/TSX source lookup. This is intentionally AST-based so
// nested expressions such as participantPalettes[colorForUser(id)] are safe.
const files = walk(full('src')).map((p) => path.relative(project, p).replace(/\\/g, '/'));
let changed = 0;
for (const rel of files) {
  if (rel === 'src/theme/useAppTheme.ts') continue;
  if (transformPaletteLookups(rel)) changed += 1;
}

// The theme file may still contain a direct lookup if a locally modified version
// differed from the expected exact strings. Run the same AST pass on it too.
if (transformPaletteLookups('src/theme/useAppTheme.ts')) changed += 1;

// Verify there are no unsafe dynamic index lookups left.
const remaining = [];
for (const rel of files) {
  const text = read(rel);
  if (/participantPalettes\s*\[|\.participantPalettes\s*\[/.test(text)) remaining.push(rel);
}
if (remaining.length) {
  fs.writeFileSync(full('RELEASE_A_PALETTE_LOOKUP_REMAINING.txt'), remaining.join('\r\n') + '\r\n', 'utf8');
  console.error(`Found ${remaining.length} unsafe palette lookup file(s). See RELEASE_A_PALETTE_LOOKUP_REMAINING.txt`);
  process.exitCode = 2;
} else {
  const report = full('RELEASE_A_PALETTE_LOOKUP_REMAINING.txt');
  if (fs.existsSync(report)) fs.unlinkSync(report);
  console.log('Palette lookup audit clean.');
}

console.log('');
console.log(`Updated ${changed} source file(s).`);
console.log('Now run:');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
console.log('  npm.cmd run backend:migrate');
