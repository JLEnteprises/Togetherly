const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const rel = 'src/app/features/activities.tsx';
const file = path.join(root, ...rel.split('/'));

function fail(message) {
  console.error(`\nD6 Date Matches FAILED: ${message}`);
  process.exit(1);
}

function read() {
  if (!fs.existsSync(file)) fail(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function write(text) {
  fs.writeFileSync(file, text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}

function replaceOnce(text, oldText, newText, label) {
  if (text.includes(newText)) {
    console.log(`Already good: ${label}`);
    return text;
  }
  const first = text.indexOf(oldText);
  if (first < 0) fail(`Could not find expected D5 source for: ${label}`);
  if (text.indexOf(oldText, first + oldText.length) >= 0) fail(`Multiple matches found for: ${label}`);
  return text.slice(0, first) + newText + text.slice(first + oldText.length);
}

let source = read();

if (!source.includes('export default function ActivitiesScreen()')) {
  fail('Date Ideas screen is not the expected Togetherly activities screen.');
}
if (!fs.existsSync(path.join(root, 'src', 'app', 'features', 'trip-detail.tsx'))) {
  fail('Trip Hub baseline is missing. Apply/checkpoint D5 before D6.');
}

const original = source;

source = replaceOnce(
  source,
  "type Filter = 'all' | 'want_to_do' | 'planned' | 'favourite' | 'completed';",
  "type Filter = 'all' | 'matches' | 'want_to_do' | 'planned' | 'favourite' | 'completed';",
  'Matches filter type'
);

source = replaceOnce(
  source,
  "function durationLabel(minutes: number | null) { if (!minutes) return 'Flexible'; if (minutes < 60) return `${minutes} min`; const hours = minutes / 60; return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`; }\n",
  "function durationLabel(minutes: number | null) { if (!minutes) return 'Flexible'; if (minutes < 60) return `${minutes} min`; const hours = minutes / 60; return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`; }\nfunction planActivityHref(activity: CoupleActivity) { return `/features/calendar?prefillTitle=${encodeURIComponent(activity.title)}&prefillDescription=${encodeURIComponent(activity.description ?? '')}&prefillDuration=${activity.duration_minutes ?? 120}&sourceActivityId=${encodeURIComponent(activity.id)}`; }\n",
  'shared Plan this helper'
);

const oldVisible = "  const visible = useMemo(() => activities.filter((activity) => filter === 'all' || (filter === 'favourite' ? activity.is_favourite : activity.status === filter)), [activities, filter]);";
const newVisible = `  const visible = useMemo(() => activities.filter((activity) => {
    if (filter === 'all') return true;
    if (filter === 'matches') return profile && partnerProfile
      ? Boolean(activity.interests?.[profile.id]) && Boolean(activity.interests?.[partnerProfile.id])
      : false;
    return filter === 'favourite' ? activity.is_favourite : activity.status === filter;
  }), [activities, filter, profile, partnerProfile]);
  const mutualMatches = useMemo(() => {
    if (!profile || !partnerProfile) return [];
    return activities
      .filter((activity) => Boolean(activity.interests?.[profile.id]) && Boolean(activity.interests?.[partnerProfile.id]))
      .filter((activity) => activity.status !== 'completed' && activity.status !== 'skip')
      .sort((a, b) => Number(Boolean(b.is_favourite)) - Number(Boolean(a.is_favourite)) || a.title.localeCompare(b.title));
  }, [activities, profile, partnerProfile]);`;
source = replaceOnce(source, oldVisible, newVisible, 'mutual match derivation');

const interestStart = source.indexOf('  async function toggleInterest(activity: CoupleActivity)');
const favouriteStart = source.indexOf('  async function toggleFavourite(activity: CoupleActivity)', interestStart);
if (interestStart < 0 || favouriteStart < 0) fail('Could not locate interest action block.');

const newInterest = `  async function toggleInterest(activity: CoupleActivity) {
    if (!profile) return;
    const current = Boolean(activity.interests?.[profile.id]);
    const partnerAlreadyInterested = partnerProfile ? Boolean(activity.interests?.[partnerProfile.id]) : false;
    try {
      await setActivityInterest(activity.id, !current);
      await refresh();
      if (!current && partnerAlreadyInterested) {
        const partnerName = partnerProfile?.display_name || 'your partner';
        Alert.alert(
          'It’s a match ❤️',
          \`You and \${partnerName} both want to do “\${activity.title}”.\`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Plan it', onPress: () => router.push(planActivityHref(activity) as never) },
          ],
        );
      }
    } catch (error) {
      Alert.alert('Couldn’t update interest', messageFrom(error));
    }
  }
`;
source = source.slice(0, interestStart) + newInterest + source.slice(favouriteStart);

const filterMarker = "    <View style={{ marginBottom: theme.spacing.xl }}><ChoiceChips value={filter} onChange={setFilter}";
const filterIndex = source.indexOf(filterMarker);
if (filterIndex < 0) fail('Could not locate Date Ideas filters.');

const matchHero = `    {mutualMatches.length ? <Card tone="accent" participantColor="both" style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg, padding: theme.spacing.xl }}>
      <AppText variant="caption" tone="accent">YOU BOTH PICKED THIS ❤️</AppText>
      <AppText variant="hero">{mutualMatches[0].title}</AppText>
      <AppText tone="secondary">{mutualMatches.length === 1 ? \`You and \${partnerProfile?.display_name || 'your partner'} matched on this date idea.\` : \`You have \${mutualMatches.length} date ideas you both want.\`}</AppText>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}><AppButton compact icon="heart" label="Plan this date" onPress={() => router.push(planActivityHref(mutualMatches[0]) as never)} /></View>
        <View style={{ flex: 1 }}><AppButton compact variant="secondary" label={mutualMatches.length === 1 ? 'See the idea' : \`See all \${mutualMatches.length}\`} onPress={() => mutualMatches.length === 1 ? setViewTarget(mutualMatches[0]) : setFilter('matches')} /></View>
      </View>
    </Card> : null}

`;
if (!source.includes('YOU BOTH PICKED THIS ❤️')) {
  source = source.slice(0, filterIndex) + matchHero + source.slice(filterIndex);
} else {
  console.log('Already good: mutual match hero');
}

source = source.replace(
  "{ value: 'all', label: 'All' }, { value: 'want_to_do', label: 'Want to do' }",
  "{ value: 'all', label: 'All' }, { value: 'matches', label: 'Matches ❤️' }, { value: 'want_to_do', label: 'Want to do' }"
);

source = source.replace(
  "const statusText = myInterest && partnerInterest ? 'Both of you want this' : myInterest ?",
  "const statusText = myInterest && partnerInterest ? 'Both want this ❤️' : myInterest ?"
);

const oldPlanPress = "onPress={() => router.push(`/features/calendar?prefillTitle=${encodeURIComponent(activity.title)}&prefillDescription=${encodeURIComponent(activity.description ?? '')}&prefillDuration=${activity.duration_minutes ?? 120}&sourceActivityId=${encodeURIComponent(activity.id)}` as never)}";
source = source.replace(oldPlanPress, "onPress={() => router.push(planActivityHref(activity) as never)}");

source = source.replace(
  "<AppText variant=\"caption\" tone={myInterest && partnerInterest ? 'success' : 'secondary'}>{statusText.toUpperCase()}</AppText>",
  "<AppText variant=\"caption\" tone={myInterest && partnerInterest ? 'success' : 'secondary'}>{statusText.toUpperCase()}</AppText>{myInterest && partnerInterest ? <TagChip label=\"❤️ MATCH\" /> : null}"
);

if (source === original) {
  console.log('D6 source was already applied; no source change needed.');
} else {
  write(source);
}

const finalSource = read();
const required = [
  "type Filter = 'all' | 'matches'",
  'const mutualMatches = useMemo',
  'YOU BOTH PICKED THIS ❤️',
  "label: 'Matches ❤️'",
  "Alert.alert(\n          'It’s a match ❤️'",
  'planActivityHref(activity)',
];
for (const marker of required) {
  if (!finalSource.includes(marker)) fail(`Post-apply audit missing marker: ${marker}`);
}
console.log('D6 Date Matches audit clean.');

function run(args, label) {
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

run(['run', 'typecheck'], 'Frontend typecheck');
run(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
run(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\nD6 Date Matches applied successfully.');
console.log('All requested validation checks passed.');
