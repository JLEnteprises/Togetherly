const fs = require('fs');
const path = require('path');

const project = process.cwd();
function file(rel) { return path.join(project, rel); }
function read(rel) {
  if (!fs.existsSync(file(rel))) throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(file(rel), 'utf8').replace(/\r\n/g, '\n');
}
function write(rel, text) {
  fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
  fs.writeFileSync(file(rel), text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}
function replaceAllSafe(rel, pairs) {
  let text = read(rel);
  let changed = false;
  for (const [oldText, newText, label] of pairs) {
    if (text.includes(newText)) {
      console.log(`Already patched ${rel}: ${label}`);
      continue;
    }
    if (!text.includes(oldText)) throw new Error(`Could not safely patch ${rel}: ${label}`);
    text = text.replace(oldText, newText);
    changed = true;
  }
  if (changed) write(rel, text);
}
function ensureImport(rel, statement, anchor) {
  let text = read(rel);
  if (text.includes(statement)) return;
  if (!text.includes(anchor)) throw new Error(`Could not add import to ${rel}`);
  text = text.replace(anchor, `${anchor}\n${statement}`);
  write(rel, text);
}

// New reusable identity badge.
write('src/components/common/ParticipantIdentityBadge.tsx', "import { View } from 'react-native';\nimport { useWorkspace } from '@/providers/WorkspaceProvider';\nimport { participantPalette } from '@/theme/tokens';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport { Avatar } from './Avatar';\nimport { AppText } from './AppText';\n\nfunction initial(value: string | undefined, fallback: string) {\n  const trimmed = value?.trim();\n  return trimmed ? trimmed.slice(0, 1).toUpperCase() : fallback;\n}\n\nexport function ParticipantIdentityBadge({\n  userId,\n  both = false,\n  detail,\n  compact = true,\n}: {\n  userId?: string | null;\n  both?: boolean;\n  detail?: string;\n  compact?: boolean;\n}) {\n  const theme = useAppTheme();\n  const { profile, partnerProfile, myColor, partnerColor, colorForUser } = useWorkspace();\n  const size = compact ? 22 : 28;\n\n  if (both) {\n    const meName = profile?.display_name ?? 'You';\n    const partnerName = partnerProfile?.display_name ?? 'Partner';\n    return (\n      <View\n        accessibilityLabel={`Us. ${meName} and ${partnerName}${detail ? `. ${detail}` : ''}`}\n        style={{\n          alignSelf: 'flex-start',\n          flexDirection: 'row',\n          alignItems: 'center',\n          gap: 7,\n          paddingHorizontal: 9,\n          paddingVertical: compact ? 5 : 7,\n          borderRadius: theme.radii.pill,\n          borderWidth: 1,\n          borderLeftWidth: 3,\n          borderRightWidth: 3,\n          borderLeftColor: participantPalette(myColor).accent,\n          borderRightColor: participantPalette(partnerColor).accent,\n          borderColor: theme.colors.border,\n          backgroundColor: theme.colors.elevatedBackground,\n        }}\n      >\n        <View style={{ width: size + 10, height: size, flexDirection: 'row', alignItems: 'center' }}>\n          <Avatar initials={initial(profile?.display_name, '?')} imageUrl={profile?.avatar_url} size={size} participantColor={myColor} />\n          <View style={{ marginLeft: -8 }}>\n            <Avatar initials={initial(partnerProfile?.display_name, '\u2661')} imageUrl={partnerProfile?.avatar_url} size={size} participantColor={partnerColor} />\n          </View>\n        </View>\n        <View style={{ gap: 1 }}>\n          <AppText variant=\"caption\" style={{ color: theme.colors.textPrimary }}>US \u00b7 {meName} + {partnerName}</AppText>\n          {detail ? <AppText variant=\"caption\" tone=\"muted\">{detail}</AppText> : null}\n        </View>\n      </View>\n    );\n  }\n\n  const color = colorForUser(userId);\n  if (color === 'both') return <ParticipantIdentityBadge both detail={detail} compact={compact} />;\n\n  const isMe = Boolean(profile && userId === profile.id);\n  const isPartner = Boolean(partnerProfile && userId === partnerProfile.id);\n  const person = isMe ? profile : isPartner ? partnerProfile : null;\n  const name = person?.display_name ?? 'Previous member';\n  const imageUrl = person?.avatar_url ?? null;\n  const role = isMe ? 'YOU' : isPartner ? 'PARTNER' : 'MEMBER';\n  const palette = participantPalette(color);\n\n  return (\n    <View\n      accessibilityLabel={`${role}. ${name}${detail ? `. ${detail}` : ''}`}\n      style={{\n        alignSelf: 'flex-start',\n        flexDirection: 'row',\n        alignItems: 'center',\n        gap: 7,\n        paddingHorizontal: 9,\n        paddingVertical: compact ? 5 : 7,\n        borderRadius: theme.radii.pill,\n        borderWidth: 1,\n        borderColor: palette.border,\n        backgroundColor: palette.tint,\n      }}\n    >\n      <Avatar initials={initial(name, '?')} imageUrl={imageUrl} size={size} participantColor={color} />\n      <View style={{ gap: 1 }}>\n        <AppText variant=\"caption\" style={{ color: palette.accent }}>{role} \u00b7 {name}</AppText>\n        {detail ? <AppText variant=\"caption\" tone=\"muted\">{detail}</AppText> : null}\n      </View>\n    </View>\n  );\n}\n");

// Make partner attribution just as explicit as "YOU".
replaceAllSafe('src/components/common/ParticipantAttribution.tsx', [[
  `  const isMe = Boolean(profile && userId === profile.id);`,
  `  const isMe = Boolean(profile && userId === profile.id);
  const isPartner = Boolean(partnerProfile && userId === partnerProfile.id);
  const role = isMe ? 'YOU' : isPartner ? 'PARTNER' : '';`,
  'derive explicit YOU / PARTNER role'
],[
  `{verb} {name}{isMe ? ' · YOU' : ''}{suffix ? \` · \${suffix}\` : ''}`,
  `{verb} {name}{role ? \` · \${role}\` : ''}{suffix ? \` · \${suffix}\` : ''}`,
  'show partner role in attribution'
]]);

// TASKS: the strong identity rail means responsibility, not who happened to create it.
ensureImport(
  'src/app/features/tasks.tsx',
  `import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';`,
  `import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';`,
);
replaceAllSafe('src/app/features/tasks.tsx', [[
  `const creatorColor = colorForUser(task.creator_id); const creatorPalette = creatorColor === 'both' ? null : participantPalette(creatorColor);
          const assignmentColor = task.assign_to_both ? 'both' : colorForUser(task.assignee_id);`,
  `const creatorColor = colorForUser(task.creator_id);
          const assignmentColor = task.assign_to_both ? 'both' : colorForUser(task.assignee_id);
          const assignmentPalette = assignmentColor === 'both' ? null : participantPalette(assignmentColor);`,
  'separate creator from assignment identity'
],[
  `<Card key={task.id} participantColor={creatorColor}`,
  `<Card key={task.id} participantColor={assignmentColor}`,
  'task rail follows assignment'
],[
  `borderColor: creatorPalette?.accent ?? theme.colors.textMuted, backgroundColor: done ? (creatorPalette?.accentSoft ?? theme.colors.elevatedBackground)`,
  `borderColor: assignmentPalette?.accent ?? theme.colors.textMuted, backgroundColor: done ? (assignmentPalette?.accentSoft ?? theme.colors.elevatedBackground)`,
  'task checkbox follows assignment'
],[
  `color={creatorPalette?.accent ?? theme.colors.textMuted}`,
  `color={assignmentPalette?.accent ?? theme.colors.textMuted}`,
  'task completed check follows assignment'
],[
  `<TagChip participantColor={assignmentColor} label={task.assign_to_both ? 'BOTH' : (task.assignee_name ?? 'ASSIGNED').toUpperCase()} />`,
  `<ParticipantIdentityBadge both={task.assign_to_both} userId={task.assignee_id} compact />`,
  'replace ambiguous assignment tag with identity badge'
]]);

// CALENDAR: event rail and badge mean who the event is for.
ensureImport(
  'src/app/features/calendar.tsx',
  `import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';`,
  `import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';`,
);
replaceAllSafe('src/app/features/calendar.tsx', [[
  `const renderOccurrence = (occurrence: EventOccurrence) => { const event = occurrence.event; return <Card key={occurrence.key} participantColor={colorForUser(event.creator_id)}`,
  `const renderOccurrence = (occurrence: EventOccurrence) => { const event = occurrence.event; const eventIdentity = event.assign_to_both ? 'both' : colorForUser(event.assigned_user_id); return <Card key={occurrence.key} participantColor={eventIdentity}`,
  'event rail follows who it is for'
],[
  `<TagChip participantColor={event.assign_to_both ? 'both' : colorForUser(event.assigned_user_id)} label={event.assign_to_both ? 'BOTH' : (event.assigned_user_name ?? 'ASSIGNED').toUpperCase()} />`,
  `<ParticipantIdentityBadge both={event.assign_to_both} userId={event.assigned_user_id} compact />`,
  'event assignment badge'
]]);

// NOTES: shared notes visually belong to "us"; private notes remain visually personal.
replaceAllSafe('src/app/features/notes.tsx', [[
  `<Card participantColor={creatorColor}`,
  `<Card participantColor={note.visibility === 'shared' ? 'both' : creatorColor}`,
  'shared note uses couple identity'
]]);

// LISTS are couple-owned; creator remains visible as attribution only.
replaceAllSafe('src/app/features/lists.tsx', [[
  `<Card participantColor={colorForUser(list.creator_id)}`,
  `<Card participantColor="both"`,
  'shared list uses couple identity'
]]);

// GOALS are intrinsically joint. Individual contribution identity remains visible.
ensureImport(
  'src/app/features/goals.tsx',
  `import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';`,
  `import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';`,
);
replaceAllSafe('src/app/features/goals.tsx', [[
  `const { colorForUser } = useWorkspace();`,
  `const { colorForUser } = useWorkspace();`,
  'workspace identity already available'
],[
  `<Card key={goal.id} participantColor={colorForUser(goal.creator_id)}`,
  `<Card key={goal.id} participantColor="both"`,
  'goal uses couple identity'
],[
  `<TagChip key={userId} participantColor={colorForUser(userId)} label={amount(goal, Number(value))} />`,
  `<ParticipantIdentityBadge key={userId} userId={userId} detail={amount(goal, Number(value))} compact />`,
  'goal contributions show who contributed'
]]);

// MEMORIES, TRIPS, COUNTDOWNS and DATE IDEAS are shared couple content.
// Creator attribution stays on the content, but the strong card identity says "ours".
replaceAllSafe('src/app/features/memories.tsx', [[
  `<Card key={memory.id} participantColor={colorForUser(memory.creator_id)}`,
  `<Card key={memory.id} participantColor="both"`,
  'memory uses couple identity'
]]);
replaceAllSafe('src/app/features/trips.tsx', [[
  `<Card key={trip.id} participantColor={colorForUser(trip.creator_id)}`,
  `<Card key={trip.id} participantColor="both"`,
  'trip uses couple identity'
]]);
replaceAllSafe('src/app/features/activities.tsx', [[
  `<Card key={activity.id} participantColor={colorForUser(activity.creator_id)}`,
  `<Card key={activity.id} participantColor="both"`,
  'date idea uses couple identity'
]]);

// Countdowns: both rail + neutral countdown number. Who created it stays metadata only.
replaceAllSafe('src/app/features/countdowns.tsx', [[
  `const creatorColor = colorForUser(countdown.creator_id); const palette = creatorColor === 'both' ? null : participantPalette(creatorColor); return <Card key={countdown.id} participantColor={creatorColor}`,
  `return <Card key={countdown.id} participantColor="both"`,
  'countdown uses couple identity'
],[
  `style={{ color: passed ? theme.colors.textMuted : (palette?.accent ?? theme.colors.textSecondary) }}`,
  `style={{ color: passed ? theme.colors.textMuted : theme.colors.textPrimary }}`,
  'countdown number stays neutral'
]]);

// HOME: when the partner needs something, the card unmistakably belongs to them.
ensureImport(
  'src/components/dashboard/HomeTodayCard.tsx',
  `import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';`,
  `import { Card } from '@/components/common/Card';`,
);
replaceAllSafe('src/components/dashboard/HomeTodayCard.tsx', [[
  `const { profile, partnerProfile } = useWorkspace();`,
  `const { profile, partnerProfile, partnerColor } = useWorkspace();`,
  'home knows partner identity colour'
],[
  `<Card participantColor={undefined} tone="accent"`,
  `<Card participantColor={partnerColor}`,
  'partner support card gets partner rail'
],[
  `<AppText variant="caption" tone="accent">YOUR PERSON</AppText>
                  <AppText variant="cardTitle">{partnerProfile?.display_name ?? 'Your partner'} could use {needText[partnerMood.need]}.</AppText>`,
  `<ParticipantIdentityBadge userId={partnerProfile?.id} compact />
                  <AppText variant="cardTitle">{partnerProfile?.display_name ?? 'Your partner'} could use {needText[partnerMood.need]}.</AppText>`,
  'partner support card names partner explicitly'
]]);

// LONG DISTANCE: labels directly under both clocks remove any ambiguity.
ensureImport(
  'src/components/dashboard/LongDistanceOverviewCard.tsx',
  `import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';`,
  `import { Card } from '@/components/common/Card';`,
);
replaceAllSafe('src/components/dashboard/LongDistanceOverviewCard.tsx', [[
  `<View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <AppText accessibilityLabel={\`\${profile?.display_name ?? 'Your'} local time \${formatTime(profile?.timezone, new Date(now))}\`} variant="pageTitle" style={{ flex: 1, color: participantPalette(myColor).accent }}>{formatTime(profile?.timezone, new Date(now))}</AppText>
        <AppText variant="caption" tone="muted" align="center">{partnerProfile ? timeDifferenceLabel(profile?.timezone, partnerProfile.timezone, new Date(now)) : 'Waiting'}</AppText>
        <AppText accessibilityLabel={\`\${partnerProfile?.display_name ?? 'Partner'} local time \${partnerProfile ? formatTime(partnerProfile.timezone, new Date(now)) : 'unavailable'}\`} variant="pageTitle" align="right" style={{ flex: 1, color: participantPalette(partnerColor).accent }}>{partnerProfile ? formatTime(partnerProfile.timezone, new Date(now)) : '—'}</AppText>
      </View>`,
  `<View style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <AppText accessibilityLabel={\`\${profile?.display_name ?? 'Your'} local time \${formatTime(profile?.timezone, new Date(now))}\`} variant="pageTitle" style={{ flex: 1, color: participantPalette(myColor).accent }}>{formatTime(profile?.timezone, new Date(now))}</AppText>
          <AppText variant="caption" tone="muted" align="center">{partnerProfile ? timeDifferenceLabel(profile?.timezone, partnerProfile.timezone, new Date(now)) : 'Waiting'}</AppText>
          <AppText accessibilityLabel={\`\${partnerProfile?.display_name ?? 'Partner'} local time \${partnerProfile ? formatTime(partnerProfile.timezone, new Date(now)) : 'unavailable'}\`} variant="pageTitle" align="right" style={{ flex: 1, color: participantPalette(partnerColor).accent }}>{partnerProfile ? formatTime(partnerProfile.timezone, new Date(now)) : '—'}</AppText>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
          <ParticipantIdentityBadge userId={profile?.id} compact />
          <ParticipantIdentityBadge userId={partnerProfile?.id} compact />
        </View>
      </View>`,
  'add direct identities to long-distance clocks'
]]);

// MOOD: identity badges make "mine" vs "theirs" readable without relying on colour.
ensureImport(
  'src/app/features/mood.tsx',
  `import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';`,
  `import { TagChip } from '@/components/common/TagChip';`,
);
replaceAllSafe('src/app/features/mood.tsx', [[
  `<AppText variant="caption" style={{ color: participantPalette(myColor).accent }}>{profile!.display_name.toUpperCase()}</AppText>`,
  `<ParticipantIdentityBadge userId={profile?.id} compact />`,
  'mood composer identifies me'
],[
  `<View style={{ gap: 5 }}><AppText variant="caption" style={{ color: participantPalette(partnerColor).accent }}>{partnerProfile?.display_name?.toUpperCase() ?? 'PARTNER'} · {relative(partner).toUpperCase()}</AppText><AppText variant="section">{moodLabels[partner.mood]}</AppText><TagChip participantColor={partnerColor} label={\`NEEDS: \${needLabels[partner.need].toUpperCase()}\`} /></View>`,
  `<View style={{ gap: 7 }}><ParticipantIdentityBadge userId={partnerProfile?.id} detail={relative(partner)} compact /><AppText variant="section">{moodLabels[partner.mood]}</AppText><TagChip participantColor={partnerColor} label={\`NEEDS: \${needLabels[partner.need].toUpperCase()}\`} /></View>`,
  'partner mood identity'
],[
  `<Card participantColor={myColor} tone="secondary" style={{ gap: 7 }}><AppText variant="caption" style={{ color: participantPalette(myColor).accent }}>{profile!.display_name.toUpperCase()} · {relative(mine).toUpperCase()}</AppText><AppText variant="cardTitle">{moodLabels[mine.mood]}</AppText>`,
  `<Card participantColor={myColor} tone="secondary" style={{ gap: 7 }}><ParticipantIdentityBadge userId={profile?.id} detail={relative(mine)} compact /><AppText variant="cardTitle">{moodLabels[mine.mood]}</AppText>`,
  'my mood identity'
]]);

// Post-patch audit: strong creator-colour rails are suspicious on these shared content screens.
const sharedFiles = [
  'src/app/features/lists.tsx',
  'src/app/features/goals.tsx',
  'src/app/features/memories.tsx',
  'src/app/features/trips.tsx',
  'src/app/features/countdowns.tsx',
  'src/app/features/activities.tsx',
];
const problems = [];
for (const rel of sharedFiles) {
  const text = read(rel);
  if (/participantColor=\{colorForUser\([^}]*creator_id[^}]*\)\}/.test(text)) problems.push(`${rel}: creator rail still used for couple-owned content`);
}
const tasks = read('src/app/features/tasks.tsx');
if (!tasks.includes('participantColor={assignmentColor}')) problems.push('src/app/features/tasks.tsx: task rail is not assignment identity');
const calendar = read('src/app/features/calendar.tsx');
if (!calendar.includes('participantColor={eventIdentity}')) problems.push('src/app/features/calendar.tsx: event rail is not assignment identity');
const notes = read('src/app/features/notes.tsx');
if (!notes.includes(`participantColor={note.visibility === 'shared' ? 'both' : creatorColor}`)) problems.push('src/app/features/notes.tsx: shared/private note identity is not explicit');

if (problems.length) {
  fs.writeFileSync(file('RELEASE_A2_IDENTITY_AUDIT_REMAINING.txt'), problems.join('\r\n') + '\r\n', 'utf8');
  console.log(`Identity semantics audit found ${problems.length} item(s). See RELEASE_A2_IDENTITY_AUDIT_REMAINING.txt`);
} else {
  const report = file('RELEASE_A2_IDENTITY_AUDIT_REMAINING.txt');
  if (fs.existsSync(report)) fs.unlinkSync(report);
  console.log('Identity semantics audit clean.');
}

console.log('');
console.log('Release A2 visual identity pass applied.');
console.log('Run:');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
