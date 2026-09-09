import { useCallback, useState } from 'react';

// G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION: crowded hubs can keep at most one major feature group open at once.
export function useExclusiveExpandedGroup<Key extends string>(initialExpanded: Key | null = null) {
  const [expandedGroup, setExpandedGroup] = useState<Key | null>(initialExpanded);

  const isExpanded = useCallback(
    (key: Key) => expandedGroup === key,
    [expandedGroup],
  );

  const setExpanded = useCallback((key: Key, expanded: boolean) => {
    setExpandedGroup((current) => {
      if (expanded) return key;
      return current === key ? null : current;
    });
  }, []);

  const toggle = useCallback((key: Key) => {
    setExpandedGroup((current) => current === key ? null : key);
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedGroup(null);
  }, []);

  return {
    expandedGroup,
    isExpanded,
    setExpanded,
    toggle,
    collapseAll,
  };
}
