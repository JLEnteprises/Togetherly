import { useMemo, useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { DrawingStroke } from '@/types/database';
import { useAppTheme } from '@/theme/useAppTheme';

const SPACE = 1000;

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

export function DrawingCanvas({
  strokes,
  currentUserId,
  editable = true,
  height = 280,
  strokeColorForUser,
  onStroke,
}: {
  strokes: DrawingStroke[];
  currentUserId?: string;
  editable?: boolean;
  height?: number;
  strokeColorForUser?: (userId: string | undefined) => string;
  onStroke?: (stroke: DrawingStroke) => void;
}) {
  const theme = useAppTheme();
  const [size, setSize] = useState({ width: 1, height });
  const [draft, setDraft] = useState<DrawingStroke | null>(null);
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
    onStartShouldSetPanResponder: () => editable,
    onMoveShouldSetPanResponder: () => editable,
    onPanResponderGrant: (event) => {
      if (!editable) return;
      const point = normalized(event.nativeEvent.locationX, event.nativeEvent.locationY);
      const next = { id: makeId(), userId: currentUserId, width: 7, points: [point] } satisfies DrawingStroke;
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
      const current = draftRef.current;
      draftRef.current = null;
      setDraft(null);
      if (current?.points.length) onStrokeRef.current?.(current);
    },
    onPanResponderTerminate: () => {
      const current = draftRef.current;
      draftRef.current = null;
      setDraft(null);
      if (current?.points.length) onStrokeRef.current?.(current);
    },
  }), [currentUserId, editable]);

  function onLayout(event: LayoutChangeEvent) {
    const next = { width: Math.max(1, event.nativeEvent.layout.width), height: Math.max(1, event.nativeEvent.layout.height) };
    sizeRef.current = next;
    setSize(next);
  }

  const renderStroke = (stroke: DrawingStroke, draftStroke = false) => (
    <Path
      key={stroke.id}
      d={pointPath(stroke.points)}
      stroke={strokeColorForUser?.(stroke.userId) ?? theme.colors.accent}
      strokeWidth={stroke.width ?? 7}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={draftStroke ? 0.9 : 1}
    />
  );

  return (
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
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.elevatedBackground,
      }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${SPACE} ${SPACE}`} preserveAspectRatio="none">
        {strokes.map((stroke) => renderStroke(stroke))}
        {draft ? renderStroke(draft, true) : null}
      </Svg>
    </View>
  );
}

export function DrawnIcon({ strokes, size = 22, color }: { strokes: DrawingStroke[]; size?: number; color?: string }) {
  const theme = useAppTheme();
  if (!strokes.length) return null;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SPACE} ${SPACE}`} accessibilityLabel="Hand-drawn icon">
      {strokes.map((stroke) => (
        <Path key={stroke.id} d={pointPath(stroke.points)} stroke={color ?? theme.colors.accent} strokeWidth={Math.max(25, (stroke.width ?? 7) * 4)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </Svg>
  );
}
