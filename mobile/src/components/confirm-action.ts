import { ActionSheetIOS, Alert } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  /** `sheet` = iOS action sheet (a choice about the whole screen), else an alert. */
  presentation?: 'alert' | 'sheet';
};

/**
 * One confirm for the log: iOS alert or action sheet, `window.confirm` on web (where
 * `Alert.alert` is a no-op). `onCancel` also runs when the sheet is dismissed.
 */
export function confirmAction(
  options: ConfirmOptions,
  onConfirm: () => void,
  onCancel?: () => void,
): void {
  const { title, message, confirmLabel, cancelLabel, destructive, presentation = 'alert' } = options;

  if (process.env.EXPO_OS === 'web') {
    const confirm = (globalThis as { confirm?: (text: string) => boolean }).confirm;
    if (typeof confirm === 'function' && confirm([title, message].filter(Boolean).join('\n\n'))) {
      onConfirm();
    } else {
      onCancel?.();
    }
    return;
  }

  if (presentation === 'sheet' && process.env.EXPO_OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: [confirmLabel, cancelLabel],
        cancelButtonIndex: 1,
        destructiveButtonIndex: destructive ? 0 : undefined,
      },
      (index) => {
        if (index === 0) {
          onConfirm();
        } else {
          onCancel?.();
        }
      },
    );
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel', onPress: onCancel },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
