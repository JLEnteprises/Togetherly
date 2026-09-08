
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

# 1) Daily Question: don't allow category changes to swap today's question
# after either partner has already answered.
$old = @'
      const disabledCategories = [...new Set(body.disabledCategories as string[])];
      if (disabledCategories.length >= questionCategories.length) throw new ApiError(400, 'Keep at least one daily-question category enabled.');
      await pool.query('UPDATE couples SET disabled_question_categories=$1::text[],updated_at=now() WHERE id=$2', [disabledCategories, coupleId]);
'@
$new = @'
      const disabledCategories = [...new Set(body.disabledCategories as string[])];
      if (disabledCategories.length >= questionCategories.length) throw new ApiError(400, 'Keep at least one daily-question category enabled.');
      const today = new Date().toISOString().slice(0, 10);
      const answeredToday = await pool.query(
        'SELECT 1 FROM question_answers WHERE couple_id=$1 AND answer_date=$2 LIMIT 1',
        [coupleId, today],
      );
      if (answeredToday.rowCount) {
        throw new ApiError(409, 'Question preferences are locked for today once either partner has answered. Change them tomorrow before either of you answers.');
      }
      await pool.query('UPDATE couples SET disabled_question_categories=$1::text[],updated_at=now() WHERE id=$2', [disabledCategories, coupleId]);
'@
Replace-Exact 'server\src\routes\together.ts' $old $new

# 2) Mood support acknowledgement: make it idempotent so repeated taps/reloads
# cannot spam the same partner check-in with duplicate "I'm here" notifications.
$old = @'
      const mood = await pool.query(
        `SELECT id FROM moods WHERE id=$1 AND couple_id=$2 AND user_id<>$3 AND visibility='shared' LIMIT 1`,
        [params.id, coupleId, request.userId],
      );
      if (!mood.rows[0]) throw new ApiError(404, 'That shared check-in is no longer available.');
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'mood', preference: 'notification_partner_mood', entityType: 'mood', entityId: params.id, title: 'I’m here for you', body: 'Your partner saw your check-in and sent some support.' });
      return reply.send({ ok: true });
'@
$new = @'
      const mood = await pool.query(
        `SELECT id,user_id FROM moods WHERE id=$1 AND couple_id=$2 AND user_id<>$3 AND visibility='shared' LIMIT 1`,
        [params.id, coupleId, request.userId],
      );
      if (!mood.rows[0]) throw new ApiError(404, 'That shared check-in is no longer available.');
      const alreadySent = await pool.query(
        `SELECT 1 FROM notifications
         WHERE couple_id=$1 AND recipient_user_id=$2 AND actor_user_id=$3
           AND kind='mood' AND entity_type='mood' AND entity_id=$4
           AND title='I’m here for you'
         LIMIT 1`,
        [coupleId, mood.rows[0].user_id, request.userId, params.id],
      );
      if (!alreadySent.rowCount) {
        await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'mood', preference: 'notification_partner_mood', entityType: 'mood', entityId: params.id, title: 'I’m here for you', body: 'Your partner saw your check-in and sent some support.' });
      }
      return reply.send({ ok: true });
'@
Replace-Exact 'server\src\routes\together.ts' $old $new

# 3) Mood screen: make "Xm ago / Xh ago" update while the screen stays open.
$old = @'
  const [ackBusy, setAckBusy] = useState(false);
  const [acknowledgedId, setAcknowledgedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
'@
$new = @'
  const [ackBusy, setAckBusy] = useState(false);
  const [acknowledgedId, setAcknowledgedId] = useState<string | null>(null);
  const [, setRelativeTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setRelativeTick((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
'@
Replace-Exact 'src\app\features\mood.tsx' $old $new

# 4) Notifications: don't run the whole scheduled-reminder sweep every time
# a realtime feature event arrives. Initial/manual refresh still performs the sweep.
$old = @'
  useEffect(() => realtimeClient.subscribe((event) => {
    if (event.type === 'feature.updated' || event.type === 'workspace.updated' || event.type === 'shared_item.updated') {
      refresh().catch(() => undefined);
    }
  }), [refresh]);
'@
$new = @'
  useEffect(() => realtimeClient.subscribe((event) => {
    if (event.type === 'feature.updated' || event.type === 'workspace.updated' || event.type === 'shared_item.updated') {
      getNotifications()
        .then((result) => {
          setNotifications(result.notifications);
          setUnreadCount(result.unreadCount);
        })
        .catch(() => undefined);
    }
  }), []);
'@
Replace-Exact 'src\app\features\notifications.tsx' $old $new

# 5) Notifications: deleting one notification should update locally instead of
# immediately performing another reminder sweep/network reload.
$old = @'
  async function remove(id: string) {
    try {
      await deleteNotification(id);
      setNotifications((current) => current.filter((entry) => entry.id !== id));
      await refresh();
    } catch (error) { Alert.alert('Couldn’t delete notification', messageFrom(error)); }
  }
'@
$new = @'
  async function remove(id: string) {
    try {
      const target = notifications.find((entry) => entry.id === id);
      await deleteNotification(id);
      setNotifications((current) => current.filter((entry) => entry.id !== id));
      if (target && !target.read_at) setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) { Alert.alert('Couldn’t delete notification', messageFrom(error)); }
  }
'@
Replace-Exact 'src\app\features\notifications.tsx' $old $new

Write-Host ''
Write-Host 'Batch 3 patch applied.' -ForegroundColor Cyan
Write-Host 'Now run:' -ForegroundColor Cyan
Write-Host '  npm run typecheck'
Write-Host '  npm --prefix server run typecheck'
