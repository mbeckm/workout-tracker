import { memo, useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import {
  finishColors,
  sheetGeometry,
  space,
  tourColors,
  tourGeometry,
} from "@/constants/theme";
import {
  EARNED_FINISH,
  FINISHES,
  FREE_FINISHES,
  finishLock,
  type Finish,
} from "@/domain/finish";
import { SkinRow, type SkinRowPill } from "@/device/skin-row";
import { DEVICE, EASE_DISPLAY_FN, EASE_FALL_FN } from "@/motion";
import { requirePro } from "@/purchases/pro-gate";
import { useWorkoutStore } from "@/store/workout-store";

import { useTour, type TourLaunchPhase } from "./tour-context";
import { READY_BEAT } from "./tour-model";

/*
 * The tour's gift (decisions 95, 97), replacing the 3D launch of decision 85. Start lets the
 * device's old skin go: the whole machine falls away like a case, and Graphite stands behind it.
 * The machine steps back into the row of all six (`SkinRow`, shared with the Skin Library), the
 * owner's first, Graphite second, and pixel sparkles twinkle round it once. Use steps the picked
 * one forward again and the device fades in over it, home, in that skin; on a locked skin the
 * pill is Try Trim Pro.
 *
 * Cheap on purpose: the row is drawn once, under the device, while the tour's last lines type, so
 * Start only starts animations; the fall, the step back, the sparkles, the swipe and the spring
 * all run on the UI thread.
 */

/**
 * All six machines in the row: the finish the owner had, Graphite (new), then the rest, free
 * before Trim Pro's. An owner already on Graphite (a replayed tour) still sees Aluminium.
 */
function rowOf(before: Finish): Finish[] {
  const order = [
    before,
    EARNED_FINISH,
    ...FINISHES.filter((id) => FREE_FINISHES.includes(id)),
    ...FINISHES.filter((id) => !FREE_FINISHES.includes(id)),
  ];
  return order.filter(
    (id, index) => order.indexOf(id) === index && FINISHES.includes(id),
  );
}

/**
 * The device's own transform while its old skin falls (decision 95): down past the bottom edge,
 * gathering speed, tilting about a point on its top edge. The fall's end reveals the row. At
 * rest (and under Reduce Motion, where the device fades instead) it's no transform at all.
 */
export function useTourDropStyle() {
  const { launch, reveal } = useTour();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const drop = useSharedValue(0);
  const falling = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(drop);
    // `picking` holds the fallen pose (the device is hidden by then); everything else rests.
    if (launch === "drop" && !reduceMotion) {
      falling.set(1);
      drop.set(0);
      drop.set(
        withTiming(
          1,
          { duration: DEVICE.TOUR_DROP, easing: EASE_FALL_FN },
          (finished) => {
            if (finished) scheduleOnRN(reveal);
          },
        ),
      );
    } else if (launch !== "picking") {
      falling.set(0);
      drop.set(0);
    }
  }, [drop, falling, launch, reduceMotion, reveal]);

  // The pivot, from the device's centre. Turning about it is turning about the centre, then
  // moving by (pivot − turned pivot): one translate and one rotate.
  const px = width * (tourGeometry.dropPivotX - 0.5);
  const py = -height / 2;
  return useAnimatedStyle(() => {
    if (falling.get() === 0) return { transform: [] };
    const t = drop.get();
    const angle = (t * tourGeometry.dropTilt * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      transform: [
        { translateX: px - (px * cos - py * sin) },
        {
          translateY:
            t * height * tourGeometry.dropFall + py - (px * sin + py * cos),
        },
        { rotate: `${angle}rad` },
      ],
    };
  });
}

/**
 * The device's opacity around the gift, as a CSS transition so React holds both resting states
 * (trim-ui §8 rule 8): gone while the row is up, faded back in over the picked machine.
 */
export function useTourDeviceFade() {
  const { launch } = useTour();
  const reduceMotion = useReducedMotion();
  const gone =
    launch === "picking" ||
    launch === "landing" ||
    (launch === "drop" && reduceMotion);
  return {
    opacity: gone ? 0 : 1,
    transitionProperty: "opacity",
    transitionDuration: DEVICE.TOUR_FADE,
  } as const;
}

/**
 * The row of six (decision 95). Mounted under the device from the tour's last screen on, so it's
 * ready before Start; it takes touches only while `picking`.
 */
export function TourGift() {
  const { launch, before, pick, active, state, choose, keep, reveal } =
    useTour();
  const armed = launch != null || (active && state.beat >= READY_BEAT);
  if (!armed) return null;
  return (
    <Gift
      key={before}
      launch={launch}
      before={before}
      pick={pick}
      choose={choose}
      keep={keep}
      reveal={reveal}
    />
  );
}

type GiftProps = {
  launch: TourLaunchPhase | null;
  before: Finish;
  pick: Finish;
  choose: (finish: Finish) => void;
  keep: (unlocked?: boolean) => void;
  reveal: () => void;
};

/** Memoized: the tour's typing re-renders `TourGift` every character; this only changes with the gift. */
const Gift = memo(function Gift({
  launch,
  before,
  pick,
  choose,
  keep,
  reveal,
}: GiftProps) {
  const { isPro } = useWorkoutStore();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const row = useMemo(() => rowOf(before), [before]);
  const earned = Math.max(0, row.indexOf(EARNED_FINISH));
  const picking = launch === "picking";
  // Graphite is new unless the owner already had it (a replayed tour).
  const unlocks = before !== EARNED_FINISH;

  // `z`: 0 the middle machine at full size, 1 stepped back into the row. A row that mounts
  // mid-gift (a remount) starts stepped back, where `picking` has it.
  const z = useSharedValue(launch === "picking" ? 1 : 0);
  const pos = useSharedValue(earned);
  const spark = useSharedValue(0);

  useEffect(() => {
    if (launch === "drop") {
      cancelAnimation(pos);
      cancelAnimation(z);
      cancelAnimation(spark);
      pos.set(earned);
      z.set(0);
      spark.set(0);
      z.set(
        reduceMotion
          ? 1
          : withDelay(
              DEVICE.TOUR_STEP_BACK_DELAY,
              withTiming(1, {
                duration: DEVICE.TOUR_STEP_BACK,
                easing: EASE_DISPLAY_FN,
              }),
            ),
      );
      // The sparkles, once, as the row settles (decision 97). Reduce Motion: none.
      if (unlocks && !reduceMotion) {
        spark.set(
          withDelay(
            DEVICE.TOUR_STEP_BACK_DELAY + DEVICE.TOUR_STEP_BACK,
            withTiming(1, {
              duration: DEVICE.TOUR_SPARKLE,
              easing: Easing.linear,
            }),
          ),
        );
      }
    } else if (launch === "landing") {
      cancelAnimation(pos);
      pos.set(Math.max(0, row.indexOf(pick)));
      if (!reduceMotion)
        z.set(
          withTiming(0, {
            duration: DEVICE.TOUR_SETTLE,
            easing: EASE_DISPLAY_FN,
          }),
        );
    }
    // `pick` is read once, as Use lands; a later pick can't happen (`choose` only takes `picking`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earned, launch, pos, reduceMotion, spark, unlocks, z]);

  const lockOf = useCallback(
    (id: Finish) => finishLock(id, { isPro, tourDone: true }),
    [isPro],
  );
  const full = useMemo(
    () => ({ top: insets.top, bottom: insets.bottom }),
    [insets.bottom, insets.top],
  );
  const sparkle = useMemo(
    () => (unlocks ? { finish: EARNED_FINISH, progress: spark } : undefined),
    [spark, unlocks],
  );

  const lock = lockOf(pick);
  const isNew = pick === EARNED_FINISH && unlocks;
  const name = finishColors[pick].name;
  const label = isNew
    ? "NEW SKIN UNLOCKED"
    : lock === "pro"
      ? "TRIM PRO SKIN"
      : pick === before
        ? "YOUR SKIN"
        : "FREE SKIN";
  // A locked skin: the paywall, and if they buy, that skin (trim-ui §12 rule 17).
  const tryPro = async () => {
    if (await requirePro("finishes")) keep(true);
  };
  const pill: SkinRowPill =
    lock === "pro"
      ? {
          title: "Try Trim Pro",
          variant: "light",
          onPress: () => void tryPro(),
          testID: "tour-try-pro",
        }
      : {
          title: pick === before ? `Keep ${name}` : `Use ${name}`,
          variant: "light",
          onPress: () => keep(),
          testID: "tour-keep",
        };
  const hidden = !picking;

  return (
    <View
      pointerEvents={launch === "drop" || picking ? "auto" : "none"}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      style={[StyleSheet.absoluteFill, styles.room]}
    >
      <SkinRow
        row={row}
        pick={pick}
        pos={pos}
        z={z}
        enabled={picking}
        onPass={choose}
        lockOf={lockOf}
        label={label}
        pill={pill}
        top={insets.top + space.gutter}
        bottom={Math.max(insets.bottom, sheetGeometry.bottomPad)}
        full={full}
        sparkle={sparkle}
      >
        {launch === "drop" ? (
          // Nothing waits on the moment: a tap skips the rest of the fall.
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Skip"
            onPress={() => {
              cancelAnimation(z);
              z.set(1);
              reveal();
            }}
          />
        ) : null}
      </SkinRow>
    </View>
  );
});

const styles = StyleSheet.create({
  room: { backgroundColor: tourColors.roomGround },
});
