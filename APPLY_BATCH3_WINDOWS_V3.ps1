
$ErrorActionPreference = 'Stop'

$project = 'C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere'
Set-Location $project

function Read-Utf8([string]$Path) {
    return [System.IO.File]::ReadAllText((Join-Path $project $Path))
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

# 1) DAILY QUESTION SETTINGS
# Safe to skip if v2 already applied this before stopping.
$dailyPattern = [regex]::Escape("      const disabledCategories = [...new Set(body.disabledCategories as string[])];") +
    ".*?" +
    [regex]::Escape("      await pool.query('UPDATE couples SET disabled_question_categories=`$1::text[],updated_at=now() WHERE id=`$2', [disabledCategories, coupleId]);")

$dailyReplacement = @'
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
Replace-RegexOnce 'server\src\routes\together.ts' $dailyPattern $dailyReplacement 'Question preferences are locked for today once either partner has answered.'

# 2) MOOD ACKNOWLEDGEMENT
# Replace the whole endpoint instead of matching the smaller inner snippet.
$moodAckPattern = "  app\.post\('/moods/:id/acknowledge', \{ preHandler: authenticate \}, async \(request, reply\) => \{.*?`n  \}\);`r?`n`r?`n  app\.post\('/moods',"

$moodAckReplacement = @'
  app.post('/moods/:id/acknowledge', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
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
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/moods',
'@
Replace-RegexOnce 'server\src\routes\together.ts' $moodAckPattern $moodAckReplacement "const alreadySent = await pool.query("

# 3) MOOD RELATIVE TIME TICK
$moodUiPattern = [regex]::Escape("  const [ackBusy, setAckBusy] = useState(false);") +
    "\s*" +
    [regex]::Escape("  const [acknowledgedId, setAcknowledgedId] = useState<string | null>(null);")

$moodUiReplacement = @'
  const [ackBusy, setAckBusy] = useState(false);
  const [acknowledgedId, setAcknowledgedId] = useState<string | null>(null);
  const [, setRelativeTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setRelativeTick((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
'@
Replace-RegexOnce 'src\app\features\mood.tsx' $moodUiPattern $moodUiReplacement 'setRelativeTick'

# 4) NOTIFICATIONS REALTIME — inbox refresh only, no reminder sweep.
$notifRealtimePattern = "  useEffect\(\(\) => realtimeClient\.subscribe\(\(event\) => \{.*?\}\), \[refresh\]\);"
$notifRealtimeReplacement = @'
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
Replace-RegexOnce 'src\app\features\notifications.tsx' $notifRealtimePattern $notifRealtimeReplacement 'getNotifications()' 

# Above AlreadyContains is too broad because refresh() also contains getNotifications().
# Verify/repair specifically if the old dependency is still present.
$notifText = Read-Utf8 'src\app\features\notifications.tsx'
if ($notifText.Contains("  }), [refresh]);")) {
    $regex = [regex]::new($notifRealtimePattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if ($regex.Matches($notifText).Count -eq 1) {
        $notifText = $regex.Replace($notifText, $notifRealtimeReplacement, 1)
        Write-Utf8 'src\app\features\notifications.tsx' $notifText
        Write-Host "Patched notifications realtime refresh" -ForegroundColor Green
    }
}

# 5) NOTIFICATION DELETE — local update only.
$removePattern = "  async function remove\(id: string\) \{.*?`n  \}"
$removeReplacement = @'
  async function remove(id: string) {
    try {
      const target = notifications.find((entry) => entry.id === id);
      await deleteNotification(id);
      setNotifications((current) => current.filter((entry) => entry.id !== id));
      if (target && !target.read_at) setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) { Alert.alert('Couldn’t delete notification', messageFrom(error)); }
  }
'@
Replace-RegexOnce 'src\app\features\notifications.tsx' $removePattern $removeReplacement 'const target = notifications.find((entry) => entry.id === id);'

Write-Host ''
Write-Host 'Batch 3 v3 patch complete.' -ForegroundColor Cyan
Write-Host 'Run:'
Write-Host '  npm run typecheck'
Write-Host '  npm --prefix server run typecheck'
