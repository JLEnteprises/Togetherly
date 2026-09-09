const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'I2 — Drawing Performance Hardening';
const MARKER = 'I2_DRAWING_PERFORMANCE_HARDENING';
const root = process.cwd();

function fail(message) {
  console.error(`\n[I2] ${message}`);
  process.exit(1);
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) fail(`Missing expected file: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function sourceWithEol(relativePath) {
  const source = read(relativePath);
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return { source: source.replace(/\r\n/g, '\n'), eol };
}

function restoreEol(source, eol) {
  return eol === '\r\n' ? source.replace(/\n/g, '\r\n') : source;
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Could not find patch anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch anchor is ambiguous: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function guardCompletedPhases() {
  const guards = [
    ['src/components/common/ComposerSheet.tsx', 'G6_COMPOSER_SHEETS'],
    ['server/migrations/018_standalone_photos.sql', 'H1_STANDALONE_PHOTOS_DATA_MODEL'],
    ['src/app/features/photos.tsx', 'H2_STANDALONE_PHOTO_GALLERY'],
    ['server/migrations/019_memory_photo_integration.sql', 'H3_MEMORY_PHOTO_INTEGRATION'],
    ['src/app/features/memories.tsx', 'H3_MEMORY_PHOTO_INTEGRATION'],
    ['src/app/features/scratchpad.tsx', 'I1_FULLSCREEN_SCRATCHPAD_DRAWING'],
    ['src/components/scratchpad/FullscreenScratchpadDrawing.tsx', 'I1_FULLSCREEN_SCRATCHPAD_DRAWING'],
    ['src/components/common/DrawingCanvas.tsx', 'I1_FULLSCREEN_SCRATCHPAD_DRAWING'],
    ['src/components/dashboard/SharedScratchpadCard.tsx', 'I1_FULLSCREEN_SCRATCHPAD_DRAWING'],
  ];

  const failures = [];
  for (const [relativePath, expectedMarker] of guards) {
    const source = read(relativePath).replace(/\r\n/g, '\n');
    if (!source.includes(expectedMarker)) failures.push(`${relativePath} missing ${expectedMarker}`);
  }
  if (failures.length) fail(`Completed-phase guard failed before any I2 write:\n- ${failures.join('\n- ')}`);
}

function prepareDrawingCanvas() {
  const { source, eol } = sourceWithEol('src/components/common/DrawingCanvas.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/components/common/DrawingCanvas.tsx', output: source, eol, write: false };

  let next = source;

  next = replaceOnce(
    next,
    "import { useEffect, useMemo, useRef, useState } from 'react';",
    "import { memo, useEffect, useMemo, useRef, useState } from 'react';",
    'DrawingCanvas memo import',
  );

  next = replaceOnce(
    next,
    `const WIDTHS: Record<BrushSize, number> = { thin: 4, medium: 8, thick: 16 };

function pointPath(points: DrawingStroke['points']) {`,
    `const WIDTHS: Record<BrushSize, number> = { thin: 4, medium: 8, thick: 16 };
const MIN_POINT_DISTANCE = 6;
const SIMPLIFY_DEVIATION = 1.6;
const MAX_STRAIGHT_SEGMENT = 28;

// ${MARKER}: live drawing is sampled/throttled and committed paths are memoized separately.
function pointPath(points: DrawingStroke['points']) {`,
    'DrawingCanvas performance constants',
  );

  next = replaceOnce(
    next,
    `function makeId() {
  return \`stroke-\${Date.now()}-\${Math.random().toString(36).slice(2, 9)}\`;
}`,
    `function distance(a: DrawingStroke['points'][number], b: DrawingStroke['points'][number]) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointToSegmentDistance(
  point: DrawingStroke['points'][number],
  start: DrawingStroke['points'][number],
  end: DrawingStroke['points'][number],
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return distance(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function simplifyPoints(points: DrawingStroke['points']) {
  if (points.length <= 2) return points;

  const simplified: DrawingStroke['points'] = [points[0]!];
  for (let index = 1; index < points.length - 1; index += 1) {
    const anchor = simplified[simplified.length - 1]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const deviation = pointToSegmentDistance(current, anchor, next);
    if (deviation >= SIMPLIFY_DEVIATION || distance(anchor, current) >= MAX_STRAIGHT_SEGMENT) {
      simplified.push(current);
    }
  }
  simplified.push(points[points.length - 1]!);
  return simplified;
}

function makeId() {
  return \`stroke-\${Date.now()}-\${Math.random().toString(36).slice(2, 9)}\`;
}`,
    'DrawingCanvas point simplification helpers',
  );

  next = replaceOnce(
    next,
    `function ColourWheel({ hue, saturation, value, onChange }: { hue: number; saturation: number; value: number; onChange: (next: { hue: number; saturation: number; value: number }) => void }) {`,
    `const CommittedStrokeLayer = memo(function CommittedStrokeLayer({
  strokes,
  strokeColorForUser,
  fallbackColor,
  eraserColor,
}: {
  strokes: DrawingStroke[];
  strokeColorForUser?: (userId: string | undefined) => string;
  fallbackColor: string;
  eraserColor: string;
}) {
  const paths = useMemo(() => strokes.map((stroke) => ({
    id: stroke.id,
    d: pointPath(stroke.points),
    color: stroke.tool === 'eraser' ? eraserColor : stroke.color ?? strokeColorForUser?.(stroke.userId) ?? fallbackColor,
    width: stroke.width ?? 7,
    opacity: stroke.opacity ?? 1,
  })), [eraserColor, fallbackColor, strokeColorForUser, strokes]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <Svg width="100%" height="100%" viewBox={\`0 0 \${SPACE} \${SPACE}\`} preserveAspectRatio="none">
        {paths.map((stroke) => (
          <Path
            key={stroke.id}
            d={stroke.d}
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={stroke.opacity}
          />
        ))}
      </Svg>
    </View>
  );
});

function LiveStrokeLayer({
  stroke,
  strokeColorForUser,
  fallbackColor,
  eraserColor,
}: {
  stroke: DrawingStroke | null;
  strokeColorForUser?: (userId: string | undefined) => string;
  fallbackColor: string;
  eraserColor: string;
}) {
  if (!stroke) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <Svg width="100%" height="100%" viewBox={\`0 0 \${SPACE} \${SPACE}\`} preserveAspectRatio="none">
        <Path
          d={pointPath(stroke.points)}
          stroke={stroke.tool === 'eraser' ? eraserColor : stroke.color ?? strokeColorForUser?.(stroke.userId) ?? fallbackColor}
          strokeWidth={stroke.width ?? 7}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={(stroke.opacity ?? 1) * 0.9}
        />
      </Svg>
    </View>
  );
}

function ColourWheel({ hue, saturation, value, onChange }: { hue: number; saturation: number; value: number; onChange: (next: { hue: number; saturation: number; value: number }) => void }) {`,
    'DrawingCanvas committed/live layers',
  );

  next = replaceOnce(
    next,
    `  const [colourOpen, setColourOpen] = useState(false);
  const sizeRef = useRef(size);
  const draftRef = useRef<DrawingStroke | null>(null);
  sizeRef.current = size;
  draftRef.current = draft;
  const onStrokeRef = useRef(onStroke);
  onStrokeRef.current = onStroke;`,
    `  const [colourOpen, setColourOpen] = useState(false);
  const sizeRef = useRef(size);
  const draftRef = useRef<DrawingStroke | null>(null);
  const draftFrameRef = useRef<number | null>(null);
  sizeRef.current = size;
  const onStrokeRef = useRef(onStroke);
  onStrokeRef.current = onStroke;

  useEffect(() => () => {
    if (draftFrameRef.current !== null) cancelAnimationFrame(draftFrameRef.current);
    setScreenScrollLocked(false);
  }, [setScreenScrollLocked]);

  function scheduleDraftRender() {
    if (draftFrameRef.current !== null) return;
    draftFrameRef.current = requestAnimationFrame(() => {
      draftFrameRef.current = null;
      setDraft(draftRef.current);
    });
  }

  function finishDraft() {
    setScreenScrollLocked(false);
    if (draftFrameRef.current !== null) {
      cancelAnimationFrame(draftFrameRef.current);
      draftFrameRef.current = null;
    }

    const current = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!current?.points.length) return;
    onStrokeRef.current?.({ ...current, points: simplifyPoints(current.points) });
  }`,
    'DrawingCanvas frame throttle refs',
  );

  next = replaceOnce(
    next,
    `      draftRef.current = next;
      setDraft(next);
    },
    onPanResponderMove: (event) => {
      const current = draftRef.current;
      if (!editable || !current) return;
      const point = normalized(event.nativeEvent.locationX, event.nativeEvent.locationY);
      const previous = current.points[current.points.length - 1];
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 5) return;
      const next = { ...current, points: [...current.points, point].slice(-500) };
      draftRef.current = next;
      setDraft(next);
    },
    onPanResponderRelease: () => {
      setScreenScrollLocked(false);
      const current = draftRef.current;
      draftRef.current = null;
      setDraft(null);
      if (current?.points.length) onStrokeRef.current?.(current);
    },
    onPanResponderTerminate: () => {
      setScreenScrollLocked(false);
      const current = draftRef.current;
      draftRef.current = null;
      setDraft(null);
      if (current?.points.length) onStrokeRef.current?.(current);
    },`,
    `      draftRef.current = next;
      setDraft(next);
    },
    onPanResponderMove: (event) => {
      const current = draftRef.current;
      if (!editable || !current) return;
      const point = normalized(event.nativeEvent.locationX, event.nativeEvent.locationY);
      const previous = current.points[current.points.length - 1];
      if (previous && distance(point, previous) < MIN_POINT_DISTANCE) return;

      draftRef.current = { ...current, points: [...current.points, point] };
      scheduleDraftRender();
    },
    onPanResponderRelease: finishDraft,
    onPanResponderTerminate: finishDraft,`,
    'DrawingCanvas sampled throttled gesture',
  );

  next = replaceOnce(
    next,
    `  const renderStroke = (stroke: DrawingStroke, draftStroke = false) => {
    const erasing = stroke.tool === 'eraser';
    return <Path
      key={stroke.id}
      d={pointPath(stroke.points)}
      stroke={erasing ? theme.colors.elevatedBackground : stroke.color ?? strokeColorForUser?.(stroke.userId) ?? theme.colors.accent}
      strokeWidth={stroke.width ?? 7}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={(stroke.opacity ?? 1) * (draftStroke ? 0.9 : 1)}
    />;
  };

`,
    '',
    'DrawingCanvas old per-render stroke renderer',
  );

  next = replaceOnce(
    next,
    `      <Svg width="100%" height="100%" viewBox={\`0 0 \${SPACE} \${SPACE}\`} preserveAspectRatio="none">
        {strokes.map((stroke) => renderStroke(stroke))}
        {draft ? renderStroke(draft, true) : null}
      </Svg>`,
    `      <CommittedStrokeLayer
        strokes={strokes}
        strokeColorForUser={strokeColorForUser}
        fallbackColor={theme.colors.accent}
        eraserColor={theme.colors.elevatedBackground}
      />
      <LiveStrokeLayer
        stroke={draft}
        strokeColorForUser={strokeColorForUser}
        fallbackColor={theme.colors.accent}
        eraserColor={theme.colors.elevatedBackground}
      />`,
    'DrawingCanvas separate committed/live SVG layers',
  );

  return { relativePath: 'src/components/common/DrawingCanvas.tsx', output: next, eol, write: true };
}

function prepareScratchpadCard() {
  const { source, eol } = sourceWithEol('src/components/dashboard/SharedScratchpadCard.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/components/dashboard/SharedScratchpadCard.tsx', output: source, eol, write: false };

  let next = source;

  next = replaceOnce(next,
    "import { useCallback, useEffect, useMemo, useRef, useState } from 'react';",
    "import { useCallback, useEffect, useRef, useState } from 'react';",
    'SharedScratchpad remove useMemo import');

  next = replaceOnce(next,
    `function drawingKey(strokes: DrawingStroke[]) { return JSON.stringify(strokes); }

`, '', 'SharedScratchpad remove full drawing serialization helper');

  next = replaceOnce(next,
    `  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [savedDrawingKey, setSavedDrawingKey] = useState('[]');`,
    `  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [drawingDirty, setDrawingDirty] = useState(false);`,
    'SharedScratchpad drawing dirty state');

  next = replaceOnce(next,
    `    setStrokes(drawing.strokes);
    setSavedDrawingKey(drawingKey(drawing.strokes));
    setRemoteUpdate(false);`,
    `    setStrokes(drawing.strokes);
    setDrawingDirty(false);
    setRemoteUpdate(false);`,
    'SharedScratchpad applyItem dirty reset');

  next = replaceOnce(next,
    `  const currentDrawingKey = useMemo(() => drawingKey(strokes), [strokes]);
  const dirty = body !== savedBody || mode !== savedMode || currentDrawingKey !== savedDrawingKey;
  dirtyRef.current = dirty;`,
    `  // ${MARKER}: dirty state changes only on committed drawing edits; no full-stroke JSON serialization.
  const dirty = body !== savedBody || mode !== savedMode || drawingDirty;
  dirtyRef.current = dirty;`,
    'SharedScratchpad cheap dirty calculation');

  next = replaceOnce(next,
    `  function addStroke(stroke: DrawingStroke) {
    setStrokes((current) => [...current, stroke].slice(-120));
  }

  function undoMine() {
    setStrokes((current) => {
      const next = [...current];
      let index = -1;
      for (let cursor = next.length - 1; cursor >= 0; cursor -= 1) {
        if (!profile?.id || next[cursor]?.userId === profile.id) { index = cursor; break; }
      }
      if (index >= 0) next.splice(index, 1);
      return next;
    });
  }`,
    `  function addStroke(stroke: DrawingStroke) {
    setStrokes((current) => [...current, stroke]);
    setDrawingDirty(true);
  }

  function undoMine() {
    const next = [...strokes];
    let index = -1;
    for (let cursor = next.length - 1; cursor >= 0; cursor -= 1) {
      if (!profile?.id || next[cursor]?.userId === profile.id) { index = cursor; break; }
    }
    if (index < 0) return;
    next.splice(index, 1);
    setStrokes(next);
    setDrawingDirty(true);
  }`,
    'SharedScratchpad remove 120 stroke loss');

  next = replaceOnce(next,
    `{ text: 'Clear drawing', style: 'destructive', onPress: () => setStrokes([]) },`,
    `{ text: 'Clear drawing', style: 'destructive', onPress: () => { setStrokes([]); setDrawingDirty(true); } },`,
    'SharedScratchpad clear dirty state');

  return { relativePath: 'src/components/dashboard/SharedScratchpadCard.tsx', output: next, eol, write: true };
}

function audit() {
  const canvas = read('src/components/common/DrawingCanvas.tsx').replace(/\r\n/g, '\n');
  const card = read('src/components/dashboard/SharedScratchpadCard.tsx').replace(/\r\n/g, '\n');
  const fullscreen = read('src/components/scratchpad/FullscreenScratchpadDrawing.tsx').replace(/\r\n/g, '\n');
  const failures = [];

  if (!canvas.includes(MARKER)) failures.push('DrawingCanvas I2 marker missing');
  for (const required of ['CommittedStrokeLayer','LiveStrokeLayer','requestAnimationFrame','scheduleDraftRender','simplifyPoints','MIN_POINT_DISTANCE','SIMPLIFY_DEVIATION']) {
    if (!canvas.includes(required)) failures.push(`DrawingCanvas missing ${required}`);
  }
  if (canvas.includes('points: [...current.points, point].slice(-500)')) failures.push('Per-stroke silent point cap still active');
  if (canvas.includes('strokes.map((stroke) => renderStroke(stroke))')) failures.push('Committed strokes still rebuilt in live parent render');
  if (!canvas.includes('const CommittedStrokeLayer = memo(')) failures.push('Committed stroke layer is not memoized');
  if (!canvas.includes('onPanResponderRelease: finishDraft')) failures.push('Final simplified stroke commit missing');

  if (!card.includes(MARKER)) failures.push('SharedScratchpadCard I2 marker missing');
  if (card.includes('JSON.stringify(strokes)') || card.includes('drawingKey(')) failures.push('Full drawing serialization still used for dirty state');
  if (card.includes('.slice(-120)')) failures.push('120-stroke disappearing behavior still active');
  if (!card.includes('setDrawingDirty(true)')) failures.push('Cheap mutation-based dirty tracking missing');

  for (const collaboration of ['usePartnerPresence','remoteUpdate','updatedAt: item?.updated_at ?? null','<FullscreenScratchpadDrawing']) {
    if (!card.includes(collaboration)) failures.push(`Collaboration/fullscreen regression: ${collaboration}`);
  }
  if (!fullscreen.includes('I1_FULLSCREEN_SCRATCHPAD_DRAWING')) failures.push('I1 fullscreen workspace marker missing after I2');

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[I2] ${label}`);
  let result;
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const command = ['npm.cmd', ...args].join(' ');
    result = spawnSync(comspec, ['/d', '/s', '/c', command], { cwd: root, stdio: 'inherit' });
  } else {
    result = spawnSync('npm', args, { cwd: root, stdio: 'inherit' });
  }
  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}. Source changes have been left in place for a targeted repair if needed.`);
}

console.log(`\n=== Togetherly ${RELEASE} ===`);
console.log(`[I2] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

guardCompletedPhases();

let pending;
try {
  pending = [prepareDrawingCanvas(), prepareScratchpadCard()];
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

for (const item of pending) {
  if (!item.write) {
    console.log(`[I2] ${item.relativePath}: already ready`);
    continue;
  }
  fs.writeFileSync(path.join(root, item.relativePath), restoreEol(item.output, item.eol), 'utf8');
  console.log(`[I2] ${item.relativePath}: ready`);
}

console.log('\n[I2] Source audit');
audit();
console.log('[I2] Source audit passed.');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  runNpm(['run', 'typecheck'], 'Client typecheck');
  runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
  runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic');
}

console.log('\n[I2] ALL VALIDATIONS PASSED');
console.log('[I2] No migration or dependency changes.');
