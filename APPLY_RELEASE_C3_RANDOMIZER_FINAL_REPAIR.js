const fs = require('fs');
const path = require('path');

const rel = 'src/app/features/activity-randomizer.tsx';
const file = path.join(process.cwd(), rel);

if (!fs.existsSync(file)) {
  throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
}

let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

if (!text.includes('async function toggleFavourite()')) {
  throw new Error('Expected C3 toggleFavourite() helper is missing. Send activity-randomizer.tsx before making further changes.');
}
if (!text.includes('setActivityFavourite')) {
  throw new Error('Expected setActivityFavourite import is missing. Send activity-randomizer.tsx before making further changes.');
}

const lines = text.split('\n');
let changed = false;

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  if (
    line.includes('<AppButton') &&
    line.includes("pick.status === 'favourite'") &&
    line.includes("choose('favourite')")
  ) {
    const indent = line.match(/^\s*/)?.[0] ?? '';
    lines[i] =
      `${indent}<AppButton label={pick.is_favourite ? '★ Favourite' : '☆ Save as favourite'} variant="ghost" disabled={busy} onPress={toggleFavourite} />`;
    changed = true;
  }
}

text = lines.join('\n');

if (!changed) {
  if (
    text.includes("pick.is_favourite ? '★ Favourite' : '☆ Save as favourite'") &&
    text.includes('onPress={toggleFavourite}')
  ) {
    console.log(`${rel} already has the corrected favourite button.`);
  } else {
    throw new Error(
      'Could not find the stale favourite button. Send the lines around activity-randomizer.tsx line 122.'
    );
  }
} else {
  fs.writeFileSync(file, text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Repaired ${rel}`);
}

const verify = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const failures = [];
if (verify.includes("pick.status === 'favourite'")) failures.push("stale pick.status === 'favourite' remains");
if (verify.includes("choose('favourite')")) failures.push("stale choose('favourite') remains");
if (!verify.includes("pick.is_favourite ? '★ Favourite' : '☆ Save as favourite'")) failures.push('new favourite label missing');
if (!verify.includes('onPress={toggleFavourite}')) failures.push('toggleFavourite button handler missing');

if (failures.length) {
  fs.writeFileSync(
    path.join(process.cwd(), 'RELEASE_C3_RANDOMIZER_FINAL_AUDIT_REMAINING.txt'),
    failures.join('\r\n') + '\r\n',
    'utf8'
  );
  throw new Error('Final C3 randomizer audit failed. See RELEASE_C3_RANDOMIZER_FINAL_AUDIT_REMAINING.txt');
}

const report = path.join(process.cwd(), 'RELEASE_C3_RANDOMIZER_FINAL_AUDIT_REMAINING.txt');
if (fs.existsSync(report)) fs.unlinkSync(report);

console.log('C3 randomizer final audit clean.');
console.log('Now run: npm.cmd run typecheck');
