import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { DrawingStroke } from '@/types/database';
import { AppText } from '@/components/common/AppText';
import { useAppScreenScrollLock } from '@/components/common/AppScreen';
import { useAppTheme } from '@/theme/useAppTheme';

const SPACE = 1000;
const HUE_SEGMENTS = 48;

type BrushTool = 'pen' | 'marker' | 'highlighter' | 'eraser';
type BrushSize = 'thin' | 'medium' | 'thick';

const WIDTHS: Record<BrushSize, number> = { thin: 4, medium: 8, thick: 16 };

function pointPath(points: DrawingStroke['points']) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y} l 0.1 0.1`;
  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]!;
    const next = points[index + 1]!;
    path += ` Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
  }
  const last = points[points.length - 1]!;
  path += ` L ${last.x} ${last.y}`;
  return path;
}

function makeId() {
  return `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function hsvToHex(h: number, s = 1, v = 1) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0; let g = 0; let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function arcWedgePath(cx: number, cy: number, inner: number, outer: number, start: number, end: number) {
  const o1 = polarPoint(cx, cy, outer, start);
  const o2 = polarPoint(cx, cy, outer, end);
  const i2 = polarPoint(cx, cy, inner, end);
  const i1 = polarPoint(cx, cy, inner, start);
  return `M ${o1.x} ${o1.y} A ${outer} ${outer} 0 0 1 ${o2.x} ${o2.y} L ${i2.x} ${i2.y} A ${inner} ${inner} 0 0 0 ${i1.x} ${i1.y} Z`;
}

function ColourWheel({ hue, saturation, value, onChange }: { hue: number; saturation: number; value: number; onChange: (next: { hue: number; saturation: number; value: number }) => void }) {
  const theme = useAppTheme();
  const setScreenScrollLocked = useAppScreenScrollLock();
  useEffect(() => () => setScreenScrollLocked(false), [setScreenScrollLocked]);
  const size = 154;
  const center = size / 2;
  const outer = 71;
  const inner = 48;
  const hueResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => { setScreenScrollLocked(true); pickHue(event.nativeEvent.locationX, event.nativeEvent.locationY); },
    onPanResponderMove: (event) => pickHue(event.nativeEvent.locationX, event.nativeEvent.locationY),
    onPanResponderRelease: () => setScreenScrollLocked(false),
    onPanResponderTerminate: () => setScreenScrollLocked(false),
  }), [saturation, setScreenScrollLocked, value]);

  function pickHue(x: number, y: number) {
    const dx = x - center;
    const dy = y - center;
    let nextHue = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    if (nextHue < 0) nextHue += 360;
    onChange({ hue: nextHue, saturation, value });
  }

  const saturationChoices = [0.25, 0.5, 0.75, 1];
  const valueChoices = [1, 0.82, 0.64, 0.46];
  const selected = hsvToHex(hue, saturation, value);

  return <View style={{ gap: theme.spacing.sm }}>
    <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center', flexWrap: 'wrap' }}>
      <View {...hueResponder.panHandlers} style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {Array.from({ length: HUE_SEGMENTS }, (_, index) => {
            const start = index * 360 / HUE_SEGMENTS;
            const end = (index + 1) * 360 / HUE_SEGMENTS + 0.5;
            return <Path key={index} d={arcWedgePath(center, center, inner, outer, start, end)} fill={hsvToHex(start)} />;
          })}
          <Circle cx={center} cy={center} r={35} fill={selected} stroke={theme.colors.border} strokeWidth={2} />
          <Circle cx={center} cy={center} r={13} fill={selected} stroke="#ffffff" strokeWidth={3} />
        </Svg>
      </View>
      <View style={{ flex: 1, minWidth: 138, gap: theme.spacing.sm }}>
        <AppText variant="caption" tone="secondary">COLOUR WHEEL</AppText>
        <AppText variant="bodySmall" tone="muted">Pick a hue, then tune colour strength and shade.</AppText>
        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="muted">SATURATION</AppText>
          <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>{saturationChoices.map((choice) => <Pressable key={choice} accessibilityRole="button" accessibilityLabel={`Saturation ${Math.round(choice * 100)} percent`} onPress={() => onChange({ hue, saturation: choice, value })} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: hsvToHex(hue, choice, value), borderWidth: saturation === choice ? 3 : 1, borderColor: saturation === choice ? theme.colors.textPrimary : theme.colors.border }} />)}</View>
        </View>
        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="muted">SHADE</AppText>
          <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>{valueChoices.map((choice) => <Pressable key={choice} accessibilityRole="button" accessibilityLabel={`Brightness ${Math.round(choice * 100)} percent`} onPress={() => onChange({ hue, saturation, value: choice })} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: hsvToHex(hue, saturation, choice), borderWidth: value === choice ? 3 : 1, borderColor: value === choice ? theme.colors.textPrimary : theme.colors.border }} />)}</View>
        </View>
      </View>
    </View>
  </View>;
}

export function DrawingCanvas({
  strokes,
  currentUserId,
  editable = true,
  height = 280,
  strokeColorForUser,
  onStroke,
  showTools = false,
}: {
  strokes: DrawingStroke[];
  currentUserId?: string;
  editable?: boolean;
  height?: number;
  strokeColorForUser?: (userId: string | undefined) => string;
  onStroke?: (stroke: DrawingStroke) => void;
  showTools?: boolean;
}) {
  const theme = useAppTheme();
  const setScreenScrollLocked = useAppScreenScrollLock();
  useEffect(() => () => setScreenScrollLocked(false), [setScreenScrollLocked]);
  const [size, setSize] = useState({ width: 1, height });
  const [draft, setDraft] = useState<DrawingStroke | null>(null);
  const [tool, setTool] = useState<BrushTool>('pen');
  const [brushSize, setBrushSize] = useState<BrushSize>('medium');
  const [colour, setColour] = useState({ hue: 285, saturation: 0.75, value: 1 });
  const sizeRef = useRef(size);
  const draftRef = useRef<DrawingStroke | null>(null);
  sizeRef.current = size;
  draftRef.current = draft;
  const onStrokeRef = useRef(onStroke);
  onStrokeRef.current = onStroke;

  function normalized(locationX: number, locationY: number) {
    return {
      x: Math.max(0, Math.min(SPACE, (locationX / Math.max(1, sizeRef.current.width)) * SPACE)),
      y: Math.max(0, Math.min(SPACE, (locationY / Math.max(1, sizeRef.current.height)) * SPACE)),
    };
  }

  const panResponder = useMemo(() => PanResponder.create({
    // Capture the touch at the canvas boundary so a parent ScrollView cannot steal a drawing gesture.
    onStartShouldSetPanResponderCapture: () => editable,
    onMoveShouldSetPanResponderCapture: () => editable,
    onStartShouldSetPanResponder: () => editable,
    onMoveShouldSetPanResponder: () => editable,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      if (!editable) return;
      setScreenScrollLocked(true);
      const point = normalized(event.nativeEvent.locationX, event.nativeEvent.locationY);
      const selectedWidth = showTools ? (tool === 'marker' ? Math.max(12, WIDTHS[brushSize] * 1.5) : tool === 'highlighter' ? Math.max(22, WIDTHS[brushSize] * 2.4) : WIDTHS[brushSize]) : 7;
      const next = {
        id: makeId(),
        userId: currentUserId,
        width: selectedWidth,
        ...(showTools ? {
          color: hsvToHex(colour.hue, colour.saturation, colour.value),
          opacity: tool === 'highlighter' ? 0.3 : tool === 'marker' ? 0.82 : 1,
          tool,
        } : {}),
        points: [point],
      } satisfies DrawingStroke;
      draftRef.current = next;
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
    },
  }), [brushSize, colour.hue, colour.saturation, colour.value, currentUserId, editable, setScreenScrollLocked, showTools, tool]);

  function onLayout(event: LayoutChangeEvent) {
    const next = { width: Math.max(1, event.nativeEvent.layout.width), height: Math.max(1, event.nativeEvent.layout.height) };
    sizeRef.current = next;
    setSize(next);
  }

  const renderStroke = (stroke: DrawingStroke, draftStroke = false) => {
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

  const toolButton = (value: BrushTool, label: string) => <Pressable accessibilityRole="button" accessibilityState={{ selected: tool === value }} onPress={() => setTool(value)} style={({ pressed }) => ({ minHeight: 38, paddingHorizontal: 12, borderRadius: theme.radii.md, borderWidth: 1, borderColor: tool === value ? theme.colors.accent : theme.colors.border, backgroundColor: tool === value ? theme.colors.accentSoft : theme.colors.elevatedBackground, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}><AppText variant="button">{label}</AppText></Pressable>;
  const sizeButton = (value: BrushSize, label: string) => <Pressable accessibilityRole="button" accessibilityState={{ selected: brushSize === value }} onPress={() => setBrushSize(value)} style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 11, borderRadius: theme.radii.md, borderWidth: 1, borderColor: brushSize === value ? theme.colors.secondaryAccent : theme.colors.border, backgroundColor: brushSize === value ? theme.colors.secondarySoft : theme.colors.elevatedBackground, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}><AppText variant="bodySmall">{label}</AppText></Pressable>;

  return <View style={{ gap: showTools && editable ? theme.spacing.md : 0 }}>
    {showTools && editable ? <View style={{ gap: theme.spacing.sm }}>
      <ColourWheel hue={colour.hue} saturation={colour.saturation} value={colour.value} onChange={setColour} />
      <View style={{ gap: 7 }}><AppText variant="caption" tone="secondary">BRUSH</AppText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{toolButton('pen', 'Pen')}{toolButton('marker', 'Marker')}{toolButton('highlighter', 'Highlighter')}{toolButton('eraser', 'Eraser')}</View></View>
      <View style={{ gap: 7 }}><AppText variant="caption" tone="secondary">SIZE</AppText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{sizeButton('thin', 'Thin')}{sizeButton('medium', 'Medium')}{sizeButton('thick', 'Thick')}</View></View>
    </View> : null}
    <View
      accessibilityRole="image"
      accessibilityLabel={editable ? 'Shared drawing canvas. Drag a finger or mouse to draw.' : 'Drawing preview'}
      onLayout={onLayout}
      {...(editable ? panResponder.panHandlers : {})}
      style={{
        height,
        width: '100%',
        overflow: 'hidden',
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: draft ? theme.colors.accent : theme.colors.border,
        backgroundColor: theme.colors.elevatedBackground,
      }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${SPACE} ${SPACE}`} preserveAspectRatio="none">
        {strokes.map((stroke) => renderStroke(stroke))}
        {draft ? renderStroke(draft, true) : null}
      </Svg>
    </View>
  </View>;
}

export function DrawnIcon({ strokes, size = 22, color }: { strokes: DrawingStroke[]; size?: number; color?: string }) {
  const theme = useAppTheme();
  if (!strokes.length) return null;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SPACE} ${SPACE}`} accessibilityLabel="Hand-drawn icon">
      {strokes.map((stroke) => (
        <Path key={stroke.id} d={pointPath(stroke.points)} stroke={color ?? stroke.color ?? theme.colors.accent} strokeWidth={Math.max(25, (stroke.width ?? 7) * 4)} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={stroke.opacity ?? 1} />
      ))}
    </Svg>
  );
}
