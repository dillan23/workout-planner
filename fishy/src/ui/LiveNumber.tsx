import { StyleSheet, TextInput, type TextStyle } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * A number that changes on the UI thread without re-rendering React.
 *
 * The HUD has to show live run state, but the whole point of the architecture
 * is that gameplay never triggers a render. An uneditable TextInput can have
 * its `text` prop driven straight from a shared value, so the counter updates
 * on the same thread as the simulation and React is never involved.
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
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    return { text: prefix + Math.round(value.value).toString(), defaultValue: '' };
  });

  return (
    <AnimatedTextInput
      editable={false}
      // Some platforms need an initial value for the first paint, before the
      // animated prop has run.
      defaultValue={prefix + '0'}
      style={[styles.base, style]}
      animatedProps={animatedProps}
      underlineColorAndroid="transparent"
      allowFontScaling={false}
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  base: { padding: 0, margin: 0 },
});
