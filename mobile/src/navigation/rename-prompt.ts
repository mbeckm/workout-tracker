import { Alert } from 'react-native';

import type { ColorScheme } from '@/constants/theme';

/**
 * The one way Trim renames a plan or a day (trim-ui → Components → Rename): the system text
 * prompt, from `Rename` in the row's context menu or the editor's `Rename` row. The name is the
 * page's native large title, so it isn't a field. Both buttons are gray (a preferred `Save`
 * would take the system blue), Return still saves, and the prompt takes Trim's own light/dark
 * (JS-only, so it would otherwise follow the OS). An empty or unchanged name keeps the old one:
 * Save never blanks a name.
 */
export function promptRename({
  title,
  current,
  scheme,
  onSave,
}: {
  title: string;
  current: string;
  scheme: ColorScheme;
  onSave: (name: string) => void;
}) {
  const name = current.trim();
  Alert.prompt(
    title,
    undefined,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        onPress: (value?: string) => {
          const next = (value ?? '').trim();
          if (next && next !== name) {
            onSave(next);
          }
        },
      },
    ],
    'plain-text',
    name,
    'default',
    { userInterfaceStyle: scheme },
  );
}
