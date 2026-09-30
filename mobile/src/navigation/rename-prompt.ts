import { Alert } from 'react-native';

import type { ColorScheme } from '@/constants/theme';

/**
 * The one way Trim renames a plan or a day (trim-ui → Components → Rename): the system text
 * prompt, from `Rename` in the row's context menu or the editor's `Rename` row. The name is the
 * page's native large title, so it isn't a field. Both buttons are gray (a preferred `Save`
 * would take the system blue), Return still saves, and the prompt takes Trim's own light/dark
 * (JS-only, so it would otherwise follow the OS). An empty or unchanged name keeps the old one:
 * Save never blanks a name, except where `clearable` (the user's own name in Settings), where an
 * empty field means no name.
 */
export function promptRename({
  title,
  current,
  scheme,
  clearable = false,
  onSave,
}: {
  title: string;
  current: string;
  scheme: ColorScheme;
  /** Save with an empty field clears the name instead of keeping it. */
  clearable?: boolean;
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
          if ((next || clearable) && next !== name) {
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
