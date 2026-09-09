const fs = require('fs');
const path = require('path');

const rel = 'server/src/routes/watch.ts';
const file = path.join(process.cwd(), rel);

if (!fs.existsSync(file)) {
  throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
}

let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const broken = `  });
}  });
}`;

const fixed = `  });
}`;

if (text.includes(broken)) {
  text = text.replace(broken, fixed);
  fs.writeFileSync(file, text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Repaired ${rel}`);
} else if (text.trimEnd().endsWith(fixed)) {
  console.log(`${rel} already has the corrected ending.`);
} else {
  const lines = text.split('\n');
  const start = Math.max(0, lines.length - 20);
  const tail = lines.slice(start).map((line, i) => `${start + i + 1}: ${line}`).join('\n');
  fs.writeFileSync(
    path.join(process.cwd(), 'RELEASE_D1_WATCH_SYNTAX_REPAIR_TAIL.txt'),
    tail + '\r\n',
    'utf8'
  );
  throw new Error('Could not find the expected duplicated Watch route ending. See RELEASE_D1_WATCH_SYNTAX_REPAIR_TAIL.txt');
}

const verify = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
if (verify.includes('}  });')) {
  throw new Error('Watch route still contains the duplicated closing sequence.');
}
if (!verify.includes("app.post('/watch/acknowledge'")) {
  throw new Error('Watch acknowledge route is missing after repair.');
}
if (!verify.includes('mood_acknowledgements(mood_id,acknowledger_user_id)')) {
  throw new Error('Persistent Watch acknowledgement logic is missing after repair.');
}

const report = path.join(process.cwd(), 'RELEASE_D1_WATCH_SYNTAX_REPAIR_TAIL.txt');
if (fs.existsSync(report)) fs.unlinkSync(report);

console.log('D1 Watch syntax repair audit clean.');
console.log('Now run:');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
