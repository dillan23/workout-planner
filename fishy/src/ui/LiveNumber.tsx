import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, TextInput, type TextStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * A number that changes without re-rendering React.
 *
 * The HUD has to show live run state, but the whole point of the architecture
 * is that gameplay never triggers a render. On a device an uneditable TextInput
 * can have its `text` prop driven straight from a shared value, so the counter
 * updates on the same thread as the simulation.
 *
 * On the web that prop goes nowhere: react-native-web renders a DOM input and
 * `text` is not one of its attributes, so the counters render blank. There the
 * shared value is watched instead and the input's value written directly. It
 * still costs no render, and the write only happens when the number actually
 * changes, which is once per fish rather than once per frame.
 */
export function LiveNumber({
  value,
  style,
  prefix = '',
}: {
  value: SharedValue<number>;
  style?: TextStyle | TextStyle[];
  prefix?: string;
}) {
  const isWeb = Platform.OS === 'web';
  const ref = useRef<TextInput | null>(null);

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    return { text: prefix + Math.round(value.value).toString(), defaultValue: '' };
  });

  const writeToDom = (next: string) => {
    const node = ref.current as unknown as { value?: string } | null;
    if (node) {
      node.value = next;
    }
  };

  useAnimatedReaction(
    () => Math.round(value.value),
    (current, previous) => {
      'worklet';
      if (isWeb && current !== previous) {
        runOnJS(writeToDom)(prefix + current.toString());
      }
    },
  );

  // The reaction only fires on change, so the first paint needs seeding.
  useEffect(() => {
    if (isWeb) {
      writeToDom(prefix + Math.round(value.value).toString());
    }
  });

  return (
    <AnimatedTextInput
      ref={ref}
      editable={false}
      defaultValue={prefix + '0'}
      style={[styles.base, style]}
      animatedProps={isWeb ? undefined : animatedProps}
      underlineColorAndroid="transparent"
      allowFontScaling={false}
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  base: { padding: 0, margin: 0 },
});
