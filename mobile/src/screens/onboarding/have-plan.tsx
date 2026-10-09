import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fontScaleCap,
  gadgetType,
  importGeometry,
  importColors,
  importType,
  onboardingGeometry as G,
  packColors,
  sheetColors,
  signal,
  space,
} from '@/constants/theme';
import { PRESS_SCALE } from '@/motion';

import { selectionTick } from './choice';
import { OnboardingFrame } from './frame';
import { Cartridge } from './pack';

type Answer = 'have' | 'pick' | 'own';

/**
 * Step 4 (decision 88): the fork. Someone with a plan in Notes, ChatGPT or another app imports it
 * and never sees Days a week (their plan decides it); everyone else picks a starter plan for their
 * days. Build my own, quieter, goes to Days and then an empty plan.
 */
export function OnboardingHavePlan() {
  const router = useRouter();
  const [answer, setAnswer] = useState<Answer>('have');

  const pick = (next: Answer) => {
    if (next !== answer) {
      selectionTick();
      setAnswer(next);
    }
  };

  const next = () => {
    if (answer === 'have') router.push('/onboarding/import');
    else if (answer === 'own') router.push({ pathname: '/onboarding/days', params: { own: '1' } });
    else router.push('/onboarding/days');
  };

  return (
    <OnboardingFrame
      title="Got a plan?"
      scroll={false}
      action={{ title: 'Continue', onPress: next }}
      testID="onboarding-have-plan">
      <View accessibilityRole="radiogroup" accessibilityLabel="Got a plan?" style={styles.stage}>
        <Card
          title="I have one"
          sub="Notes, ChatGPT, another app"
          selected={answer === 'have'}
          onSelect={() => pick('have')}
          testID="onboarding-have-plan-yes">
          <View style={styles.notes}>
            <Note tilt={-importGeometry.noteTilt} />
            <Note tilt={importGeometry.noteTilt} back />
          </View>
        </Card>
        <Card
          title="Pick one for me"
          sub="Starter plans"
          selected={answer === 'pick'}
          onSelect={() => pick('pick')}
          testID="onboarding-have-plan-pick">
          <View style={styles.carts}>
            {['UA', 'LA', 'UB'].map((label, index) => (
              <Cartridge key={label} label={label} hop={answer === 'pick'} order={index} />
            ))}
          </View>
        </Card>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: answer === 'own' }}
          onPress={() => pick('own')}
          testID="onboarding-have-plan-own"
          style={({ pressed }) => [styles.own, answer === 'own' && styles.ownOn, pressed && styles.pressed]}>
          <Text
            maxFontSizeMultiplier={fontScaleCap.title}
            style={[gadgetType.pill, { color: answer === 'own' ? signal.orange : sheetColors.muted }]}>
            Build my own
          </Text>
        </Pressable>
      </View>
    </OnboardingFrame>
  );
}

function Card({
  title,
  sub,
  selected,
  onSelect,
  children,
  testID,
}: {
  title: string;
  sub: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}, ${sub}`}
      onPress={onSelect}
      testID={testID}
      style={({ pressed }) => [styles.card, selected && styles.on, pressed && !selected && styles.pressed]}>
      {children}
      <View style={styles.cardText}>
        <Text maxFontSizeMultiplier={fontScaleCap.title} style={importType.forkTitle}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap.title} style={importType.forkSub}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

/** A sheet of notes in the drawing: paper with a heading line and three text lines. */
function Note({ tilt, back = false }: { tilt: number; back?: boolean }) {
  return (
    <View style={[styles.note, back && styles.noteBack, { transform: [{ rotate: `${tilt}deg` }, { translateY: back ? space.tight : 0 }] }]}>
      <View style={[styles.noteLine, styles.noteHeading]} />
      <View style={[styles.noteLine, styles.w100]} />
      <View style={[styles.noteLine, styles.w80]} />
      <View style={[styles.noteLine, styles.w100]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, gap: G.packGap, paddingTop: space.gutter, paddingBottom: space.related },
  card: {
    flex: 1,
    borderRadius: G.packRadius,
    borderCurve: 'continuous',
    backgroundColor: packColors.pack,
    boxShadow: `inset 0 1px 0 ${packColors.packHighlight}`,
    paddingHorizontal: G.packPadX,
    paddingVertical: G.packPadX,
    justifyContent: 'space-between',
  },
  on: { boxShadow: `inset 0 0 0 ${G.packRing}px ${signal.orange}` },
  pressed: { transform: [{ scale: PRESS_SCALE }] },
  cardText: { gap: space.pair },
  notes: { flexDirection: 'row', gap: space.related },
  carts: { flexDirection: 'row', gap: G.cartGap },
  note: {
    width: importGeometry.noteWidth,
    height: importGeometry.noteHeight,
    borderRadius: importGeometry.rowIconRadius + 2,
    backgroundColor: importColors.paper,
    padding: space.related,
    gap: space.tight,
  },
  noteBack: { backgroundColor: importColors.paperLineSoft },
  noteLine: { height: importGeometry.bar - 2, borderRadius: importGeometry.barRadius, backgroundColor: importColors.paperLineSoft },
  noteHeading: { width: '70%', height: importGeometry.bar - 1, backgroundColor: importColors.paperLineStrong },
  w100: { width: '100%' },
  w80: { width: '80%' },
  own: {
    alignSelf: 'center',
    minHeight: importGeometry.choiceHeight,
    paddingHorizontal: space.gutter,
    borderRadius: importGeometry.choiceHeight / 2,
    justifyContent: 'center',
  },
  ownOn: { backgroundColor: sheetColors.control },
});
