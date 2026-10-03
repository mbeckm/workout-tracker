import { FlashList, type FlashListProps, type FlashListRef } from '@shopify/flash-list';
import type { ReactNode, Ref } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sheetGeometry } from '@/constants/theme';

import { useSheetChrome } from './sheet-context';

/**
 * The scroll view under a `SheetList`: the host's swipe-down hands off from it at its top, as
 * from `SheetScroll`. At the top a pull moves the sheet, not the content.
 */
function SheetListScroll({ ref, ...props }: ScrollViewProps & { ref?: Ref<Animated.ScrollView> }) {
  const { scrollGesture } = useSheetChrome();
  return (
    <GestureDetector gesture={scrollGesture}>
      <Animated.ScrollView ref={ref} {...props} bounces={false} />
    </GestureDetector>
  );
}

/**
 * A virtualized sheet page (FlashList) for long lists: the History wall's 100+ receipts. Same
 * frame as `SheetScroll`: content under the sticky header, the sheet's side padding, the
 * swipe-down hand-off at the top.
 */
export function SheetList<T>({
  header,
  listRef,
  onScroll,
  ...props
}: Omit<FlashListProps<T>, 'renderScrollComponent' | 'contentContainerStyle'> & {
  header: ReactNode;
  listRef?: Ref<FlashListRef<T>>;
}) {
  const { scrollY } = useSheetChrome();
  const insets = useSafeAreaInsets();
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.set(event.nativeEvent.contentOffset.y);
    onScroll?.(event);
  };
  return (
    <View style={styles.fill}>
      <FlashList
        {...props}
        ref={listRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderScrollComponent={SheetListScroll}
        contentContainerStyle={{
          paddingTop: sheetGeometry.headerHeight,
          paddingHorizontal: sheetGeometry.sidePad,
          paddingBottom: Math.max(insets.bottom, sheetGeometry.bottomPad),
        }}
      />
      <View style={styles.headerSlot} pointerEvents="box-none">
        {header}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerSlot: { position: 'absolute', left: 0, right: 0, top: 0 },
});
