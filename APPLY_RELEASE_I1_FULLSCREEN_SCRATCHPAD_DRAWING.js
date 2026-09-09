const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'I1 — Fullscreen Scratchpad Drawing';
const MARKER = 'I1_FULLSCREEN_SCRATCHPAD_DRAWING';
const root = process.cwd();

const fullscreenSource = "import { Modal, View, useWindowDimensions } from 'react-native';\nimport { SafeAreaView } from 'react-native-safe-area-context';\nimport { AppButton } from '@/components/common/AppButton';\nimport { AppText } from '@/components/common/AppText';\nimport { DrawingCanvas } from '@/components/common/DrawingCanvas';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport type { DrawingStroke } from '@/types/database';\n\n// I1_FULLSCREEN_SCRATCHPAD_DRAWING: fullscreen is another view of the same in-memory shared scratchpad draft, not a second scratchpad.\nexport function FullscreenScratchpadDrawing({\n  visible,\n  strokes,\n  currentUserId,\n  partnerName,\n  partnerInScratchpad,\n  partnerSameMode,\n  saving,\n  loading,\n  dirty,\n  remoteUpdate,\n  onClose,\n  onSave,\n  onReloadLatest,\n  onStroke,\n  onUndoMine,\n  onClear,\n  strokeColorForUser,\n}: {\n  visible: boolean;\n  strokes: DrawingStroke[];\n  currentUserId?: string;\n  partnerName: string;\n  partnerInScratchpad: boolean;\n  partnerSameMode: boolean;\n  saving: boolean;\n  loading: boolean;\n  dirty: boolean;\n  remoteUpdate: boolean;\n  onClose: () => void;\n  onSave: () => void | Promise<void>;\n  onReloadLatest: () => void;\n  onStroke: (stroke: DrawingStroke) => void;\n  onUndoMine: () => void;\n  onClear: () => void;\n  strokeColorForUser: (userId: string | undefined) => string;\n}) {\n  const theme = useAppTheme();\n  const { height } = useWindowDimensions();\n  const canvasHeight = Math.max(300, height - (remoteUpdate ? 265 : 215));\n\n  const presenceLabel = partnerSameMode\n    ? `${partnerName} is drawing here too`\n    : partnerInScratchpad\n      ? `${partnerName} is in the scratchpad`\n      : 'Only you are here right now';\n\n  return (\n    <Modal\n      visible={visible}\n      animationType={theme.reducedMotion ? 'none' : 'fade'}\n      presentationStyle=\"fullScreen\"\n      onRequestClose={onClose}\n      statusBarTranslucent\n    >\n      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right', 'bottom']}>\n        <View style={{ flex: 1, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm, gap: theme.spacing.sm }}>\n          <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>\n            <AppButton compact variant=\"ghost\" label=\"Close\" onPress={onClose} />\n\n            <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>\n              <AppText variant=\"caption\" tone={partnerSameMode ? 'accent' : 'muted'} numberOfLines={1}>\n                {partnerSameMode ? 'YOU’RE BOTH HERE' : partnerInScratchpad ? 'PARTNER IS HERE' : 'SHARED DRAWING'}\n              </AppText>\n              <AppText variant=\"bodySmall\" tone=\"secondary\" numberOfLines={1}>{presenceLabel}</AppText>\n            </View>\n\n            <AppButton\n              compact\n              label={saving ? 'Saving…' : 'Save'}\n              disabled={saving || loading || !dirty || remoteUpdate}\n              onPress={onSave}\n            />\n          </View>\n\n          {remoteUpdate ? (\n            <View\n              style={{\n                gap: 6,\n                padding: theme.spacing.sm,\n                borderRadius: theme.radii.md,\n                borderWidth: 1,\n                borderColor: theme.colors.warning,\n                backgroundColor: theme.colors.elevatedBackground,\n              }}\n            >\n              <AppText variant=\"bodySmall\" style={{ color: theme.colors.warning, fontWeight: '700' }}>\n                Your partner changed this while you were drawing.\n              </AppText>\n              <AppText variant=\"caption\" tone=\"muted\">\n                Your draft is still here. Saving is paused so neither version is silently overwritten.\n              </AppText>\n              <View style={{ alignSelf: 'flex-start' }}>\n                <AppButton compact variant=\"secondary\" label=\"Reload latest\" onPress={onReloadLatest} />\n              </View>\n            </View>\n          ) : null}\n\n          <View style={{ flex: 1, justifyContent: 'center' }}>\n            <DrawingCanvas\n              strokes={strokes}\n              currentUserId={currentUserId}\n              height={canvasHeight}\n              showTools\n              compactTools\n              onStroke={onStroke}\n              strokeColorForUser={strokeColorForUser}\n            />\n          </View>\n\n          <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm }}>\n            <View style={{ flexDirection: 'row', gap: 8 }}>\n              <AppButton compact variant=\"ghost\" label=\"Undo mine\" disabled={!strokes.length || saving} onPress={onUndoMine} />\n              <AppButton compact variant=\"ghost\" label=\"Clear\" disabled={!strokes.length || saving} onPress={onClear} />\n            </View>\n            <AppText variant=\"caption\" tone={remoteUpdate ? 'muted' : dirty ? 'accent' : 'muted'}>\n              {remoteUpdate ? 'Newer version available' : dirty ? 'Unsaved' : 'Saved'}\n            </AppText>\n          </View>\n        </View>\n      </SafeAreaView>\n    </Modal>\n  );\n}\n";

function fail(message) {
  console.error(`\n[I1] ${message}`);
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
    ['src/app/(tabs)/us.tsx', 'G5_US_STORY_CONSOLIDATION'],
    ['src/components/common/ComposerSheet.tsx', 'G6_COMPOSER_SHEETS'],
    ['server/migrations/018_standalone_photos.sql', 'H1_STANDALONE_PHOTOS_DATA_MODEL'],
    ['src/app/features/photos.tsx', 'H2_STANDALONE_PHOTO_GALLERY'],
    ['server/migrations/019_memory_photo_integration.sql', 'H3_MEMORY_PHOTO_INTEGRATION'],
    ['server/src/routes/memoryPhotos.ts', 'H3_MEMORY_PHOTO_INTEGRATION'],
    ['src/app/features/memories.tsx', 'H3_MEMORY_PHOTO_INTEGRATION'],
  ];

  const failures = [];
  for (const [relativePath, expectedMarker] of guards) {
    const source = read(relativePath).replace(/\r\n/g, '\n');
    if (!source.includes(expectedMarker)) failures.push(`${relativePath} missing ${expectedMarker}`);
  }

  if (failures.length) fail(`Completed-phase guard failed before any I1 write:\n- ${failures.join('\n- ')}`);
}

function prepareNewFile(relativePath, output, preferredEol) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return { relativePath, output, eol: preferredEol, write: true };

  const raw = fs.readFileSync(fullPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const source = raw.replace(/\r\n/g, '\n');

  if (!source.includes(MARKER)) {
    throw new Error(`${relativePath} already exists without the I1 marker; refusing to overwrite unrelated work.`);
  }
  return { relativePath, output: source, eol, write: false };
}

function prepareDrawingCanvas() {
  const { source, eol } = sourceWithEol('src/components/common/DrawingCanvas.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/components/common/DrawingCanvas.tsx', output: source, eol, write: false };

  let next = source;

  next = replaceOnce(
    next,
    `  onStroke,
  showTools = false,
}: {
  strokes: DrawingStroke[];
  currentUserId?: string;
  editable?: boolean;
  height?: number;
  strokeColorForUser?: (userId: string | undefined) => string;
  onStroke?: (stroke: DrawingStroke) => void;
  showTools?: boolean;
}) {`,
    `  onStroke,
  showTools = false,
  compactTools = false,
}: {
  strokes: DrawingStroke[];
  currentUserId?: string;
  editable?: boolean;
  height?: number;
  strokeColorForUser?: (userId: string | undefined) => string;
  onStroke?: (stroke: DrawingStroke) => void;
  showTools?: boolean;
  compactTools?: boolean;
}) {
  // ${MARKER}: fullscreen drawing can use a compact brush/size/colour toolbar without changing stroke behavior.`,
    'DrawingCanvas compactTools prop',
  );

  next = replaceOnce(
    next,
    `  const [colour, setColour] = useState({ hue: 285, saturation: 0.75, value: 1 });
  const sizeRef = useRef(size);`,
    `  const [colour, setColour] = useState({ hue: 285, saturation: 0.75, value: 1 });
  const [colourOpen, setColourOpen] = useState(false);
  const sizeRef = useRef(size);`,
    'DrawingCanvas compact colour state',
  );

  next = replaceOnce(
    next,
    `  const sizeButton = (value: BrushSize, label: string) => <Pressable accessibilityRole="button" accessibilityState={{ selected: brushSize === value }} onPress={() => setBrushSize(value)} style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 11, borderRadius: theme.radii.md, borderWidth: 1, borderColor: brushSize === value ? theme.colors.secondaryAccent : theme.colors.border, backgroundColor: brushSize === value ? theme.colors.secondarySoft : theme.colors.elevatedBackground, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}><AppText variant="bodySmall">{label}</AppText></Pressable>;

  return <View style={{ gap: showTools && editable ? theme.spacing.md : 0 }}>
    {showTools && editable ? <View style={{ gap: theme.spacing.sm }}>
      <ColourWheel hue={colour.hue} saturation={colour.saturation} value={colour.value} onChange={setColour} />
      <View style={{ gap: 7 }}><AppText variant="caption" tone="secondary">BRUSH</AppText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{toolButton('pen', 'Pen')}{toolButton('marker', 'Marker')}{toolButton('highlighter', 'Highlighter')}{toolButton('eraser', 'Eraser')}</View></View>
      <View style={{ gap: 7 }}><AppText variant="caption" tone="secondary">SIZE</AppText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{sizeButton('thin', 'Thin')}{sizeButton('medium', 'Medium')}{sizeButton('thick', 'Thick')}</View></View>
    </View> : null}`,
    `  const sizeButton = (value: BrushSize, label: string) => <Pressable accessibilityRole="button" accessibilityState={{ selected: brushSize === value }} onPress={() => setBrushSize(value)} style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 11, borderRadius: theme.radii.md, borderWidth: 1, borderColor: brushSize === value ? theme.colors.secondaryAccent : theme.colors.border, backgroundColor: brushSize === value ? theme.colors.secondarySoft : theme.colors.elevatedBackground, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}><AppText variant="bodySmall">{label}</AppText></Pressable>;
  const compactToolButton = (value: BrushTool, label: string) => <Pressable accessibilityRole="button" accessibilityState={{ selected: tool === value }} onPress={() => setTool(value)} style={({ pressed }) => ({ minHeight: 34, paddingHorizontal: 9, borderRadius: theme.radii.md, borderWidth: 1, borderColor: tool === value ? theme.colors.accent : theme.colors.border, backgroundColor: tool === value ? theme.colors.accentSoft : theme.colors.elevatedBackground, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}><AppText variant="bodySmall">{label}</AppText></Pressable>;
  const cycleSize = () => setBrushSize((current) => current === 'thin' ? 'medium' : current === 'medium' ? 'thick' : 'thin');
  const compactSizeLabel = brushSize === 'thin' ? 'S' : brushSize === 'medium' ? 'M' : 'L';

  return <View style={{ gap: showTools && editable ? theme.spacing.sm : 0 }}>
    {showTools && editable ? compactTools ? (
      <View style={{ position: 'relative', zIndex: 4 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {compactToolButton('pen', 'Pen')}
          {compactToolButton('marker', 'Marker')}
          {compactToolButton('highlighter', 'Highlighter')}
          {compactToolButton('eraser', 'Eraser')}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={\`Brush size \${brushSize}. Tap to change.\`}
            onPress={cycleSize}
            style={({ pressed }) => ({
              minHeight: 34,
              paddingHorizontal: 10,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.elevatedBackground,
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <AppText variant="bodySmall">Size {compactSizeLabel}</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose drawing colour"
            accessibilityState={{ expanded: colourOpen }}
            onPress={() => setColourOpen((value) => !value)}
            style={({ pressed }) => ({
              minHeight: 34,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: colourOpen ? theme.colors.accent : theme.colors.border,
              backgroundColor: theme.colors.elevatedBackground,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: hsvToHex(colour.hue, colour.saturation, colour.value), borderWidth: 1, borderColor: theme.colors.border }} />
            <AppText variant="bodySmall">Colour</AppText>
          </Pressable>
        </View>

        {colourOpen ? (
          <View style={{ position: 'absolute', top: 42, left: 0, right: 0, zIndex: 20, padding: theme.spacing.md, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card }}>
            <ColourWheel hue={colour.hue} saturation={colour.saturation} value={colour.value} onChange={setColour} />
          </View>
        ) : null}
      </View>
    ) : (
      <View style={{ gap: theme.spacing.sm }}>
        <ColourWheel hue={colour.hue} saturation={colour.saturation} value={colour.value} onChange={setColour} />
        <View style={{ gap: 7 }}><AppText variant="caption" tone="secondary">BRUSH</AppText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{toolButton('pen', 'Pen')}{toolButton('marker', 'Marker')}{toolButton('highlighter', 'Highlighter')}{toolButton('eraser', 'Eraser')}</View></View>
        <View style={{ gap: 7 }}><AppText variant="caption" tone="secondary">SIZE</AppText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{sizeButton('thin', 'Thin')}{sizeButton('medium', 'Medium')}{sizeButton('thick', 'Thick')}</View></View>
      </View>
    ) : null}`,
    'DrawingCanvas compact toolbar',
  );

  return { relativePath: 'src/components/common/DrawingCanvas.tsx', output: next, eol, write: true };
}

function prepareScratchpadCard() {
  const { source, eol } = sourceWithEol('src/components/dashboard/SharedScratchpadCard.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/components/dashboard/SharedScratchpadCard.tsx', output: source, eol, write: false };

  let next = source;

  next = replaceOnce(
    next,
    "import { GentleFloat } from '@/components/motion/Motion';\n",
    "import { GentleFloat } from '@/components/motion/Motion';\nimport { FullscreenScratchpadDrawing } from '@/components/scratchpad/FullscreenScratchpadDrawing';\n",
    'SharedScratchpad fullscreen import',
  );

  next = replaceOnce(
    next,
    `  const [remoteUpdate, setRemoteUpdate] = useState(false);
  const [expanded, setExpanded] = useState(!compact);
  const dirtyRef = useRef(false);`,
    `  const [remoteUpdate, setRemoteUpdate] = useState(false);
  const [expanded, setExpanded] = useState(!compact);
  const [fullscreenDrawing, setFullscreenDrawing] = useState(false);
  const dirtyRef = useRef(false);`,
    'SharedScratchpad fullscreen state',
  );

  next = replaceOnce(
    next,
    '                <AppButton compact variant="ghost" label="Clear all" disabled={!strokes.length || saving} onPress={clearDrawing} />',
    '                <AppButton compact variant="ghost" label="Clear all" disabled={!strokes.length || saving} onPress={clearDrawing} />\n                {!compact ? <AppButton compact variant="secondary" label="Full screen" onPress={() => setFullscreenDrawing(true)} /> : null}',
    'SharedScratchpad fullscreen launcher',
  );

  next = replaceOnce(
    next,
    `  return (
    <Card participantColor={compact ? 'both' : item ? ownerColor : 'both'} style={{ gap: theme.spacing.md }}>`,
    `  // ${MARKER}: fullscreen drawing shares this exact draft/save/conflict/presence state.
  return (
    <>
    <Card participantColor={compact ? 'both' : item ? ownerColor : 'both'} style={{ gap: theme.spacing.md }}>`,
    'SharedScratchpad return fragment',
  );

  next = replaceOnce(
    next,
    `    </Card>
  );
}`,
    `    </Card>

    <FullscreenScratchpadDrawing
      visible={fullscreenDrawing && mode === 'draw'}
      strokes={strokes}
      currentUserId={profile?.id}
      partnerName={partnerName}
      partnerInScratchpad={partnerInScratchpad}
      partnerSameMode={partnerSameMode}
      saving={saving}
      loading={loading}
      dirty={dirty}
      remoteUpdate={remoteUpdate}
      onClose={() => setFullscreenDrawing(false)}
      onSave={save}
      onReloadLatest={reloadLatest}
      onStroke={addStroke}
      onUndoMine={undoMine}
      onClear={clearDrawing}
      strokeColorForUser={(userId) => {
        const participant = colorForUser(userId);
        return participant === 'both' ? theme.colors.accent : participantPalette(participant).accent;
      }}
    />
    </>
  );
}`,
    'SharedScratchpad fullscreen workspace mount',
  );

  return { relativePath: 'src/components/dashboard/SharedScratchpadCard.tsx', output: next, eol, write: true };
}

function prepareScratchpadScreen() {
  const { source, eol } = sourceWithEol('src/app/features/scratchpad.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/app/features/scratchpad.tsx', output: source, eol, write: false };

  const next = replaceOnce(
    source,
    `export default function ScratchpadScreen() {
  return (
    <AppScreen>
      <BackHeader eyebrow="Notes" title="Shared scratchpad" subtitle="A quick note or sketch for the two of you." />`,
    `// ${MARKER}: Draw mode now exposes a genuine fullscreen workspace while keeping the same shared item.
export default function ScratchpadScreen() {
  return (
    <AppScreen>
      <BackHeader eyebrow="Notes" title="Shared scratchpad" subtitle="Write together, or switch to Draw for a fullscreen canvas." />`,
    'Scratchpad screen fullscreen hint',
  );

  return { relativePath: 'src/app/features/scratchpad.tsx', output: next, eol, write: true };
}

function audit() {
  const screen = read('src/app/features/scratchpad.tsx').replace(/\r\n/g, '\n');
  const card = read('src/components/dashboard/SharedScratchpadCard.tsx').replace(/\r\n/g, '\n');
  const canvas = read('src/components/common/DrawingCanvas.tsx').replace(/\r\n/g, '\n');
  const fullscreen = read('src/components/scratchpad/FullscreenScratchpadDrawing.tsx').replace(/\r\n/g, '\n');
  const failures = [];

  if (!screen.includes(MARKER) || !screen.includes('fullscreen canvas')) failures.push('Scratchpad I1 hint/marker missing');

  if (!card.includes(MARKER)) failures.push('SharedScratchpadCard I1 marker missing');
  if (!card.includes('label="Full screen"')) failures.push('Draw-mode Full screen button missing');
  if (!card.includes('<FullscreenScratchpadDrawing')) failures.push('Fullscreen workspace not mounted from shared state');
  for (const preserved of ['partnerInScratchpad', 'partnerSameMode', 'remoteUpdate={remoteUpdate}', 'onSave={save}', 'onStroke={addStroke}', 'onUndoMine={undoMine}', 'onClear={clearDrawing}']) {
    if (!card.includes(preserved)) failures.push(`Fullscreen shared-state handoff missing ${preserved}`);
  }

  if (!canvas.includes(MARKER) || !canvas.includes('compactTools?: boolean')) failures.push('DrawingCanvas compact-tools API missing');
  for (const tool of ["compactToolButton('pen'", "compactToolButton('marker'", "compactToolButton('highlighter'", "compactToolButton('eraser'", 'Size {compactSizeLabel}', 'Choose drawing colour']) {
    if (!canvas.includes(tool)) failures.push(`Compact DrawingCanvas control missing ${tool}`);
  }

  if (!fullscreen.includes(MARKER)) failures.push('FullscreenScratchpadDrawing marker missing');
  if (!fullscreen.includes('presentationStyle="fullScreen"')) failures.push('Fullscreen modal presentation missing');
  if (!fullscreen.includes('<DrawingCanvas') || !fullscreen.includes('compactTools')) failures.push('Fullscreen canvas/compact toolbar missing');
  if (!fullscreen.includes('label="Undo mine"') || !fullscreen.includes('label="Clear"') || !fullscreen.includes("label={saving ? 'Saving…' : 'Save'}")) {
    failures.push('Fullscreen minimal actions missing');
  }
  if (!fullscreen.includes('partnerSameMode') || !fullscreen.includes('remoteUpdate')) failures.push('Presence/conflict UI missing in fullscreen');

  // I1 must deliberately leave I2 performance work for the next phase.
  if (!card.includes('setStrokes((current) => [...current, stroke].slice(-120));')) failures.push('I1 unexpectedly changed the I2 stroke-limit baseline');
  if (!card.includes('function drawingKey(strokes: DrawingStroke[]) { return JSON.stringify(strokes); }')) failures.push('I1 unexpectedly changed the I2 serialization baseline');
  if (!canvas.includes('setDraft(next);') || !canvas.includes('strokes.map((stroke) => renderStroke(stroke))')) failures.push('I1 unexpectedly changed I2 rendering behavior');

  if (!read('src/app/features/memories.tsx').includes('H3_MEMORY_PHOTO_INTEGRATION')) failures.push('H3 marker missing after I1');

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[I1] ${label}`);
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
console.log(`[I1] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

guardCompletedPhases();

let pending;
try {
  const screen = prepareScratchpadScreen();
  const card = prepareScratchpadCard();
  const canvas = prepareDrawingCanvas();
  pending = [
    screen,
    card,
    canvas,
    prepareNewFile('src/components/scratchpad/FullscreenScratchpadDrawing.tsx', fullscreenSource, card.eol),
  ];
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

// Every modified output is prepared before the first source write.
for (const item of pending) {
  if (!item.write) {
    console.log(`[I1] ${item.relativePath}: already ready`);
    continue;
  }

  const fullPath = path.join(root, item.relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, restoreEol(item.output, item.eol), 'utf8');
  console.log(`[I1] ${item.relativePath}: ready`);
}

console.log('\n[I1] Source audit');
audit();
console.log('[I1] Source audit passed.');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  runNpm(['run', 'typecheck'], 'Client typecheck');
  runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
  runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic');
}

console.log('\n[I1] ALL VALIDATIONS PASSED');
console.log('[I1] No migration or dependency changes. I2 remains responsible for drawing performance hardening.');
