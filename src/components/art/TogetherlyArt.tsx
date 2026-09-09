import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { useAppTheme } from '@/theme/useAppTheme';

export function TogetherlyMark({ size = 76 }: { size?: number }) {
  const theme = useAppTheme();
  const me = theme.participants.me;
  const partner = theme.participants.partner;
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Defs><LinearGradient id="mark" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={me.accent}/><Stop offset="1" stopColor={partner.accent}/></LinearGradient></Defs>
      <Circle cx="40" cy="40" r="31" fill="rgba(255,255,255,0.025)" stroke="url(#mark)" strokeWidth="1.5"/>
      <Ellipse cx="40" cy="40" rx="26" ry="12" fill="none" stroke={me.accent} strokeOpacity="0.62" strokeWidth="1.4" transform="rotate(-28 40 40)"/>
      <Ellipse cx="40" cy="40" rx="26" ry="12" fill="none" stroke={partner.accent} strokeOpacity="0.55" strokeWidth="1.4" transform="rotate(28 40 40)"/>
      <Circle cx="20" cy="32" r="4.6" fill={me.accent}/><Circle cx="60" cy="48" r="4.6" fill={partner.accent}/>
      <Path d="M40 50s-9-5.1-9-11.2a4.7 4.7 0 0 1 8.1-3.2l.9 1 .9-1a4.7 4.7 0 0 1 8.1 3.2C49 44.9 40 50 40 50Z" fill="url(#mark)"/>
      <Circle cx="57" cy="20" r="1.8" fill={theme.colors.star}/><Circle cx="26" cy="59" r="1.3" fill={theme.colors.star}/>
    </Svg>
  );
}

export function ConnectionOrbitArt({ width = 260, height = 126 }: { width?: number; height?: number }) {
  const theme = useAppTheme();
  const me = theme.participants.me;
  const partner = theme.participants.partner;
  return (
    <Svg width={width} height={height} viewBox="0 0 260 126">
      <Defs><LinearGradient id="bridge" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={me.accent}/><Stop offset="1" stopColor={partner.accent}/></LinearGradient></Defs>
      <Path d="M38 80C74 20 184 20 222 80" fill="none" stroke="url(#bridge)" strokeOpacity="0.34" strokeWidth="1.5" strokeDasharray="4 7"/>
      <Path d="M38 80C83 108 178 108 222 80" fill="none" stroke="url(#bridge)" strokeOpacity="0.5" strokeWidth="1.5"/>
      <Circle cx="38" cy="80" r="17" fill={me.accentSoft} stroke={me.accent} strokeWidth="1.5"/>
      <Circle cx="222" cy="80" r="17" fill={partner.accentSoft} stroke={partner.accent} strokeWidth="1.5"/>
      <Circle cx="38" cy="80" r="5" fill={me.accent}/><Circle cx="222" cy="80" r="5" fill={partner.accent}/>
      <Path d="M130 72s-12-6.9-12-15.2a6.1 6.1 0 0 1 10.5-4.2l1.5 1.7 1.5-1.7a6.1 6.1 0 0 1 10.5 4.2C142 65.1 130 72 130 72Z" fill="url(#bridge)"/>
      <G fill={theme.colors.star}><Circle cx="82" cy="40" r="1.6"/><Circle cx="177" cy="30" r="1.2"/><Circle cx="151" cy="101" r="1.5"/><Circle cx="103" cy="94" r="1"/></G>
    </Svg>
  );
}

export function MemoryConstellationArt({ width = 150, height = 76 }: { width?: number; height?: number }) {
  const theme = useAppTheme();
  const me = theme.participants.me;
  const partner = theme.participants.partner;
  return (
    <Svg width={width} height={height} viewBox="0 0 150 76">
      <Path d="M15 53 43 29 77 46 108 20 135 40" fill="none" stroke={theme.colors.border} strokeWidth="1.2" strokeDasharray="3 5"/>
      <Circle cx="15" cy="53" r="4" fill={me.accent}/><Circle cx="43" cy="29" r="3" fill={theme.colors.star}/><Circle cx="77" cy="46" r="5" fill={partner.accent}/><Circle cx="108" cy="20" r="3" fill={theme.colors.star}/><Circle cx="135" cy="40" r="4" fill={me.accent}/>
      <Path d="M74 24s-7-3.8-7-8.7a3.6 3.6 0 0 1 6.1-2.5l.9 1 .9-1a3.6 3.6 0 0 1 6.1 2.5c0 4.9-7 8.7-7 8.7Z" fill={partner.accent} opacity="0.85"/>
    </Svg>
  );
}
