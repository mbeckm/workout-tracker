import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Text, View, type AppStateStatus } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { FeatureRow } from '@/components/paywall/feature-row';
import { monthShort } from '@/domain/weeks';
import { EASE_OUT } from '@/motion';
import type { ProFeature } from '@/purchases/pro-features';
import type { PaywallSuccess } from '@/purchases/use-paywall-controller';
import { useTheme } from '@/theme/theme-context';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The check disc. Big enough to be the moment, small enough to sit on the text grid. */
const DISC = 56;
/** Drawn inside the disc's own box: short arm, then the long one. ~31pt of stroke. */
const CHECK_PATH = 'M17.5 28.5 L25 36 L38.5 21';
const CHECK_LENGTH = 31;
/** Start the dash fully past the path so the round cap doesn't leave a dot before it draws. */
const CHECK_HIDDEN = CHECK_LENGTH + 6;

/** App already active: start as the offer finishes fading (150ms). */
const PLAY_AFTER_MS = 140;
/** Back from the App Store's own sheet / "You're all set" alert: let it animate away first. */
const PLAY_AFTER_RETURN_MS = 260;

export function successHeadline(success: PaywallSuccess): string {
  return success.kind === 'restored' ? 'Welcome back.' : "You're in.";
}

/**
 * "Free until Oct 4. Cancel anytime in Settings." The trial is the only money fact left.
 * The date is built from parts in the copy's English order, like the week labels: a locale
 * format reads `4. Oct.` on a German-region phone and its dot collides with the sentence's.
 */
export function trialLine(success: PaywallSuccess, now = new Date()): string | null {
  const end = success.trialEndsAt;
  if (!end) {
    return null;
  }
  const farOff = end.getTime() - now.getTime() > 180 * 24 * 60 * 60 * 1000;
  const date = `${monthShort(end)} ${end.getDate()}${farOff ? `, ${end.getFullYear()}` : ''}`;
  return `Free until ${date}. Cancel anytime in Settings.`;
}

function isForeground(state: AppStateStatus): boolean {
  return state !== 'inactive' && state !== 'background';
}

/**
 * False until the success state can actually be seen. The App Store's purchase sheet and its
 * "You're all set" alert make the app inactive, and the purchase often resolves underneath
 * them: the check, the haptic and the reveal wait until Trim is in front again.
 */
function usePlayWhenVisible(): boolean {
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (play) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = (state: AppStateStatus, delayMs: number) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (isForeground(state)) {
        timer = setTimeout(() => setPlay(true), delayMs);
      }
    };
    arm(AppState.currentState, PLAY_AFTER_MS);
    const subscription = AppState.addEventListener('change', (state) => arm(state, PLAY_AFTER_RETURN_MS));
    return () => {
      subscription.remove();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [play]);
  return play;
}

/**
 * Green disc with a check that draws itself, and two soft rings: Home's week-dot celebration
 * at the size of a moment. Green is right here: the purchase is completed work, and the
 * paywall's CTA stays black, so it's the only green on the stage. Reduced motion: the disc
 * and a finished check fade in; no pop, no draw, no rings.
 */
function SuccessCheck({ play, reduceMotion }: { play: boolean; reduceMotion: boolean }) {
  const { colors } = useTheme();
  const disc = useSharedValue(0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.6);
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);

  useEffect(() => {
    if (!play) {
      return;
    }
    if (process.env.EXPO_OS === 'ios') {
      // Same frame as the pop: the tap is the check landing.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (reduceMotion) {
      disc.set(withTiming(1, { duration: 200, easing: EASE_OUT }));
      return;
    }
    disc.set(withTiming(1, { duration: 140, easing: EASE_OUT }));
    scale.set(withSpring(1, { duration: 480, dampingRatio: 0.55 }));
    draw.set(withDelay(110, withTiming(1, { duration: 320, easing: EASE_OUT })));
    ringA.set(withDelay(80, withTiming(1, { duration: 720, easing: EASE_OUT })));
    ringB.set(withDelay(220, withTiming(1, { duration: 720, easing: EASE_OUT })));
  }, [play, reduceMotion, disc, scale, draw, ringA, ringB]);

  const discStyle = useAnimatedStyle(() => ({
    opacity: disc.get(),
    transform: [{ scale: scale.get() }],
  }));
  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_HIDDEN * (1 - draw.get()),
  }));
  const ringAStyle = useAnimatedStyle(() => ({
    opacity: ringA.get() === 0 ? 0 : 0.3 * (1 - ringA.get()),
    transform: [{ scale: 1 + ringA.get() * 0.8 }],
  }));
  const ringBStyle = useAnimatedStyle(() => ({
    opacity: ringB.get() === 0 ? 0 : 0.3 * (1 - ringB.get()),
    transform: [{ scale: 1 + ringB.get() * 0.8 }],
  }));

  const ring = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: colors.systemGreen,
  };

  return (
    <View
      style={{ width: DISC, height: DISC }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      {reduceMotion ? null : (
        <>
          <Animated.View pointerEvents="none" style={[ring, ringAStyle]} />
          <Animated.View pointerEvents="none" style={[ring, ringBStyle]} />
        </>
      )}
      <Animated.View
        testID="paywall-success-check"
        style={[
          {
            width: DISC,
            height: DISC,
            borderRadius: DISC / 2,
            backgroundColor: colors.systemGreen,
          },
          discStyle,
        ]}>
        <Svg width={DISC} height={DISC} viewBox={`0 0 ${DISC} ${DISC}`}>
          <AnimatedPath
            d={CHECK_PATH}
            fill="none"
            stroke={colors.onGreen}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[CHECK_LENGTH, CHECK_HIDDEN * 2]}
            animatedProps={checkProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Rises 8pt and fades in on `play`, after `delay`. Layout is held from the first frame. */
function Reveal({
  play,
  delay,
  reduceMotion,
  children,
}: {
  play: boolean;
  delay: number;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!play) {
      return;
    }
    progress.set(
      withDelay(delay, withTiming(1, { duration: reduceMotion ? 180 : 220, easing: EASE_OUT })),
    );
  }, [play, delay, reduceMotion, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.get()) * 8 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * The paywall after Pro turns on: check, one headline, then the same feature rows the buyer
 * just read, now saying where each one lives (gated feature first). One beat, in order:
 * check (0), headline (+90ms), rows (+160ms, 60ms apart). No subheading, no confetti.
 */
export function PaywallSuccessBody({
  success,
  features,
  reduceMotion,
}: {
  success: PaywallSuccess;
  features: readonly ProFeature[];
  reduceMotion: boolean;
}) {
  const { type } = useTheme();
  const play = usePlayWhenVisible();
  const headline = successHeadline(success);

  useEffect(() => {
    if (play) {
      AccessibilityInfo.announceForAccessibility(`${headline} Trim Pro is on.`);
    }
  }, [play, headline]);

  return (
    <View style={{ gap: 28 }} testID="paywall-success">
      <View style={{ gap: 20 }}>
        <SuccessCheck play={play} reduceMotion={reduceMotion} />
        <Reveal play={play} delay={90} reduceMotion={reduceMotion}>
          <Text
            style={type.largeTitle}
            accessibilityRole="header"
            testID="paywall-success-headline">
            {headline}
          </Text>
        </Reveal>
      </View>
      <View style={{ gap: 18 }} testID="paywall-success-features">
        {features.map((feature, index) => (
          <Reveal key={feature.id} play={play} delay={160 + index * 60} reduceMotion={reduceMotion}>
            <FeatureRow
              title={feature.title}
              detail={feature.where}
              spokenDetail={feature.whereSpoken}
              symbol={feature.symbol}
            />
          </Reveal>
        ))}
      </View>
    </View>
  );
}
