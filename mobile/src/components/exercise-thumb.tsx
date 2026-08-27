import { Image, type ImageContentFit } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { initials } from '@/domain/helpers';
import { useTheme } from '@/theme/theme-context';

export function ExerciseThumb({
  uri,
  name,
  size = 40,
  width,
  height,
  completed = false,
  animated = true,
  contentFit = 'cover',
  backgroundColor,
}: {
  uri?: string | null;
  name: string;
  size?: number;
  width?: number;
  height?: number;
  completed?: boolean;
  animated?: boolean;
  contentFit?: ImageContentFit;
  backgroundColor?: string;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const thumbWidth = width ?? size;
  const thumbHeight = height ?? size;
  const radius = Math.max(6, Math.round(Math.min(thumbWidth, thumbHeight) * 0.2));
  const source = uri && !failed ? uri : null;
  const resolvedBackground = backgroundColor ?? colors.systemGray4;

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={{
        width: thumbWidth,
        height: thumbHeight,
        borderRadius: radius,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: resolvedBackground,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
      <Text
        style={{
          color: colors.secondaryLabel,
          fontSize: Math.max(10, Math.round(Math.min(thumbWidth, thumbHeight) * 0.32)),
          fontWeight: '700',
        }}>
        {initials(name)}
      </Text>
      {source ? (
        <Image
          source={{ uri: source }}
          recyclingKey={`${source}:${animated ? 'anim' : 'still'}`}
          contentFit={contentFit}
          cachePolicy="memory-disk"
          transition={150}
          autoplay={animated}
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {completed ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: 'rgba(52, 199, 89, 0.28)',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              padding: 2,
            },
          ]}>
          <View
            style={{
              width: Math.max(10, Math.round(Math.min(thumbWidth, thumbHeight) * 0.28)),
              height: Math.max(10, Math.round(Math.min(thumbWidth, thumbHeight) * 0.28)),
              borderRadius: 99,
              backgroundColor: colors.systemGreen,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: colors.onTint, fontSize: Math.max(7, Math.round(Math.min(thumbWidth, thumbHeight) * 0.18)), fontWeight: '800' }}>
              ✓
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
