
$ErrorActionPreference = 'Stop'

$project = 'C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere'
Set-Location $project

function Replace-Exact {
    param([string]$Path,[string]$Old,[string]$New)
    $full = Join-Path $project $Path
    if (-not (Test-Path $full)) { throw "Missing file: $Path" }

    # GitHub/source files are normally LF while Windows PowerShell here-strings
    # are CRLF. Normalize both before matching so line endings alone cannot
    # make a valid audited block fail.
    $text = Get-Content $full -Raw
    $textNorm = $text -replace "`r`n", "`n"
    $oldNorm = $Old -replace "`r`n", "`n"
    $newNorm = $New -replace "`r`n", "`n"

    if (-not $textNorm.Contains($oldNorm)) {
        throw "Expected source block was not found in $Path even after line-ending normalization. Stop: local source really differs from the audited block."
    }

    $textNorm = $textNorm.Replace($oldNorm, $newNorm)
    [System.IO.File]::WriteAllText($full, $textNorm, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Patched $Path" -ForegroundColor Green
}

# ACTIVITIES — mirror the backend's 24-hour duration limit client-side.
$old = @'
  async function save() { const durationMinutes = duration.trim() ? Number(duration) : null; if (!title.trim() || (durationMinutes != null && (!Number.isFinite(durationMinutes) || durationMinutes <= 0))) { Alert.alert('Check the activity', 'Add a title and a valid duration in minutes if you use one.'); return; } setBusy(true); try { const parsedRating = rating.trim() ? Number(rating) : null;
'@
$new = @'
  async function save() { const durationMinutes = duration.trim() ? Number(duration) : null; if (!title.trim() || (durationMinutes != null && (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440))) { Alert.alert('Check the activity', 'Add a title and, if used, a duration between 1 and 1,440 minutes.'); return; } setBusy(true); try { const parsedRating = rating.trim() ? Number(rating) : null;
'@
Replace-Exact 'src\app\features\activities.tsx' $old $new

# RANDOMISER — the old label said 1–3h but the actual filter is <= 3h.
$old = @'
{ value: '180', label: '1–3h' }
'@
$new = @'
{ value: '180', label: '≤3h' }
'@
Replace-Exact 'src\app\features\activity-randomizer.tsx' $old $new

# RANDOMISER — prevent double actions/rerolls while a request is already running.
$old = @'
  async function roll() {
    setBusy(true); setHasTried(true);
'@
$new = @'
  async function roll() {
    if (busy) return;
    setBusy(true); setHasTried(true);
'@
Replace-Exact 'src\app\features\activity-randomizer.tsx' $old $new

$old = @'
  async function notTonight() {
    if (!pick) return;
    try { await rejectActivity(pick.id); await roll(); }
    catch (error) { Alert.alert('Couldn’t reroll', messageFrom(error)); }
  }
'@
$new = @'
  async function notTonight() {
    if (!pick || busy) return;
    setBusy(true);
    try { await rejectActivity(pick.id); }
    catch (error) { Alert.alert('Couldn’t reroll', messageFrom(error)); setBusy(false); return; }
    setBusy(false);
    await roll();
  }
'@
Replace-Exact 'src\app\features\activity-randomizer.tsx' $old $new

$old = @'
            <AppButton icon="heart" label="Let’s do it" onPress={planPick} />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><AppButton icon="spark" label="Reroll" variant="secondary" onPress={roll} /></View><View style={{ flex: 1 }}><AppButton label="Not tonight" variant="ghost" onPress={notTonight} /></View></View>
            <AppButton label={pick.status === 'favourite' ? '★ Favourite' : '☆ Save as favourite'} variant="ghost" onPress={() => choose('favourite')} />
'@
$new = @'
            <AppButton icon="heart" label="Let’s do it" disabled={busy} onPress={planPick} />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><AppButton icon="spark" label="Reroll" variant="secondary" disabled={busy} onPress={roll} /></View><View style={{ flex: 1 }}><AppButton label="Not tonight" variant="ghost" disabled={busy} onPress={notTonight} /></View></View>
            <AppButton label={pick.status === 'favourite' ? '★ Favourite' : '☆ Save as favourite'} variant="ghost" disabled={busy} onPress={() => choose('favourite')} />
'@
Replace-Exact 'src\app\features\activity-randomizer.tsx' $old $new

# GOALS — negative corrections were clamped visually at zero but the full negative
# amount was still stored in contribution history, making history totals disagree
# with current_value. Store only the effective correction.
$old = @'
      const contributionId = randomUUID();
      await client.query('INSERT INTO goal_contributions(id,goal_id,creator_id,amount,note) VALUES($1,$2,$3,$4,$5)',
        [contributionId, id, request.userId, amount, optionalText(body.note, 500)]);
      const nextValue = Math.max(0, Number(goal.current_value) + amount);
'@
$new = @'
      const contributionId = randomUUID();
      const currentValue = Number(goal.current_value);
      const effectiveAmount = amount < 0 ? Math.max(amount, -currentValue) : amount;
      if (effectiveAmount === 0) throw new ApiError(400, 'This goal is already at zero.');
      await client.query('INSERT INTO goal_contributions(id,goal_id,creator_id,amount,note) VALUES($1,$2,$3,$4,$5)',
        [contributionId, id, request.userId, effectiveAmount, optionalText(body.note, 500)]);
      const nextValue = currentValue + effectiveAmount;
'@
Replace-Exact 'server\src\routes\planning.ts' $old $new

# GOALS — paused goals should look paused, not invite new progress; distinguish
# manually-completed goals from goals whose numerical target was reached.
$old = @'
              {goal.status !== 'completed' ? <View style={{ gap: theme.spacing.sm }}><Pressable accessibilityRole="button" onPress={() => setContributionOpen(openContribution ? null : goal.id)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppIcon name="plus" size={16} color={theme.colors.accent} /><AppText variant="bodySmall" tone="accent">Add progress</AppText></View><AppIcon name={openContribution ? 'chevronUp' : 'chevronDown'} size={15} color={theme.colors.textMuted} /></Pressable>{openContribution ? <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}><View style={{ flex: 1 }}><FormField label="AMOUNT" value={contributions[goal.id] ?? ''} onChangeText={(value) => setContributions((state) => ({ ...state, [goal.id]: value }))} keyboardType="decimal-pad" placeholder="100" /></View><AppButton compact label="Add" onPress={() => contribute(goal)} disabled={!contributions[goal.id]?.trim()} /></View> : null}</View> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppIcon name="spark" size={16} color={theme.colors.success} /><AppText variant="bodySmall" tone="success">Goal reached</AppText></View>}
'@
$new = @'
              {goal.status === 'active' ? <View style={{ gap: theme.spacing.sm }}><Pressable accessibilityRole="button" onPress={() => setContributionOpen(openContribution ? null : goal.id)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppIcon name="plus" size={16} color={theme.colors.accent} /><AppText variant="bodySmall" tone="accent">Add progress</AppText></View><AppIcon name={openContribution ? 'chevronUp' : 'chevronDown'} size={15} color={theme.colors.textMuted} /></Pressable>{openContribution ? <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}><View style={{ flex: 1 }}><FormField label="AMOUNT" value={contributions[goal.id] ?? ''} onChangeText={(value) => setContributions((state) => ({ ...state, [goal.id]: value }))} keyboardType="decimal-pad" placeholder="100" /></View><AppButton compact label="Add" onPress={() => contribute(goal)} disabled={!contributions[goal.id]?.trim()} /></View> : null}</View> : goal.status === 'paused' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppIcon name="pause" size={16} color={theme.colors.textMuted} /><AppText variant="bodySmall" tone="muted">Goal paused</AppText></View> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppIcon name="spark" size={16} color={theme.colors.success} /><AppText variant="bodySmall" tone="success">{percent >= 100 ? 'Goal reached' : 'Goal marked complete'}</AppText></View>}
'@
Replace-Exact 'src\app\features\goals.tsx' $old $new

# TRIP DETAIL — use date-only display for linked countdowns instead of allowing
# the viewer's timezone to shift the calendar date.
$old = @'
import type { CoupleCountdown, CoupleEvent, CoupleGoal, CoupleList, CoupleTrip, TripLink, TripLinkType } from '@/types/database';
'@
$new = @'
import type { CoupleCountdown, CoupleEvent, CoupleGoal, CoupleList, CoupleTrip, TripLink, TripLinkType } from '@/types/database';
import { dateOnlyFromIso } from '@/utils/dates';
'@
Replace-Exact 'src\app\features\trip-detail.tsx' $old $new

$old = @'
    ...countdowns.map((item) => ({ type: 'countdown' as const, id: item.id, title: item.title, subtitle: new Date(item.target_at).toLocaleDateString() })),
'@
$new = @'
    ...countdowns.map((item) => ({ type: 'countdown' as const, id: item.id, title: item.title, subtitle: dateOnlyFromIso(item.target_at) || new Date(item.target_at).toLocaleDateString() })),
'@
Replace-Exact 'src\app\features\trip-detail.tsx' $old $new

# TRIP DETAIL — don't create a countdown with start_at >= target_at when a trip
# starts today (or its target instant has already passed).
$old = @'
  async function createTripCountdown() { if (links.some((item) => item.entity_type === 'countdown')) { Alert.alert('Countdown already linked', 'Open the linked countdown below if you want to change it.'); return; } if (!trip?.start_date || !id) { Alert.alert('Add trip dates first', 'Set a start date before creating a trip countdown.'); return; } setBusy(true); try { const countdown = await createCountdown({ title: `${trip.title} begins`, targetAt: targetIso(trip.start_date), startAt: new Date().toISOString(), type: 'visit' }); await linkTripItem(id, 'countdown', countdown.id); await refresh(); } catch (error) { Alert.alert('Couldn’t create countdown', messageFrom(error)); } finally { setBusy(false); } }
'@
$new = @'
  async function createTripCountdown() { if (links.some((item) => item.entity_type === 'countdown')) { Alert.alert('Countdown already linked', 'Open the linked countdown below if you want to change it.'); return; } if (!trip?.start_date || !id) { Alert.alert('Add trip dates first', 'Set a start date before creating a trip countdown.'); return; } setBusy(true); try { const targetAt = targetIso(trip.start_date); const now = new Date().toISOString(); const countdown = await createCountdown({ title: `${trip.title} begins`, targetAt, startAt: new Date(now).getTime() < new Date(targetAt).getTime() ? now : null, type: 'visit' }); await linkTripItem(id, 'countdown', countdown.id); await refresh(); } catch (error) { Alert.alert('Couldn’t create countdown', messageFrom(error)); } finally { setBusy(false); } }
'@
Replace-Exact 'src\app\features\trip-detail.tsx' $old $new

Write-Host ''
Write-Host 'Batch 4 patch applied.' -ForegroundColor Cyan
Write-Host 'Run:'
Write-Host '  npm run typecheck'
Write-Host '  npm --prefix server run typecheck'
