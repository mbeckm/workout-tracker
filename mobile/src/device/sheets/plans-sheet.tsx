import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  PRESSED_OPACITY,
  fontScaleCap,
  gadgetRadius,
  gadgetType,
  lcd,
  objectColors,
  plansColors,
  plansGeometry as geo,
  plansType,
  signal,
} from '@/constants/theme';
import { track } from '@/analytics/analytics';
import { emptyPlan } from '@/domain/helpers';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import { haptics } from '@/device/haptics';
import { createPlanGate, rackModel, type RackCartridge, type RackShelf } from '@/device/plans-model';
import { DEVICE, EASE_FILE_FN } from '@/motion';
import { requirePro } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';

import { SheetHeader, SheetScroll } from './primitives';
import { useSheetChrome } from './sheet-context';

/** Where bezier(.3,1.4,.5,1) first reaches the shelf: the cartridge seats there (trim-ui §8 rule 3). */
const FILE_LAND_SHARE = 0.4;
/** The grip's ridges: 2 on, 2 off across the grip's width (`.cart u`). */
const GRIP_RIDGES = Math.ceil((geo.cartWidth - geo.gripInsetX * 2) / geo.gripPitch);

/**
 * The rack (PB3, screen 20): one shelf per plan, the active one first and outlined, each with
 * its days as cartridges. `+` makes a plan (the second one asks for Pro, `second_plan`); a shelf
 * opens its editor. Coming back from the editor after a change (`filed`), that plan's cartridges
 * drop onto their shelf and the shelf flashes (SPEC §7).
 */
export function PlansSheet({ params }: { params: SheetParams }) {
  const { close } = useSheetChrome();
  const { swapSheet } = useDevice();
  const { plans, activePlanId, workoutHistory, savePlan } = useWorkoutStore();
  const fromMenu = params.from === 'menu';
  const via: SheetParams = fromMenu ? { via: 'menu' } : {};
  const gating = useRef(false);

  const shelves = useMemo(
    () => rackModel({ plans, activePlanId, history: workoutHistory, now: new Date() }),
    [plans, activePlanId, workoutHistory],
  );

  const create = async () => {
    if (gating.current) {
      return;
    }
    const reason = createPlanGate(plans.length);
    if (reason) {
      gating.current = true;
      const allowed = await requirePro(reason).finally(() => {
        gating.current = false;
      });
      if (!allowed) {
        return;
      }
    }
    const plan = emptyPlan();
    track('plan_created', { plan_count: plans.length });
    savePlan(plan, { activate: plans.length === 0 });
    swapSheet('editor', { planId: plan.id, new: '1', ...via });
  };

  return (
    <SheetScroll
      header={
        <SheetHeader
          title="Plans"
          left={fromMenu ? { kind: 'back', onPress: () => swapSheet('menu') } : { kind: 'close', onPress: close }}
          right={{ kind: 'text', label: '+', accessibilityLabel: 'New plan', onPress: create }}
        />
      }>
      <View testID="plans-sheet">
        {shelves.length === 0 ? (
          <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowSub, styles.empty]}>
            No plans yet
          </Text>
        ) : (
          shelves.map((shelf) => (
            <Shelf
              key={shelf.planId}
              shelf={shelf}
              filing={shelf.planId === params.filed}
              onPress={() => swapSheet('editor', { planId: shelf.planId, ...via })}
            />
          ))
        )}
      </View>
    </SheetScroll>
  );
}

function Shelf({ shelf, filing, onPress }: { shelf: RackShelf; filing: boolean; onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  // 0 → 1 over the flash; 1 is the plain shelf.
  const flash = useSharedValue(filing ? 0 : 1);

  useEffect(() => {
    if (filing) {
      // The flash is colour, not movement: it plays under Reduce Motion too.
      flash.set(withTiming(1, { duration: DEVICE.SHELF_FLASH }));
    }
  }, [filing, flash]);

  const flashStyle = useAnimatedStyle(() => {
    const t = flash.get();
    return {
      backgroundColor:
        t <= geo.flashHold
          ? plansColors.shelfFlash
          : interpolateColor(t, [geo.flashHold, 1], [plansColors.shelfFlash, plansColors.shelf]),
    };
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={shelf.accessibilityLabel}
      testID={`plans-shelf-${shelf.planId}`}
      style={({ pressed }) => [pressed && styles.pressed]}>
      <Animated.View style={[styles.shelf, shelf.active && styles.shelfActive, flashStyle]}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.title} style={[plansType.shelfName, styles.name]}>
            {shelf.name}
          </Text>
          {shelf.active ? <ActiveBadge /> : null}
        </View>
        <Text maxFontSizeMultiplier={fontScaleCap.title} style={[plansType.shelfSub, styles.sub]}>
          {shelf.summary}
        </Text>
        <View style={styles.carts} pointerEvents="none">
          {shelf.carts.map((cart, index) => (
            <Cartridge
              key={cart.dayId}
              cart={cart}
              index={index}
              filing={filing}
              reduceMotion={reduceMotion}
            />
          ))}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** The `Active` badge (`.act`): orange with dark ink. */
export function ActiveBadge() {
  return (
    <View style={styles.badge}>
      <Text maxFontSizeMultiplier={fontScaleCap.display} style={plansType.badge}>
        Active
      </Text>
    </View>
  );
}

/**
 * A cartridge (`.cart`): grey plastic, a dark label window with the day in Doto 9 (orange, green
 * when done this week), grip ridges. Filing drops it from 120 above, tilted −8°, onto the shelf
 * (550 ms, bezier(.3,1.4,.5,1), 120 ms apart); Reduce Motion fades it in instead.
 */
function Cartridge({
  cart,
  index,
  filing,
  reduceMotion,
}: {
  cart: RackCartridge;
  index: number;
  filing: boolean;
  reduceMotion: boolean;
}) {
  const progress = useSharedValue(filing ? 0 : 1);

  useEffect(() => {
    if (!filing) {
      return;
    }
    const delay = index * DEVICE.FILE_STAGGER;
    const duration = reduceMotion ? DEVICE.REDUCED_FADE : DEVICE.FILE;
    progress.set(
      withDelay(delay, withTiming(1, { duration, easing: reduceMotion ? undefined : EASE_FILE_FN })),
    );
    // The seat lands with the drop, not after it.
    const timer = setTimeout(haptics.key, delay + Math.round(duration * (reduceMotion ? 1 : FILE_LAND_SHARE)));
    return () => clearTimeout(timer);
  }, [filing, index, progress, reduceMotion]);

  const style = useAnimatedStyle(() => {
    const t = progress.get();
    if (reduceMotion) {
      return { opacity: t };
    }
    return {
      // The CSS keyframe starts at opacity 0 and eases it with the drop (clamped at the overshoot).
      opacity: Math.min(1, t),
      transform: [{ translateY: (1 - t) * geo.fileFrom }, { rotate: `${(1 - t) * geo.fileTilt}deg` }],
    };
  });

  return (
    <Animated.View style={[styles.cart, style]}>
      <View style={styles.label}>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1}
          style={[plansType.cartLabel, { color: cart.done ? signal.done : lcd.amber }]}>
          {cart.label}
        </Text>
      </View>
      <View style={styles.grip}>
        {Array.from({ length: GRIP_RIDGES }, (_, ridge) => (
          <View key={ridge} style={styles.ridge} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', marginTop: geo.emptyTop },
  pressed: { opacity: PRESSED_OPACITY },
  shelf: {
    height: geo.shelfHeight,
    borderRadius: gadgetRadius.card,
    borderCurve: 'continuous',
    backgroundColor: plansColors.shelf,
    paddingVertical: geo.shelfPadY,
    paddingHorizontal: geo.shelfPadX,
    marginBottom: geo.shelfGap,
    overflow: 'hidden',
  },
  shelfActive: { boxShadow: `inset 0 0 0 ${geo.shelfOutline}px ${signal.orange}` },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: geo.nameGap },
  name: { flexShrink: 1 },
  sub: { marginTop: geo.subTop },
  badge: {
    height: geo.badgeHeight,
    paddingHorizontal: geo.badgePadX,
    borderRadius: geo.badgeRadius,
    backgroundColor: signal.orange,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  carts: {
    position: 'absolute',
    left: geo.shelfPadX,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: geo.cartGap,
  },
  cart: {
    width: geo.cartWidth,
    height: geo.cartHeight,
    borderTopLeftRadius: geo.cartRadius,
    borderTopRightRadius: geo.cartRadius,
    borderCurve: 'continuous',
    experimental_backgroundImage: `linear-gradient(180deg, ${objectColors.plasticHi}, ${objectColors.plasticLo})`,
    boxShadow: `inset 0 ${geo.cartHighlight}px 0 ${plansColors.cartHighlight}`,
  },
  label: {
    position: 'absolute',
    left: geo.labelInset,
    right: geo.labelInset,
    top: geo.labelTop,
    height: geo.labelHeight,
    borderRadius: geo.labelRadius,
    backgroundColor: lcd.lcd,
    alignItems: 'center',
    overflow: 'hidden',
  },
  grip: {
    position: 'absolute',
    left: geo.gripInsetX,
    right: geo.gripInsetX,
    bottom: geo.gripBottom,
    height: geo.gripHeight,
    flexDirection: 'row',
    gap: geo.gripPitch - geo.gripLine,
    overflow: 'hidden',
  },
  ridge: { width: geo.gripLine, height: geo.gripHeight, backgroundColor: plansColors.grip },
});
