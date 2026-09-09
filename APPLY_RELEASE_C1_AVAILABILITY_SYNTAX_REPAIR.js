const fs = require('fs');
const path = require('path');

const rel = 'server/src/routes/availability.ts';
const file = path.join(process.cwd(), rel);

if (!fs.existsSync(file)) {
  throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
}

let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const duplicated = `function overlaps(a: Array<{ start: Date; end: Date }>, b: Array<{ start: Date; end: Date }>, minMinutes: number) {function overlaps(a: Array<{ start: Date; end: Date }>, b: Array<{ start: Date; end: Date }>, minMinutes: number) {`;
const correct = `function overlaps(a: Array<{ start: Date; end: Date }>, b: Array<{ start: Date; end: Date }>, minMinutes: number) {`;

if (text.includes(duplicated)) {
  text = text.replace(duplicated, correct);
  fs.writeFileSync(file, text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Repaired ${rel}`);
} else if (text.includes(correct)) {
  console.log(`${rel} already has a single overlaps() declaration.`);
} else {
  throw new Error('Could not find the expected overlaps() declaration. Send the surrounding availability.ts lines before making further changes.');
}

const verify = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const count = (verify.match(/function overlaps\(a: Array<\{ start: Date; end: Date \}>, b: Array<\{ start: Date; end: Date \}>, minMinutes: number\) \{/g) || []).length;

if (count !== 1) {
  throw new Error(`Expected exactly one overlaps() declaration after repair, found ${count}.`);
}

console.log('C1 availability syntax repair clean.');
console.log('Now rerun:');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
