const fs = require('fs');
const path = require('path');

const project = 'C:\\Users\\Liam\\Downloads\\Togetherly-v1.14-Everywhere';
const rel = 'server\\src\\routes\\coreFeatures.ts';
const full = path.join(project, rel);

if (!fs.existsSync(full)) throw new Error(`Missing file: ${rel}`);

let text = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n');

const oldSql = `         WHERE id = $5 AND couple_id = $6 AND ($7::timestamptz IS NULL OR updated_at = $7::timestamptz) RETURNING *`;
const newSql = `         WHERE id = $5 AND couple_id = $6
           AND ($7::timestamptz IS NULL OR date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', $7::timestamptz))
         RETURNING *`;

if (text.includes(newSql)) {
  console.log('Shared-note timestamp hotfix is already applied.');
} else {
  if (!text.includes(oldSql)) {
    throw new Error('Could not find the shared-note optimistic-lock SQL safely.');
  }
  text = text.replace(oldSql, newSql);
  fs.writeFileSync(full, text.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Patched shared-note editing timestamp comparison.');
}

console.log('');
console.log('Run:');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd run typecheck');
