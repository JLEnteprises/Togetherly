import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useAppTheme } from '@/theme/useAppTheme';

export type Chapter = 'home' | 'plan' | 'connect' | 'story';

// Original vector illustrations: scale without downloads, keep each person's
// chosen colour, and stay decorative for screen readers and pointer events.
export function ChapterArt({ chapter = 'home', height = 136 }: { chapter?: Chapter; height?: number }) {
  const theme = useAppTheme();
  const id = useId().replace(/:/g, '');
  const a = theme.participants.me.accent;
  const b = theme.participants.partner.accent;
  const ink = theme.colors.accent;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width="100%" height={height} viewBox="0 0 360 140">
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={a} stopOpacity="0.18"/><Stop offset="1" stopColor={b} stopOpacity="0.04"/></LinearGradient></Defs>
      <Ellipse cx="180" cy="76" rx="145" ry="58" fill={`url(#${id})`}/>
      <G stroke={ink} strokeOpacity="0.3" fill="none"><Path d="M18 117Q180 55 342 117"/><Path d="M44 125Q180 88 316 125"/></G>
      <G fill={ink}><Circle cx="60" cy="51" r="2"/><Circle cx="298" cy="38" r="2"/><Circle cx="280" cy="102" r="1.5"/><Path d="m91 24 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/></G>
      {chapter === 'plan' ? <G strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Rect x="127" y="22" width="106" height="96" rx="15" fill={theme.colors.card} stroke={ink}/>
        <Path d="M128 49h104M152 15v17m56-17v17" stroke={ink}/>
        <G fill={a}><Circle cx="151" cy="67" r="3"/><Circle cx="179" cy="67" r="3"/><Circle cx="208" cy="67" r="3"/><Circle cx="151" cy="94" r="3"/></G>
        <Circle cx="181" cy="94" r="13" fill={b} fillOpacity="0.18" stroke={b}/><Path d="m175 94 4 4 8-9" stroke={b} fill="none"/>
        <Path d="M244 116q-1-27 20-40-1 25-20 27m0 13q0-29-16-38 0 24 16 28" stroke={b} fill="none"/>
      </G> : chapter === 'story' ? <G strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Rect x="119" y="26" width="88" height="99" rx="5" transform="rotate(-12 163 75)" fill={theme.colors.cardElevated} stroke={a}/>
        <G transform="rotate(9 199 73)"><Rect x="155" y="20" width="88" height="104" rx="5" fill={theme.colors.card} stroke={ink}/><Rect x="164" y="29" width="70" height="69" rx="2" fill={b} fillOpacity="0.12"/><Circle cx="215" cy="45" r="9" fill={ink}/><Path d="m164 87 22-28 16 18 13-11 19 22" stroke={b} fill="none"/><Path d="M180 110h38" stroke={ink}/></G>
      </G> : <G strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="180" cy="58" r="33" fill={ink} fillOpacity="0.08"/>
        <Path d="M180 79s-26-15-26-34c0-14 17-18 26-6 9-12 26-8 26 6 0 19-26 34-26 34Z" stroke={ink} fill={ink} fillOpacity="0.13"/>
        <Path d="M163 119q-29-29-38-70m21 48q-31-1-37-25 26 0 37 25m-10-22q4-24-10-38-9 19 10 38" stroke={a} fill={a} fillOpacity="0.13"/>
        <Path d="M197 119q29-29 38-70m-21 48q31-1 37-25-26 0-37 25m10-22q-4-24 10-38 9 19-10 38" stroke={b} fill={b} fillOpacity="0.13"/>
        {chapter === 'connect' ? <Path d="M110 114q70 30 140 0" stroke={ink} fill="none" strokeDasharray="3 6"/> : null}
      </G>}
    </Svg>
  </View>;
}
