import type { ThemeColors } from '@/constants/theme';

/**
 * Native large title (trim-ui → Typography: words are native). Light and dark are JS-only
 * (theme-context), so the bar takes its ink from the theme instead of the system appearance.
 */
export function largeTitleOptions(colors: Pick<ThemeColors, 'label'>, title: string) {
  return {
    headerShown: true,
    headerLargeTitleEnabled: true,
    headerTransparent: true,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerTintColor: colors.label,
    headerTitleStyle: { color: colors.label },
    headerLargeTitleStyle: { color: colors.label },
    title,
  } as const;
}
