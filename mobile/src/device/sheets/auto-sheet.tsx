import { StyleSheet, Switch, Text, View } from 'react-native';

import { deviceColors, fontScaleCap, gadgetType, sheetColors, sheetGeometry, signal, space } from '@/constants/theme';
import { AUTO_CHANGE_TEXT, autoReason, compactSet, useLogSession } from '@/device/log';
import { durationIsMinutes, repsForSet } from '@/domain/helpers';
import { lastTimeSetFor } from '@/domain/log-session';

import { Chip, PillButton, SectionLabel, SheetCard, SheetHeader, SheetRow, SheetScroll } from './primitives';
import { useSheetChrome } from './sheet-context';

/** `87.5×8` → `87.5 × 8`: the display's joined shorthand, spaced for a sheet. */
function spaced(text: string | null): string {
  return text ? text.replace('×', ' × ') : '';
}

/** Body copy in a card (a sentence, not a row). */
function Words({ children }: { children: string }) {
  return (
    <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowSub, styles.words]}>
      {children}
    </Text>
  );
}

/**
 * The Auto mode sheet (decision 99), from the clip on the set card. On AUTO it says why this
 * set, from the lifter's own last session, and what changing it does. On MAN it says what they
 * set and what AUTO had, with one pill back. With Auto mode off it's only the switch.
 */
export function AutoSheet() {
  const { close } = useSheetChrome();
  const { current, stage, stageTarget, auto, autoMode, setAutoMode, backToAuto, previous, units } = useLogSession();
  const lamp = auto?.lamp ?? 'off';
  const manual = lamp === 'man';
  const minutes = current ? durationIsMinutes(current.prescription) : false;
  const lastSet = stage ? lastTimeSetFor(previous?.sets, stage.setIndex) : null;
  const target = stageTarget;
  const heading = current && stage ? `${current.prescription.name}, set ${stage.setIndex + 1}` : null;

  const reason =
    target && current && stage
      ? autoReason({ target, lastSet, goal: repsForSet(current.prescription, stage.setIndex), units })
      : null;
  const targetText = target ? spaced(compactSet(target, minutes)) : '';
  const yours = stage ? spaced(compactSet(stage.values, minutes)) : '';
  const lastSession = (previous?.sets ?? []).map((set) => compactSet(set, minutes)).filter(Boolean) as string[];

  const toggle = () => setAutoMode(!autoMode);

  return (
    <SheetScroll
      header={
        <SheetHeader title={manual ? 'Manual' : 'Auto mode'} right={{ kind: 'close', onPress: close }} />
      }>
      {heading && lamp !== 'off' && target ? (
        <>
          <SectionLabel>{heading}</SectionLabel>
          <SheetCard>
            <View style={styles.block} accessible accessibilityLabel={manual ? `You set ${yours}` : `Auto mode set ${targetText}`}>
              <Text
                maxFontSizeMultiplier={fontScaleCap.title}
                style={[gadgetType.bigNumber, !manual && styles.auto]}>
                {manual ? yours : targetText}
              </Text>
              {!manual && lastSession.length > 0 ? (
                <View style={styles.chips}>
                  {lastSession.map((text, index) => (
                    <Chip key={index} label={text} tone="done" />
                  ))}
                </View>
              ) : null}
              {manual ? <Words>{`You set this. Auto mode had ${targetText}.`}</Words> : null}
              {reason ? <Words>{reason}</Words> : null}
            </View>
          </SheetCard>
          <SectionLabel>{manual ? 'Next time' : 'If you change it'}</SectionLabel>
          <SheetCard>
            <View style={styles.block}>
              <Words>{manual ? 'Trim plans from what you log today.' : AUTO_CHANGE_TEXT}</Words>
            </View>
          </SheetCard>
          {manual ? (
            <PillButton
              title={`Back to ${targetText}`}
              onPress={() => {
                backToAuto();
                close();
              }}
              style={styles.pill}
            />
          ) : null}
        </>
      ) : (
        <SheetCard>
          <View style={styles.block}>
            <Words>
              {autoMode
                ? 'Trim sets the weight and reps for every set from your last session.'
                : 'Auto mode is off. Each set opens on what you lifted last time.'}
            </Words>
          </View>
        </SheetCard>
      )}
      <SheetCard>
        {/* The whole row flips the switch (as Settings' Sounds); VoiceOver reaches the switch. */}
        <SheetRow
          size="compact"
          title="Auto mode"
          onPress={toggle}
          accessory={
            <View pointerEvents="none">
              <Switch
                value={autoMode}
                onValueChange={setAutoMode}
                accessibilityLabel="Auto mode"
                trackColor={{ true: signal.orange, false: sheetColors.track }}
                thumbColor={deviceColors.key1}
                ios_backgroundColor={sheetColors.track}
                testID="auto-mode-switch"
              />
            </View>
          }
        />
      </SheetCard>
    </SheetScroll>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: sheetGeometry.itemPadX,
    paddingVertical: sheetGeometry.itemPadY,
    gap: space.related,
  },
  auto: { color: signal.orange },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.tight },
  words: { color: sheetColors.inkSoft },
  pill: { marginVertical: sheetGeometry.pillTop },
});
