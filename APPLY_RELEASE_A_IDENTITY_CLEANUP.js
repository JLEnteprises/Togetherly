const fs = require('fs');
const path = require('path');

const project = process.cwd();

function full(rel) { return path.join(project, rel); }
function read(rel) {
  if (!fs.existsSync(full(rel))) throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(full(rel), 'utf8').replace(/\r\n/g, '\n');
}
function write(rel, text) {
  fs.writeFileSync(full(rel), text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Patched ${rel}`);
}

// 1) Draw Together: arbitrary #RRGGBB participant colours must resolve through
// participantPalettes. Only "both" is non-person-specific.
{
  const rel = 'src/app/features/games/[id].tsx';
  let text = read(rel);

  const oldExact = `colorForUser={(userId) => { const color = colorForUser(userId); return color === 'purple' || color === 'green' ? participantPalettes[color].accent : theme.colors.textPrimary; }}`;
  const newExact = `colorForUser={(userId) => { const color = colorForUser(userId); return color === 'both' ? theme.colors.textPrimary : participantPalettes[color].accent; }}`;

  if (text.includes(oldExact)) {
    text = text.replace(oldExact, newExact);
  } else if (!text.includes(newExact)) {
    // Allow for the Release A type-widening pass having changed nearby text.
    const re = /colorForUser=\{\(userId\) => \{ const color = colorForUser\(userId\); return color === 'purple' \|\| color === 'green' \? participantPalettes\[color\]\.accent : theme\.colors\.textPrimary; \}\}/;
    if (!re.test(text)) throw new Error(`Could not safely find the legacy Draw Together colour resolver in ${rel}`);
    text = text.replace(re, newExact);
  } else {
    console.log(`Already patched ${rel}`);
  }

  write(rel, text);
}

// 2) Backdrop: use the actual couple identity pair only as very faint ambient
// hints. Generic UI remains neutral; no Purple/Green assumptions remain.
{
  const rel = 'src/components/common/CosmicBackdrop.tsx';
  let text = read(rel);

  text = text.replace("import { participantPalettes } from '@/theme/tokens';\n", '');

  text = text.replace(
    "  const purpleTransform = preferences.reduced_motion ? undefined : [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) }];",
    "  const firstOrbitTransform = preferences.reduced_motion ? undefined : [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) }];"
  );
  text = text.replace(
    "  const greenTransform = preferences.reduced_motion ? undefined : [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) }];",
    "  const secondOrbitTransform = preferences.reduced_motion ? undefined : [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) }];"
  );

  const replacements = [
    [
      `participantPalettes.purple.glow, top: -130, right: -105, opacity: gothic ? 0.6 : 1 }, purpleTransform ? { transform: purpleTransform } : null`,
      `theme.participants.me.glowSoft, top: -130, right: -105, opacity: gothic ? 0.5 : 0.72 }, firstOrbitTransform ? { transform: firstOrbitTransform } : null`
    ],
    [
      `participantPalettes.green.glow, top: 250, left: -125, opacity: cottage ? 1 : 0.8 }, greenTransform ? { transform: greenTransform } : null`,
      `theme.participants.partner.glowSoft, top: 250, left: -125, opacity: cottage ? 0.72 : 0.58 }, secondOrbitTransform ? { transform: secondOrbitTransform } : null`
    ],
    [
      `participantPalettes.purple.border, right: -92, top: 78`,
      `theme.participants.me.border, right: -92, top: 78`
    ],
    [
      `participantPalettes.green.border, left: -72, top: 420`,
      `theme.participants.partner.border, left: -72, top: 420`
    ],
    [
      `participantPalettes.green.border }]} /> : null`,
      `theme.colors.vineSoft }]} /> : null`
    ],
  ];

  for (const [oldText, newText] of replacements) {
    if (text.includes(oldText)) text = text.replace(oldText, newText);
  }

  if (/participantPalettes\.(purple|green)|purpleTransform|greenTransform/.test(text)) {
    throw new Error(`Legacy Purple/Green assumption still remains in ${rel}; refusing partial patch.`);
  }

  write(rel, text);
}

// Re-run the exact legacy identity scan used by Release A.
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

const warnings = [];
for (const absolute of walk(full('src'))) {
  const text = fs.readFileSync(absolute, 'utf8');
  if (/participantPalettes\.(purple|green)|===\s*['"](?:purple|green)['"]/.test(text)) {
    warnings.push(path.relative(project, absolute));
  }
}

const report = full('RELEASE_A_IDENTITY_REMAINING.txt');
if (warnings.length) {
  fs.writeFileSync(report, warnings.join('\r\n') + '\r\n', 'utf8');
  console.log(`Still found ${warnings.length} legacy identity file(s). See RELEASE_A_IDENTITY_REMAINING.txt`);
  process.exitCode = 2;
} else {
  if (fs.existsSync(report)) fs.unlinkSync(report);
  console.log('Identity audit clean: no hard-coded Purple/Green assumptions remain in src.');
}

console.log('');
console.log('Now run:');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
console.log('  npm.cmd run backend:migrate');
