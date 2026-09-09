import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { TagChip } from '@/components/common/TagChip';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { searchEverything } from '@/services/backend/mvpFeatures';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppIcon } from '@/components/art/AppIcon';
import type { SearchResult } from '@/types/database';
import { recordHref } from '@/utils/recordRoutes';
function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

export default function SearchScreen() {
  const theme = useAppTheme();
  const { colorForUser } = useWorkspace();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  async function search() {
    if (query.trim().length < 2) return;
    setBusy(true); setSearched(true);
    try { setResults(await searchEverything(query.trim())); }
    catch (error) { Alert.alert('Search failed', messageFrom(error)); }
    finally { setBusy(false); }
  }
  return (
    <AppScreen>
      <BackHeader eyebrow="Account" title="Search" subtitle="Find anything you’ve saved." />
      <Card tone="accent" style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xxl }}>
        <FormField label="SEARCH" value={query} onChangeText={setQuery} placeholder="Flights, dinner, passport…" returnKeyType="search" onSubmitEditing={search} />
        <AppButton label={busy ? 'Searching…' : 'Search'} disabled={busy || query.trim().length < 2} onPress={search} />
      </Card>
      <View style={{ gap: theme.spacing.md }}>
        {searched && !busy && results.length === 0 ? <EmptyState icon="search" title="Nothing matched" body="Try a different word or phrase." /> : null}
        {results.map((result) => (
          <Pressable accessibilityRole="button" key={`${result.type}-${result.id}`} onPress={() => router.push(recordHref(result.type, result.id) as never)}>
            {({ pressed }) => <Card participantColor={colorForUser(result.creator_id)} style={{ gap: 6, opacity: pressed ? 0.72 : 1 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1 }}><TagChip subtle label={result.type.toUpperCase()} /><AppText variant="cardTitle" style={{ marginTop: 7 }}>{result.title}</AppText>{result.subtitle ? <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>{result.subtitle}</AppText> : null}<View style={{ marginTop: 6 }}><ParticipantAttribution userId={result.creator_id} /></View></View><AppIcon name="chevron" size={16} color={theme.colors.textMuted} /></View></Card>}
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}
