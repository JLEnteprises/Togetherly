const fs = require('fs');
const path = require('path');

const project = 'C:\\Users\\Liam\\Downloads\\Togetherly-v1.14-Everywhere';
const rel = 'src\\app\\features\\trip-detail.tsx';
const full = path.join(project, rel);

if (!fs.existsSync(full)) {
  throw new Error(`Missing file: ${rel}`);
}

let text = fs.readFileSync(full, 'utf8');

const broken = `async function createTripCountdown() { if (links.some((item) => item.entity_type === 'countdown')) { Alert.alert('Countdown already linked', 'Open the linked countdown below if you want to change it.'); return; } if (!trip?.start_date || !id) { Alert.alert('Add trip dates first', 'Set a start date before creating a trip countdown.'); return; } setBusy(true); try { const targetAt = targetIso(trip.start_date); const now = new Date().toISOString(); const countdown = await createCountdown({ title: \`${'${'}trip.title} begins\`, targetAt, startAt: new Date(now).getTime() < new Date(targetAt).getTime() ? now : null, type: 'visit' }); await linkTripItem(id, 'countdown', countdown.id); await refresh(); } catch (error) { Alert.alert('Could not create countdown', messageFrom(error)); } finally { setBusy(false); } } catch (error) { Alert.alert('Couldn’t create countdown', messageFrom(error)); } finally { setBusy(false); } }`;

const fixed = `async function createTripCountdown() { if (links.some((item) => item.entity_type === 'countdown')) { Alert.alert('Countdown already linked', 'Open the linked countdown below if you want to change it.'); return; } if (!trip?.start_date || !id) { Alert.alert('Add trip dates first', 'Set a start date before creating a trip countdown.'); return; } setBusy(true); try { const targetAt = targetIso(trip.start_date); const now = new Date().toISOString(); const countdown = await createCountdown({ title: \`${'${'}trip.title} begins\`, targetAt, startAt: new Date(now).getTime() < new Date(targetAt).getTime() ? now : null, type: 'visit' }); await linkTripItem(id, 'countdown', countdown.id); await refresh(); } catch (error) { Alert.alert('Could not create countdown', messageFrom(error)); } finally { setBusy(false); } }`;

if (text.includes(broken)) {
  text = text.replace(broken, fixed);
  fs.writeFileSync(full, text, 'utf8');
  console.log('Repaired trip-detail.tsx duplicate catch/finally block.');
} else if (text.includes(fixed) && !text.includes("} catch (error) { Alert.alert('Couldn’t create countdown'")) {
  console.log('trip-detail.tsx already repaired.');
} else {
  // Fallback for Unicode/apostrophe variations: remove one duplicate trailing catch/finally
  const rx = /(async function createTripCountdown\(\)[\s\S]*?finally \{ setBusy\(false\); \} \})\s*catch \(error\) \{ Alert\.alert\('Couldn[^']*create countdown', messageFrom\(error\)\); \} finally \{ setBusy\(false\); \} \}/;
  if (rx.test(text)) {
    text = text.replace(rx, '$1');
    fs.writeFileSync(full, text, 'utf8');
    console.log('Repaired trip-detail.tsx duplicate catch/finally block (fallback match).');
  } else {
    throw new Error('Could not find the malformed createTripCountdown function safely.');
  }
}

console.log('');
console.log('Now run:');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
