import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

export type AppIconName =
  | 'home' | 'plan' | 'together' | 'us' | 'more'
  | 'task' | 'list' | 'note' | 'calendar' | 'countdown' | 'availability'
  | 'trip' | 'goal' | 'question' | 'mood' | 'location' | 'date'
  | 'game' | 'memory' | 'photo' | 'timeline' | 'jar' | 'tag'
  | 'settings' | 'privacy' | 'search' | 'spark' | 'heart' | 'draw'
  | 'close' | 'back' | 'chevron' | 'chevronUp' | 'chevronDown' | 'overflow' | 'share' | 'copy' | 'notification' | 'external' | 'square' | 'squareCheck' | 'time' | 'plus' | 'check';

const names = new Set<AppIconName>([
  'home','plan','together','us','more','task','list','note','calendar','countdown','availability','trip','goal','question','mood','location','date','game','memory','photo','timeline','jar','tag','settings','privacy','search','spark','heart','draw','close','back','chevron','chevronUp','chevronDown','overflow','share','copy','notification','external','square','squareCheck','time','plus','check',
]);

export function isAppIconName(value: string): value is AppIconName { return names.has(value as AppIconName); }

export function AppIcon({ name, color, size = 22, strokeWidth = 1.8 }: { name: AppIconName; color: string; size?: number; strokeWidth?: number }) {
  const p = { fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' ? <><Path {...p} d="M12 3.3 13.7 8.3 18.7 10l-5 1.7-1.7 5-1.7-5-5-1.7 5-1.7 1.7-5Z"/><Circle {...p} cx="18.2" cy="17.8" r="1.7"/></> : null}
      {name === 'plan' ? <><Rect {...p} x="5" y="4.5" width="14" height="15" rx="2.6"/><Line {...p} x1="8.2" y1="9" x2="15.8" y2="9"/><Line {...p} x1="8.2" y1="13" x2="13.8" y2="13"/><Line {...p} x1="8.2" y1="17" x2="15" y2="17"/></> : null}
      {name === 'together' ? <><Circle {...p} cx="9" cy="12" r="5"/><Circle {...p} cx="15" cy="12" r="5"/><Path {...p} d="M12 7.9c1.35.95 2.2 2.42 2.2 4.1S13.35 15.15 12 16.1c-1.35-.95-2.2-2.42-2.2-4.1S10.65 8.85 12 7.9Z"/></> : null}
      {name === 'us' || name === 'heart' ? <Path {...p} d="M12 19.5s-7-4.1-7-9.3A3.7 3.7 0 0 1 11.5 7.8L12 8.4l.5-.6A3.7 3.7 0 0 1 19 10.2c0 5.2-7 9.3-7 9.3Z"/> : null}
      {name === 'more' || name === 'overflow' ? <><Circle cx="5" cy="12" r="1.45" fill={color}/><Circle cx="12" cy="12" r="1.45" fill={color}/><Circle cx="19" cy="12" r="1.45" fill={color}/></> : null}
      {name === 'task' ? <><Rect {...p} x="4.5" y="4.5" width="15" height="15" rx="3"/><Path {...p} d="m8 12 2.3 2.2 5.8-6"/></> : null}
      {name === 'list' ? <><Circle cx="6.2" cy="7" r="1" fill={color}/><Circle cx="6.2" cy="12" r="1" fill={color}/><Circle cx="6.2" cy="17" r="1" fill={color}/><Line {...p} x1="9.3" y1="7" x2="18" y2="7"/><Line {...p} x1="9.3" y1="12" x2="18" y2="12"/><Line {...p} x1="9.3" y1="17" x2="18" y2="17"/></> : null}
      {name === 'note' ? <><Path {...p} d="M6 4.5h8.5L18 8v11.5H6z"/><Path {...p} d="M14.5 4.5V8H18M9 12h6M9 15.5h4.2"/></> : null}
      {name === 'calendar' ? <><Rect {...p} x="4.5" y="6" width="15" height="13" rx="2.5"/><Line {...p} x1="8" y1="3.8" x2="8" y2="7.8"/><Line {...p} x1="16" y1="3.8" x2="16" y2="7.8"/><Line {...p} x1="4.5" y1="10" x2="19.5" y2="10"/><Circle cx="9" cy="14" r="1" fill={color}/><Circle cx="13" cy="14" r="1" fill={color}/></> : null}
      {name === 'countdown' ? <><Circle {...p} cx="12" cy="13" r="7"/><Path {...p} d="M9 3.5h6M12 6v7l3 2"/></> : null}
      {name === 'availability' ? <><Circle {...p} cx="12" cy="12" r="8"/><Path {...p} d="M12 7.5V12l3 2M5.4 7.1 3.1-2.3M18.6 7.1l-3.1-2.3"/></> : null}
      {name === 'trip' ? <><Path {...p} d="M3.8 13.2 20 5.3l-5.4 13-3.1-5.2-7.7.1Z"/><Path {...p} d="m11.5 13.1 4.2-4.3"/></> : null}
      {name === 'goal' ? <><Circle {...p} cx="12" cy="12" r="8"/><Circle {...p} cx="12" cy="12" r="4"/><Circle cx="12" cy="12" r="1.4" fill={color}/></> : null}
      {name === 'question' ? <><Circle {...p} cx="12" cy="12" r="8"/><Path {...p} d="M9.8 9.4a2.4 2.4 0 1 1 3.2 2.25c-.8.32-1 .72-1 1.5"/><Circle cx="12" cy="16.5" r="1" fill={color}/></> : null}
      {name === 'mood' ? <><Path {...p} d="M18.8 13.5A7.2 7.2 0 1 1 10.5 5.2a6.2 6.2 0 0 0 8.3 8.3Z"/><Circle cx="15.9" cy="6.4" r="1" fill={color}/></> : null}
      {name === 'location' ? <><Path {...p} d="M12 20s6-5.6 6-11a6 6 0 1 0-12 0c0 5.4 6 11 6 11Z"/><Circle {...p} cx="12" cy="9" r="2"/></> : null}
      {name === 'date' ? <><Path {...p} d="M12 19.2S5.5 15.5 5.5 10.7A3.5 3.5 0 0 1 11.7 8l.3.4.3-.4a3.5 3.5 0 0 1 6.2 2.7c0 4.8-6.5 8.5-6.5 8.5Z"/><Path {...p} d="m17.8 4 .5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5.5-1.4Z"/></> : null}
      {name === 'game' ? <><Path {...p} d="M8.3 9h7.4a4 4 0 0 1 3.8 5.2l-.8 2.3a2.1 2.1 0 0 1-3.5.8l-1.4-1.4h-3.6l-1.4 1.4a2.1 2.1 0 0 1-3.5-.8l-.8-2.3A4 4 0 0 1 8.3 9Z"/><Line {...p} x1="8.5" y1="12" x2="8.5" y2="15"/><Line {...p} x1="7" y1="13.5" x2="10" y2="13.5"/><Circle cx="15.3" cy="12.7" r=".9" fill={color}/><Circle cx="17.2" cy="14.4" r=".9" fill={color}/></> : null}
      {name === 'memory' ? <><Path {...p} d="M6 5.5h12v13H6z"/><Path {...p} d="m8.3 15 2.8-3 2.1 2 1.8-1.7 2.7 2.7"/><Circle cx="14.7" cy="9" r="1.2" fill={color}/></> : null}
      {name === 'photo' ? <><Rect {...p} x="4.5" y="5" width="15" height="14" rx="2.5"/><Circle {...p} cx="14.8" cy="9.2" r="1.5"/><Path {...p} d="m6.5 16 3.5-4 2.5 2.6 1.8-1.9 3.2 3.3"/></> : null}
      {name === 'timeline' ? <><Line {...p} x1="7" y1="4" x2="7" y2="20"/><Circle cx="7" cy="7" r="1.8" fill={color}/><Circle cx="7" cy="13" r="1.8" fill={color}/><Circle cx="7" cy="19" r="1.8" fill={color}/><Line {...p} x1="10.5" y1="7" x2="18" y2="7"/><Line {...p} x1="10.5" y1="13" x2="16" y2="13"/><Line {...p} x1="10.5" y1="19" x2="18" y2="19"/></> : null}
      {name === 'jar' ? <><Path {...p} d="M8 5h8M8.5 7h7l1 11H7.5l1-11Z"/><Path {...p} d="m12 10 .7 1.7 1.8.2-1.4 1.2.4 1.8-1.5-.9-1.5.9.4-1.8-1.4-1.2 1.8-.2.7-1.7Z"/></> : null}
      {name === 'tag' ? <Path {...p} d="M4.5 5.5h7l8 8-6 6-8-8v-6Z"/> : null}
      {name === 'settings' ? <><Circle {...p} cx="12" cy="12" r="3"/><Path {...p} d="M12 3.8v2M12 18.2v2M3.8 12h2M18.2 12h2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M17.8 6.2l-1.4 1.4M7.6 16.4l-1.4 1.4"/></> : null}
      {name === 'privacy' ? <><Path {...p} d="M7 10V8a5 5 0 0 1 10 0v2"/><Rect {...p} x="5" y="10" width="14" height="10" rx="2.5"/><Circle cx="12" cy="15" r="1.2" fill={color}/></> : null}
      {name === 'search' ? <><Circle {...p} cx="10.5" cy="10.5" r="5.5"/><Line {...p} x1="14.6" y1="14.6" x2="19" y2="19"/></> : null}
      {name === 'spark' ? <Path {...p} d="M12 3.3 13.7 8.3 18.7 10l-5 1.7-1.7 5-1.7-5-5-1.7 5-1.7 1.7-5Z"/> : null}
      {name === 'draw' ? <><Path {...p} d="m6 17.5 1-4.2 8.8-8.8 3.2 3.2-8.8 8.8-4.2 1Z"/><Path {...p} d="m13.8 6.5 3.2 3.2"/></> : null}
      {name === 'close' ? <Path {...p} d="m7 7 10 10M17 7 7 17"/> : null}
      {name === 'back' ? <Polyline {...p} points="15,5 8,12 15,19"/> : null}
      {name === 'chevron' ? <Polyline {...p} points="9,5 16,12 9,19"/> : null}
      {name === 'chevronUp' ? <Polyline {...p} points="5,15 12,8 19,15"/> : null}
      {name === 'chevronDown' ? <Polyline {...p} points="5,9 12,16 19,9"/> : null}
      {name === 'share' ? <><Circle {...p} cx="17.5" cy="5.5" r="2"/><Circle {...p} cx="6.5" cy="12" r="2"/><Circle {...p} cx="17.5" cy="18.5" r="2"/><Line {...p} x1="8.3" y1="11" x2="15.7" y2="6.5"/><Line {...p} x1="8.3" y1="13" x2="15.7" y2="17.5"/></> : null}
      {name === 'copy' ? <><Rect {...p} x="8" y="8" width="10.5" height="10.5" rx="2.2"/><Path {...p} d="M15.7 8V6.7A2.2 2.2 0 0 0 13.5 4.5H6.7a2.2 2.2 0 0 0-2.2 2.2v6.8a2.2 2.2 0 0 0 2.2 2.2H8"/></> : null}
      {name === 'external' ? <><Path {...p} d="M14 5h5v5"/><Path {...p} d="m19 5-8 8"/><Path {...p} d="M18 13v5.5H5.5v-13H11"/></> : null}
      {name === 'square' ? <Rect {...p} x="5" y="5" width="14" height="14" rx="3"/> : null}
      {name === 'squareCheck' ? <><Rect {...p} x="5" y="5" width="14" height="14" rx="3"/><Path {...p} d="m8.2 12 2.4 2.4 5.2-5.2"/></> : null}
      {name === 'time' ? <><Circle {...p} cx="12" cy="12" r="8"/><Path {...p} d="M12 7.5V12l3 2"/></> : null}
      {name === 'plus' ? <><Line {...p} x1="12" y1="5" x2="12" y2="19"/><Line {...p} x1="5" y1="12" x2="19" y2="12"/></> : null}
      {name === 'notification' ? <><Path {...p} d="M7.2 16.2h9.6l-1.2-1.7v-4.1a3.6 3.6 0 0 0-7.2 0v4.1l-1.2 1.7Z"/><Path {...p} d="M10.2 18.2a2 2 0 0 0 3.6 0"/><Path {...p} d="M12 4.8V3.6"/></> : null}
      {name === 'check' ? <Path {...p} d="m6 12.2 4 4L18 8"/> : null}
    </Svg>
  );
}
