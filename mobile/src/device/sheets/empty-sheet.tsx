import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';

import { SheetHeader, SheetScroll } from './primitives';
import { useSheetChrome } from './sheet-context';

/**
 * A sheet whose content lands in a later phase: just its header. Opened from the menu, ‹ goes
 * back to it.
 */
export function EmptySheet({ title, params }: { title: string; params: SheetParams }) {
  const { close } = useSheetChrome();
  const { swapSheet } = useDevice();
  return (
    <SheetScroll
      header={
        <SheetHeader
          title={title}
          left={params.from === 'menu' ? { kind: 'back', onPress: () => swapSheet('menu') } : undefined}
          right={{ kind: 'close', onPress: close }}
        />
      }>
      {null}
    </SheetScroll>
  );
}
