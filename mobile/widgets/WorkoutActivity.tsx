import { Capsule, HStack, Image, ProgressView, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  labelsHidden,
  lineLimit,
  monospacedDigit,
  padding,
  progressViewStyle,
  resizable,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { WorkoutActivityProps } from './workout-activity-props';

export type { WorkoutActivityProps };

const WorkoutActivity = (props: WorkoutActivityProps, _environment: LiveActivityEnvironment) => {
  'widget';
  const WHITE = '#FFFFFF';
  const MUTED = '#FFFFFF99';
  const ACCENT = '#007AFF';
  const restStart = new Date(props.restStartEpochMs);
  const restEnd = new Date(props.restEndEpochMs);

  const Thumb = ({ size }: { size: number }) =>
    props.exerciseImageUri ? (
      <Image
        uiImage={props.exerciseImageUri}
        modifiers={[
          resizable(),
          frame({ width: size, height: size }),
          clipShape('roundedRectangle', Math.max(6, Math.round(size * 0.2))),
        ]}
      />
    ) : (
      <Image
        systemName="figure.strengthtraining.traditional"
        size={Math.round(size * 0.72)}
        color={WHITE}
      />
    );

  const RestClock = ({ size, width, color }: { size: number; width: number; color: string }) =>
    props.isResting ? (
      <Text
        timerInterval={{ lower: restStart, upper: restEnd }}
        countsDown
        modifiers={[
          font({ weight: 'bold', size }),
          monospacedDigit(),
          foregroundStyle(color),
          frame({ width, alignment: 'trailing' }),
        ]}
      />
    ) : (
      <Text modifiers={[font({ weight: 'semibold', size }), foregroundStyle(color)]}>Now</Text>
    );

  const RestBar = () =>
    props.isResting ? (
      <ZStack modifiers={[frame({ maxWidth: Infinity })]}>
        <Capsule modifiers={[foregroundStyle('#FFFFFF40'), frame({ height: 4, maxWidth: Infinity })]} />
        <ProgressView
          timerInterval={{ lower: restStart, upper: restEnd }}
          countsDown={false}
          modifiers={[
            progressViewStyle('linear'),
            tint(WHITE),
            labelsHidden(),
            frame({ maxWidth: Infinity }),
          ]}
        />
      </ZStack>
    ) : null;

  return {
    banner: (
      <ZStack
        modifiers={[
          containerBackground('#000000', 'widget'),
          clipShape('containerRelativeShape'),
          widgetURL(props.openUrl),
        ]}>
        <HStack
          spacing={12}
          modifiers={[padding({ all: 16 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <VStack
            alignment="leading"
            spacing={4}
            modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            {props.isResting ? (
              <Text
                timerInterval={{ lower: restStart, upper: restEnd }}
                countsDown
                modifiers={[font({ weight: 'bold', size: 22 }), monospacedDigit(), foregroundStyle(WHITE)]}
              />
            ) : (
              <Text modifiers={[font({ weight: 'bold', size: 18 }), foregroundStyle(WHITE), lineLimit(1)]}>
                {props.exerciseName}
              </Text>
            )}
            <Text modifiers={[font({ size: 13 }), foregroundStyle(MUTED)]}>
              {props.isResting ? 'Up next' : 'Logging'}
            </Text>
            {props.isResting ? (
              <Text modifiers={[font({ weight: 'semibold', size: 16 }), foregroundStyle(WHITE), lineLimit(1)]}>
                {props.exerciseName}
              </Text>
            ) : null}
            <RestBar />
          </VStack>
          <Thumb size={52} />
        </HStack>
      </ZStack>
    ),
    compactLeading: <Thumb size={20} />,
    compactTrailing: <RestClock size={13} width={46} color={WHITE} />,
    minimal: <Thumb size={16} />,
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 8 })]}>
        <Thumb size={18} />
        <Text modifiers={[font({ weight: 'semibold', size: 14 }), foregroundStyle(WHITE), lineLimit(1)]}>
          {props.exerciseName}
        </Text>
      </HStack>
    ),
    expandedTrailing: (
      <HStack modifiers={[padding({ trailing: 6 })]}>
        <RestClock size={14} width={52} color={ACCENT} />
      </HStack>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ top: 4, horizontal: 6 })]}>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(MUTED)]}>
          {props.isResting ? 'Up next' : 'Logging'}
        </Text>
        <RestBar />
      </VStack>
    ),
  };
};

// babel-preset-expo's widgets plugin turns this into a layout string. Guard so a
// missed transform cannot redbox the log screen via LiveActivityFactory.
const layout: unknown = WorkoutActivity;
if (typeof layout !== 'string') {
  console.warn(
    '[live-activity] WorkoutActivity layout was not serialized (got ' + typeof layout + ')',
  );
}

type WorkoutActivityFactory = Pick<
  ReturnType<typeof createLiveActivity<WorkoutActivityProps>>,
  'start' | 'getInstances'
>;

const workoutActivityFactory: WorkoutActivityFactory = typeof layout === 'string'
  ? createLiveActivity<WorkoutActivityProps>('WorkoutActivity', layout as never)
  : {
      start() {
        throw new Error('Live Activity layout unavailable');
      },
      getInstances() {
        return [];
      },
    };

export default workoutActivityFactory;
