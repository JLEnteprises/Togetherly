import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import type { LiveLocationMember } from '@/types/database';
import { participantPalettes } from '@/theme/tokens';

export function PartnerMap({ members }: { members: LiveLocationMember[] }) {
  const mapRef = useRef<MapView | null>(null);
  const visible = useMemo(() => members.filter((member) => member.sharingEnabled && member.latitude != null && member.longitude != null), [members]);
  const coordinates = useMemo(() => visible.map((member) => ({ latitude: member.latitude!, longitude: member.longitude! })), [visible]);
  const signature = coordinates.map((coordinate) => `${coordinate.latitude.toFixed(4)},${coordinate.longitude.toFixed(4)}`).join('|');

  useEffect(() => {
    if (!coordinates.length) return;
    const timer = setTimeout(() => {
      if (coordinates.length === 1) {
        const coordinate = coordinates[0]!;
        mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 350);
      } else {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 64, right: 64, bottom: 64, left: 64 },
          animated: true,
        });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [signature]);

  if (!visible.length) {
    return <Card tone="secondary" style={{ gap: 6, alignItems: 'center', paddingVertical: 34 }}><AppText variant="section">No shared location yet</AppText><AppText variant="bodySmall" tone="muted" align="center">Turn on location sharing to appear on the map.</AppText></Card>;
  }

  const first = coordinates[0]!;
  return (
    <View style={{ height: 360, borderRadius: 22, overflow: 'hidden' }}>
      <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={{ latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }}>
        {visible.map((member) => (
          <Marker
            key={member.userId}
            coordinate={{ latitude: member.latitude!, longitude: member.longitude! }}
            title={member.displayName}
            pinColor={participantPalettes[member.participantColor].accent}
          />
        ))}
      </MapView>
    </View>
  );
}
