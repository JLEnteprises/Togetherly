
$ErrorActionPreference = 'Stop'

$project = 'C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere'
Set-Location $project

function Read-Utf8([string]$Path) {
    $full = Join-Path $project $Path
    if (-not (Test-Path $full)) { throw "Missing file: $Path" }
    return [System.IO.File]::ReadAllText($full)
}
function Write-Utf8([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText((Join-Path $project $Path), $Text, [System.Text.UTF8Encoding]::new($false))
}
function Replace-RegexOnce {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Replacement,
        [string]$AlreadyContains
    )
    $text = Read-Utf8 $Path
    if ($AlreadyContains -and $text.Contains($AlreadyContains)) {
        Write-Host "Already patched $Path" -ForegroundColor DarkGreen
        return
    }
    $regex = [regex]::new($Pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
    $matches = $regex.Matches($text)
    if ($matches.Count -ne 1) {
        throw "Could not safely patch $Path. Expected exactly 1 matching block, found $($matches.Count)."
    }
    $next = $regex.Replace($text, $Replacement, 1)
    Write-Utf8 $Path $next
    Write-Host "Patched $Path" -ForegroundColor Green
}

# 1) ACTIVITIES: enforce backend's 1..1440 minute duration limit client-side.
$pattern = "async function save\(\) \{\s*const durationMinutes = duration\.trim\(\) \? Number\(duration\) : null;\s*if \(!title\.trim\(\) \|\| \(durationMinutes != null && \(!Number\.isFinite\(durationMinutes\) \|\| durationMinutes <= 0\)\)\) \{\s*Alert\.alert\('Check the activity', 'Add a title and a valid duration in minutes if you use one\.'\);\s*return;\s*\}"
$replacement = @'
async function save() { const durationMinutes = duration.trim() ? Number(duration) : null; if (!title.trim() || (durationMinutes != null && (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440))) { Alert.alert('Check the activity', 'Add a title and, if used, a duration between 1 and 1,440 minutes.'); return; }
'@
Replace-RegexOnce 'src\app\features\activities.tsx' $pattern $replacement 'duration between 1 and 1,440 minutes'

# 2) RANDOMISER: correct misleading label.
$text = Read-Utf8 'src\app\features\activity-randomizer.tsx'
if (-not $text.Contains("{ value: '180', label: '≤3h' }")) {
    $text2 = $text -replace "\{ value: '180', label: '1–3h' \}", "{ value: '180', label: '≤3h' }"
    if ($text2 -eq $text) { throw "Could not safely patch randomiser duration label." }
    Write-Utf8 'src\app\features\activity-randomizer.tsx' $text2
    Write-Host "Patched randomiser duration label" -ForegroundColor Green
} else {
    Write-Host "Already patched randomiser duration label" -ForegroundColor DarkGreen
}

# 3) RANDOMISER: busy guard on roll().
$pattern = "async function roll\(\) \{\s*setBusy\(true\);\s*setHasTried\(true\);"
$replacement = @'
async function roll() {
    if (busy) return;
    setBusy(true); setHasTried(true);
'@
Replace-RegexOnce 'src\app\features\activity-randomizer.tsx' $pattern $replacement 'if (busy) return;'

# 4) RANDOMISER: make Not tonight single-flight.
$pattern = "async function notTonight\(\) \{\s*if \(!pick\) return;\s*try \{ await rejectActivity\(pick\.id\); await roll\(\); \}\s*catch \(error\) \{ Alert\.alert\('Couldn’t reroll', messageFrom\(error\)\); \}\s*\}"
$replacement = @'
async function notTonight() {
    if (!pick || busy) return;
    setBusy(true);
    try { await rejectActivity(pick.id); }
    catch (error) { Alert.alert('Couldn’t reroll', messageFrom(error)); setBusy(false); return; }
    setBusy(false);
    await roll();
  }
'@
Replace-RegexOnce 'src\app\features\activity-randomizer.tsx' $pattern $replacement 'if (!pick || busy) return;'

# 5) RANDOMISER: disable result actions while busy.
$text = Read-Utf8 'src\app\features\activity-randomizer.tsx'
if (-not $text.Contains('label="Let’s do it" disabled={busy}')) {
    $text = $text.Replace('label="Let’s do it" onPress={planPick}', 'label="Let’s do it" disabled={busy} onPress={planPick}')
    $text = $text.Replace('label="Reroll" variant="secondary" onPress={roll}', 'label="Reroll" variant="secondary" disabled={busy} onPress={roll}')
    $text = $text.Replace('label="Not tonight" variant="ghost" onPress={notTonight}', 'label="Not tonight" variant="ghost" disabled={busy} onPress={notTonight}')
    $text = $text.Replace("variant=\"ghost\" onPress={() => choose('favourite')}", "variant=\"ghost\" disabled={busy} onPress={() => choose('favourite')}")
    Write-Utf8 'src\app\features\activity-randomizer.tsx' $text
    Write-Host "Patched randomiser action busy states" -ForegroundColor Green
} else {
    Write-Host "Already patched randomiser action busy states" -ForegroundColor DarkGreen
}

# 6) GOALS backend: store only effective negative correction.
$pattern = "const contributionId = randomUUID\(\);\s*await client\.query\('INSERT INTO goal_contributions\(id,goal_id,creator_id,amount,note\) VALUES\(\$1,\$2,\$3,\$4,\$5\)',\s*\[contributionId, id, request\.userId, amount, optionalText\(body\.note, 500\)\]\);\s*const nextValue = Math\.max\(0, Number\(goal\.current_value\) \+ amount\);"
$replacement = @'
const contributionId = randomUUID();
      const currentValue = Number(goal.current_value);
      const effectiveAmount = amount < 0 ? Math.max(amount, -currentValue) : amount;
      if (effectiveAmount === 0) throw new ApiError(400, 'This goal is already at zero.');
      await client.query('INSERT INTO goal_contributions(id,goal_id,creator_id,amount,note) VALUES($1,$2,$3,$4,$5)',
        [contributionId, id, request.userId, effectiveAmount, optionalText(body.note, 500)]);
      const nextValue = currentValue + effectiveAmount;
'@
Replace-RegexOnce 'server\src\routes\planning.ts' $pattern $replacement 'const effectiveAmount = amount < 0 ? Math.max(amount, -currentValue) : amount;'

# 7) GOALS UI: paused state and correct completion wording.
$pattern = "\{goal\.status !== 'completed' \? <View style=\{\{ gap: theme\.spacing\.sm \}\}>.*?</View> : <View style=\{\{ flexDirection: 'row', alignItems: 'center', gap: 7 \}\}><AppIcon name=\"spark\" size=\{16\} color=\{theme\.colors\.success\} /><AppText variant=\"bodySmall\" tone=\"success\">Goal reached</AppText></View>\}"
$replacement = @'
{goal.status === 'active' ? <View style={{ gap: theme.spacing.sm }}><Pressable accessibilityRole="button" onPress={() => setContributionOpen(openContribution ? null : goal.id)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppIcon name="plus" size={16} color={theme.colors.accent} /><AppText variant="bodySmall" tone="accent">Add progress</AppText></View><AppIcon name={openContribution ? 'chevronUp' : 'chevronDown'} size={15} color={theme.colors.textMuted} /></Pressable>{openContribution ? <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}><View style={{ flex: 1 }}><FormField label="AMOUNT" value={contributions[goal.id] ?? ''} onChangeText={(value) => setContributions((state) => ({ ...state, [goal.id]: value }))} keyboardType="decimal-pad" placeholder="100" /></View><AppButton compact label="Add" onPress={() => contribute(goal)} disabled={!contributions[goal.id]?.trim()} /></View> : null}</View> : goal.status === 'paused' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppIcon name="pause" size={16} color={theme.colors.textMuted} /><AppText variant="bodySmall" tone="muted">Goal paused</AppText></View> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppIcon name="spark" size={16} color={theme.colors.success} /><AppText variant="bodySmall" tone="success">{percent >= 100 ? 'Goal reached' : 'Goal marked complete'}</AppText></View>}
'@
Replace-RegexOnce 'src\app\features\goals.tsx' $pattern $replacement 'Goal marked complete'

# 8) TRIP DETAIL: date-only helper import.
$text = Read-Utf8 'src\app\features\trip-detail.tsx'
if (-not $text.Contains("import { dateOnlyFromIso } from '@/utils/dates';")) {
    $needle = "import type { CoupleCountdown, CoupleEvent, CoupleGoal, CoupleList, CoupleTrip, TripLink, TripLinkType } from '@/types/database';"
    if (-not $text.Contains($needle)) { throw "Could not find Trip Detail type import." }
    $text = $text.Replace($needle, $needle + "`nimport { dateOnlyFromIso } from '@/utils/dates';")
    Write-Utf8 'src\app\features\trip-detail.tsx' $text
    Write-Host "Patched Trip Detail date helper import" -ForegroundColor Green
} else {
    Write-Host "Already patched Trip Detail date helper import" -ForegroundColor DarkGreen
}

# 9) TRIP DETAIL: timezone-safe countdown candidate subtitle.
$text = Read-Utf8 'src\app\features\trip-detail.tsx'
if (-not $text.Contains("dateOnlyFromIso(item.target_at) || new Date(item.target_at).toLocaleDateString()")) {
    $pattern = "\.\.\.countdowns\.map\(\(item\) => \(\{ type: 'countdown' as const, id: item\.id, title: item\.title, subtitle: new Date\(item\.target_at\)\.toLocaleDateString\(\) \}\)\),"
    $replacement = "...countdowns.map((item) => ({ type: 'countdown' as const, id: item.id, title: item.title, subtitle: dateOnlyFromIso(item.target_at) || new Date(item.target_at).toLocaleDateString() })),"
    $rx = [regex]::new($pattern)
    if ($rx.Matches($text).Count -ne 1) { throw "Could not safely patch Trip Detail countdown subtitle." }
    $text = $rx.Replace($text, $replacement, 1)
    Write-Utf8 'src\app\features\trip-detail.tsx' $text
    Write-Host "Patched Trip Detail countdown subtitle" -ForegroundColor Green
} else {
    Write-Host "Already patched Trip Detail countdown subtitle" -ForegroundColor DarkGreen
}

# 10) TRIP DETAIL: quick countdown should not send startAt >= targetAt.
$pattern = "async function createTripCountdown\(\) \{.*?const countdown = await createCountdown\(\{ title: `\$\{trip\.title\} begins`, targetAt: targetIso\(trip\.start_date\), startAt: new Date\(\)\.toISOString\(\), type: 'visit' \}\);.*?\}"
$replacement = @'
async function createTripCountdown() { if (links.some((item) => item.entity_type === 'countdown')) { Alert.alert('Countdown already linked', 'Open the linked countdown below if you want to change it.'); return; } if (!trip?.start_date || !id) { Alert.alert('Add trip dates first', 'Set a start date before creating a trip countdown.'); return; } setBusy(true); try { const targetAt = targetIso(trip.start_date); const now = new Date().toISOString(); const countdown = await createCountdown({ title: `${trip.title} begins`, targetAt, startAt: new Date(now).getTime() < new Date(targetAt).getTime() ? now : null, type: 'visit' }); await linkTripItem(id, 'countdown', countdown.id); await refresh(); } catch (error) { Alert.alert('Couldn’t create countdown', messageFrom(error)); } finally { setBusy(false); } }
'@
Replace-RegexOnce 'src\app\features\trip-detail.tsx' $pattern $replacement 'startAt: new Date(now).getTime() < new Date(targetAt).getTime() ? now : null'

Write-Host ''
Write-Host 'Batch 4 v3 patch complete.' -ForegroundColor Cyan
Write-Host 'Run:'
Write-Host '  npm run typecheck'
Write-Host '  npm --prefix server run typecheck'
