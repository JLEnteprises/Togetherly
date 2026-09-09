import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { PartnerPresencePill } from '@/components/common/PartnerPresencePill';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { getDecisionWheel, saveDecisionWheelOptions, spinDecisionWheel } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useAppTheme } from '@/theme/useAppTheme';
import type { DecisionWheelState } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

function choicesFrom(value: string) {
  const seen = new Set<string>();
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      const key = item.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function polar(size: number, radius: number, angleDegrees: number) {
  const angle = (angleDegrees - 90) * Math.PI / 180;
  const center = size / 2;
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
}

function wedgePath(size: number, index: number, total: number) {
  const center = size / 2;
  const radius = size / 2 - 3;
  const sweep = 360 / total;
  const start = polar(size, radius, index * sweep);
  const end = polar(size, radius, (index + 1) * sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function WheelGraphic({ choices }: { choices: string[] }) {
  const theme = useAppTheme();
  const size = 286;
  const palette = [theme.colors.accentSoft, theme.colors.secondarySoft, theme.colors.elevatedBackground];
  const total = Math.max(choices.length, 1);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {choices.map((choice, index) => {
        const sweep = 360 / total;
        const centerAngle = index * sweep + sweep / 2;
        const label = polar(size, size * 0.31, centerAngle);
        const short = choice.length > 15 ? `${choice.slice(0, 13)}…` : choice;
        return (
          <Path
            key={`${choice}-${index}`}
            d={wedgePath(size, index, total)}
            fill={palette[index % palette.length]}
            stroke={theme.colors.border}
            strokeWidth={2}
          />
        );
      })}
      {choices.map((choice, index) => {
        const sweep = 360 / total;
        const centerAngle = index * sweep + sweep / 2;
        const label = polar(size, size * 0.31, centerAngle);
        const short = choice.length > 15 ? `${choice.slice(0, 13)}…` : choice;
        return (
          <SvgText
            key={`label-${choice}-${index}`}
            x={label.x}
            y={label.y}
            fill={theme.colors.textPrimary}
            fontSize={10}
            fontWeight="700"
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {short}
          </SvgText>
        );
      })}
      <Circle cx={size / 2} cy={size / 2} r={25} fill={theme.colors.background} stroke={theme.colors.border} strokeWidth={2} />
      <Circle cx={size / 2} cy={size / 2} r={8} fill={theme.colors.accent} />
    </Svg>
  );
}

function formatSpinTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function DecisionToolsScreen() {
  const theme = useAppTheme();
  const [state, setState] = useState<DecisionWheelState | null>(null);
  const [choicesText, setChoicesText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const rotation = useRef(new Animated.Value(0)).current;
  const rotationDegrees = useRef(0);
  const seenSpinId = useRef<string | null>(null);

  const choices = useMemo(() => choicesFrom(choicesText), [choicesText]);

  const refresh = useCallback(async () => {
    try {
      const next = await getDecisionWheel();
      setState(next);
      setChoicesText((current) => dirty ? current : next.options.join('\n'));
    } catch (error) {
      Alert.alert('Couldn’t load the decision wheel', messageFrom(error));
    } finally {
      setLoading(false);
    }
  }, [dirty]);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('decision_wheel', refresh);

  const animateToWinner = useCallback((winnerIndex: number, optionCount: number, immediate = false) => {
    if (optionCount < 2) return;
    const sweep = 360 / optionCount;
    const desired = (360 - (winnerIndex * sweep + sweep / 2)) % 360;

    if (immediate) {
      rotation.stopAnimation();
      rotation.setValue(desired);
      rotationDegrees.current = desired;
      return;
    }

    const currentNormalized = ((rotationDegrees.current % 360) + 360) % 360;
    const forwardToDesired = (desired - currentNormalized + 360) % 360;
    const target = rotationDegrees.current + 5 * 360 + forwardToDesired;
    rotationDegrees.current = target;

    Animated.timing(rotation, {
      toValue: target,
      duration: 2600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      const normalized = ((target % 360) + 360) % 360;
      rotation.setValue(normalized);
      rotationDegrees.current = normalized;
    });
  }, [rotation]);

  useEffect(() => {
    if (!state?.spin_id || state.winner_index == null || state.options.length < 2) return;
    if (seenSpinId.current === null) {
      seenSpinId.current = state.spin_id;
      animateToWinner(state.winner_index, state.options.length, true);
      return;
    }
    if (seenSpinId.current === state.spin_id) return;
    seenSpinId.current = state.spin_id;
    animateToWinner(state.winner_index, state.options.length);
  }, [animateToWinner, state?.options.length, state?.spin_id, state?.winner_index]);

  async function saveOptionsOnly() {
    if (choices.length < 2) return;
    setBusy(true);
    try {
      const next = await saveDecisionWheelOptions(choices);
      setState(next);
      setChoicesText(next.options.join('\n'));
      setDirty(false);
    } catch (error) {
      Alert.alert('Couldn’t save wheel options', messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function spin() {
    if (choices.length < 2 || busy) return;
    setBusy(true);
    try {
      let next = state;
      const serverOptions = state?.options ?? [];
      const changed = dirty || serverOptions.join('\n') !== choices.join('\n');
      if (changed) {
        next = await saveDecisionWheelOptions(choices);
        setChoicesText(next.options.join('\n'));
        setDirty(false);
      }
      const spun = await spinDecisionWheel();
      setState(spun);
    } catch (error) {
      Alert.alert('Couldn’t spin the wheel', messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  const wheelChoices = state?.options?.length ? state.options : choices;
  const rotate = rotation.interpolate({
    inputRange: [0, 3600],
    outputRange: ['0deg', '3600deg'],
    extrapolate: 'extend',
  });

  return (
    <AppScreen>
      <BackHeader eyebrow="Together" title="Decision wheel" subtitle="A shared wheel. One spin, one answer, on both phones." />
      <PartnerPresencePill scope="decision-wheel" />

      <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xxl, alignItems: 'center', overflow: 'hidden' }}>
        {loading ? <AppText tone="muted">Loading shared wheel…</AppText> : null}

        {wheelChoices.length >= 2 ? (
          <View style={{ width: 300, height: 315, alignItems: 'center', justifyContent: 'flex-end' }}>
            <View style={{
              position: 'absolute',
              top: 1,
              zIndex: 4,
              width: 0,
              height: 0,
              borderLeftWidth: 13,
              borderRightWidth: 13,
              borderTopWidth: 22,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: theme.colors.textPrimary,
            }} />
            <Animated.View style={{ transform: [{ rotate }] }}>
              <WheelGraphic choices={wheelChoices} />
            </Animated.View>
          </View>
        ) : (
          <View style={{ minHeight: 180, justifyContent: 'center', alignItems: 'center', paddingHorizontal: theme.spacing.xl }}>
            <AppText variant="section" align="center">Add at least two options to build your wheel.</AppText>
          </View>
        )}

        {state?.winner ? (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <AppText variant="caption" tone="secondary">THE WHEEL LANDED ON</AppText>
            <AppText variant="pageTitle" align="center">{state.winner}</AppText>
            {state.spun_at ? <AppText variant="bodySmall" tone="muted">{formatSpinTime(state.spun_at)}</AppText> : null}
          </View>
        ) : null}

        <AppButton
          label={busy ? 'Spinning…' : dirty ? 'Save & spin' : state?.winner ? 'Spin again' : 'Spin together'}
          disabled={busy || choices.length < 2}
          onPress={spin}
        />
      </Card>

      <Card tone="secondary" style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>
        <View style={{ gap: 4 }}>
          <AppText variant="section">What are we choosing between?</AppText>
          <AppText variant="bodySmall" tone="secondary">Two to twelve unique options. Saving updates the wheel for both of you.</AppText>
        </View>
        <FormField
          label="OPTIONS · ONE PER LINE OR COMMA-SEPARATED"
          value={choicesText}
          onChangeText={(value) => { setChoicesText(value); setDirty(true); }}
          multiline
          placeholder={'Takeaway\nCook together\nGo out'}
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <AppButton variant="secondary" label={busy ? 'Saving…' : 'Save shared options'} disabled={busy || choices.length < 2 || !dirty} onPress={saveOptionsOnly} />
          </View>
        </View>
        <AppText variant="bodySmall" tone={choices.length < 2 ? 'muted' : choices.length >= 12 ? 'warning' : 'secondary'}>
          {choices.length}/12 options{choices.length >= 12 ? ' · extra entries are ignored' : ''}
        </AppText>
      </Card>

      {state?.history?.length ? (
        <Card style={{ gap: theme.spacing.md }}>
          <View style={{ gap: 3 }}>
            <AppText variant="section">Recent shared spins</AppText>
            <AppText variant="bodySmall" tone="muted">The same result is recorded for both of you.</AppText>
          </View>
          {state.history.map((item, index) => (
            <View key={item.id} style={{ gap: 5, borderTopWidth: index ? 1 : 0, borderTopColor: theme.colors.border, paddingTop: index ? theme.spacing.sm : 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}>
                <AppText variant="cardTitle" style={{ flex: 1 }}>{item.winner}</AppText>
                <AppText variant="caption" tone="muted">{formatSpinTime(item.created_at)}</AppText>
              </View>
              <ParticipantAttribution userId={item.spun_by} />
            </View>
          ))}
        </Card>
      ) : null}
    </AppScreen>
  );
}
