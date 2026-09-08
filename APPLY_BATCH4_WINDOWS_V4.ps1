$ErrorActionPreference = 'Stop'

$project = 'C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere'
Set-Location $project

function Read-Utf8([string]$Path) {
    $full = Join-Path $project $Path
    if (-not (Test-Path $full)) { throw "Missing file: $Path" }
    return [System.IO.File]::ReadAllText($full)
}

function Write-Utf8([string]$Path, [string]$Text) {
    $full = Join-Path $project $Path
    [System.IO.File]::WriteAllText($full, $Text, [System.Text.UTF8Encoding]::new($false))
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

    $rx = [regex]::new(
        $Pattern,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $count = $rx.Matches($text).Count
    if ($count -ne 1) {
        throw "Could not safely patch $Path. Expected exactly 1 matching block, found $count."
    }

    $next = $rx.Replace($text, $Replacement, 1)
    Write-Utf8 $Path $next
    Write-Host "Patched $Path" -ForegroundColor Green
}

# 1. Activities: client-side duration range should match backend 1..1440 minutes.
$pattern = 'async function save\(\)\s*\{\s*const durationMinutes = duration\.trim\(\) \? Number\(duration\) : null;\s*if\s*\(!title\.trim\(\)\s*\|\|\s*\(durationMinutes != null && \(!Number\.isFinite\(durationMinutes\) \|\| durationMinutes <= 0\)\)\)\s*\{.*?return;\s*\}'
$replacement = @'
async function save() { const durationMinutes = duration.trim() ? Number(duration) : null; if (!title.trim() || (durationMinutes != null && (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440))) { Alert.alert('Check the activity', 'Add a title and, if used, a duration between 1 and 1,440 minutes.'); return; }
'@
Replace-RegexOnce 'src\app\features\activities.tsx' $pattern $replacement 'duration between 1 and 1,440 minutes'

# 2. Randomizer: fix misleading <=3h label without depending on Unicode source text.
$text = Read-Utf8 'src\app\features\activity-randomizer.tsx'
if (-not $text.Contains("label: '<=3h'")) {
    $rx = [regex]::new("\{ value: '180', label: '[^']*' \}")
    if ($rx.Matches($text).Count -ne 1) {
        throw "Could not safely patch randomizer 180-minute label."
    }
    $text = $rx.Replace($text, "{ value: '180', label: '<=3h' }", 1)
    Write-Utf8 'src\app\features\activity-randomizer.tsx' $text
    Write-Host "Patched randomizer duration label" -ForegroundColor Green
} else {
    Write-Host "Already patched randomizer duration label" -ForegroundColor DarkGreen
}

# 3. Randomizer: prevent overlapping roll requests.
$pattern = 'async function roll\(\)\s*\{\s*setBusy\(true\);\s*setHasTried\(true\);'
$replacement = @'
async function roll() {
    if (busy) return;
    setBusy(true); setHasTried(true);
'@
Replace-RegexOnce 'src\app\features\activity-randomizer.tsx' $pattern $replacement 'async function roll() {' + "`n" + '    if (busy) return;'

# 4. Randomizer: make Not tonight single-flight.
$pattern = 'async function notTonight\(\)\s*\{\s*if \(!pick\) return;.*?catch \(error\)\s*\{.*?\}\s*\}'
$replacement = @'
async function notTonight() {
    if (!pick || busy) return;
    setBusy(true);
    try { await rejectActivity(pick.id); }
    catch (error) { Alert.alert('Could not reroll', messageFrom(error)); setBusy(false); return; }
    setBusy(false);
    await roll();
  }
'@
Replace-RegexOnce 'src\app\features\activity-randomizer.tsx' $pattern $replacement 'if (!pick || busy) return;'

# 5. Randomizer: disable result actions while a request is running.
$text = Read-Utf8 'src\app\features\activity-randomizer.tsx'
$changed = $false

if ($text -notmatch 'label="Let.s do it"\s+disabled=\{busy\}') {
    $text2 = [regex]::Replace($text, 'label="Let.s do it"\s+onPress=\{planPick\}', 'label="Let''s do it" disabled={busy} onPress={planPick}', 1)
    if ($text2 -ne $text) { $text = $text2; $changed = $true }
}

if ($text -notmatch 'label="Reroll"\s+variant="secondary"\s+disabled=\{busy\}') {
    $text2 = $text.Replace('label="Reroll" variant="secondary" onPress={roll}', 'label="Reroll" variant="secondary" disabled={busy} onPress={roll}')
    if ($text2 -ne $text) { $text = $text2; $changed = $true }
}

if ($text -notmatch 'label="Not tonight"\s+variant="ghost"\s+disabled=\{busy\}') {
    $text2 = $text.Replace('label="Not tonight" variant="ghost" onPress={notTonight}', 'label="Not tonight" variant="ghost" disabled={busy} onPress={notTonight}')
    if ($text2 -ne $text) { $text = $text2; $changed = $true }
}

if ($text -notmatch 'disabled=\{busy\}\s+onPress=\{\(\) => choose\(''favourite''\)\}') {
    $text2 = $text.Replace('variant="ghost" onPress={() => choose(''favourite'')}', 'variant="ghost" disabled={busy} onPress={() => choose(''favourite'')}')
    if ($text2 -ne $text) { $text = $text2; $changed = $true }
}

if ($changed) {
    Write-Utf8 'src\app\features\activity-randomizer.tsx' $text
    Write-Host "Patched randomizer action busy states" -ForegroundColor Green
} else {
    Write-Host "Randomizer action busy states already patched or source did not require changes" -ForegroundColor DarkGreen
}

# 6. Goals backend: store only the effective negative correction.
$pattern = 'const contributionId = randomUUID\(\);\s*await client\.query\(''INSERT INTO goal_contributions\(id,goal_id,creator_id,amount,note\) VALUES\(\$1,\$2,\$3,\$4,\$5\)'',\s*\[contributionId, id, request\.userId, amount, optionalText\(body\.note, 500\)\]\);\s*const nextValue = Math\.max\(0, Number\(goal\.current_value\) \+ amount\);'
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

# 7. Goals UI: paused goals should not show Add progress, and manual completion wording should be accurate.
$pattern = '\{goal\.status !== ''completed'' \? <View style=\{\{ gap: theme\.spacing\.sm \}\}>.*?</View> : <View style=\{\{ flexDirection: ''row'', alignItems: ''center'', gap: 7 \}\}><AppIcon name="spark" size=\{16\} color=\{theme\.colors\.success\} /><AppText variant="bodySmall" tone="success">Goal reached</AppText></View>\}'
$replacement = @'
{goal.status === 'active' ? <View style={{ gap: theme.spacing.sm }}><Pressable accessibilityRole="button" onPress={() => setContributionOpen(openContribution ? null : goal.id)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppIcon name="plus" size={16} color={theme.colors.accent} /><AppText variant="bodySmall" tone="accent">Add progress</AppText></View><AppIcon name={openContribution ? 'chevronUp' : 'chevronDown'} size={15} color={theme.colors.textMuted} /></Pressable>{openContribution ? <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}><View style={{ flex: 1 }}><FormField label="AMOUNT" value={contributions[goal.id] ?? ''} onChangeText={(value) => setContributions((state) => ({ ...state, [goal.id]: value }))} keyboardType="decimal-pad" placeholder="100" /></View><AppButton compact label="Add" onPress={() => contribute(goal)} disabled={!contributions[goal.id]?.trim()} /></View> : null}</View> : goal.status === 'paused' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppText variant="bodySmall" tone="muted">Goal paused</AppText></View> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppIcon name="spark" size={16} color={theme.colors.success} /><AppText variant="bodySmall" tone="success">{percent >= 100 ? 'Goal reached' : 'Goal marked complete'}</AppText></View>}
'@
Replace-RegexOnce 'src\app\features\goals.tsx' $pattern $replacement 'Goal marked complete'

# 8. Trip Detail: import date-only helper.
$text = Read-Utf8 'src\app\features\trip-detail.tsx'
$importLine = "import { dateOnlyFromIso } from '@/utils/dates';"
if (-not $text.Contains($importLine)) {
    $needle = "import type { CoupleCountdown, CoupleEvent, CoupleGoal, CoupleList, CoupleTrip, TripLink, TripLinkType } from '@/types/database';"
    if (-not $text.Contains($needle)) { throw "Could not find Trip Detail type import." }
    $text = $text.Replace($needle, $needle + "`n" + $importLine)
    Write-Utf8 'src\app\features\trip-detail.tsx' $text
    Write-Host "Patched Trip Detail date helper import" -ForegroundColor Green
} else {
    Write-Host "Already patched Trip Detail date helper import" -ForegroundColor DarkGreen
}

# 9. Trip Detail: date-safe linked countdown subtitle.
$text = Read-Utf8 'src\app\features\trip-detail.tsx'
if (-not $text.Contains('dateOnlyFromIso(item.target_at) || new Date(item.target_at).toLocaleDateString()')) {
    $rx = [regex]::new('\.\.\.countdowns\.map\(\(item\) => \(\{ type: ''countdown'' as const, id: item\.id, title: item\.title, subtitle: new Date\(item\.target_at\)\.toLocaleDateString\(\) \}\)\),')
    if ($rx.Matches($text).Count -ne 1) { throw "Could not safely patch Trip Detail countdown subtitle." }
    $text = $rx.Replace($text, "...countdowns.map((item) => ({ type: 'countdown' as const, id: item.id, title: item.title, subtitle: dateOnlyFromIso(item.target_at) || new Date(item.target_at).toLocaleDateString() })),", 1)
    Write-Utf8 'src\app\features\trip-detail.tsx' $text
    Write-Host "Patched Trip Detail countdown subtitle" -ForegroundColor Green
} else {
    Write-Host "Already patched Trip Detail countdown subtitle" -ForegroundColor DarkGreen
}

# 10. Trip Detail: avoid startAt >= targetAt for a trip beginning today.
$pattern = 'async function createTripCountdown\(\)\s*\{.*?const countdown = await createCountdown\(\{ title: `\$\{trip\.title\} begins`, targetAt: targetIso\(trip\.start_date\), startAt: new Date\(\)\.toISOString\(\), type: ''visit'' \}\);.*?\}'
$replacement = @'
async function createTripCountdown() { if (links.some((item) => item.entity_type === 'countdown')) { Alert.alert('Countdown already linked', 'Open the linked countdown below if you want to change it.'); return; } if (!trip?.start_date || !id) { Alert.alert('Add trip dates first', 'Set a start date before creating a trip countdown.'); return; } setBusy(true); try { const targetAt = targetIso(trip.start_date); const now = new Date().toISOString(); const countdown = await createCountdown({ title: `${trip.title} begins`, targetAt, startAt: new Date(now).getTime() < new Date(targetAt).getTime() ? now : null, type: 'visit' }); await linkTripItem(id, 'countdown', countdown.id); await refresh(); } catch (error) { Alert.alert('Could not create countdown', messageFrom(error)); } finally { setBusy(false); } }
'@
Replace-RegexOnce 'src\app\features\trip-detail.tsx' $pattern $replacement 'startAt: new Date(now).getTime() < new Date(targetAt).getTime() ? now : null'

Write-Host ''
Write-Host 'Batch 4 v4 patch complete.' -ForegroundColor Cyan
Write-Host 'Now run:'
Write-Host '  npm run typecheck'
Write-Host '  npm --prefix server run typecheck'
