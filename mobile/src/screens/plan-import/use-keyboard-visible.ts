import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Whether the keyboard is up. Fix hides its Continue while typing a search: the pill would ride
 * the keyboard and cover the results, and it can't be pressed until every lift has an answer.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
