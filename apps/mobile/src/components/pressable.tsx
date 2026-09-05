import * as Haptics from "expo-haptics"
import * as React from "react"
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/* ------------------------------------------------------------------ *
 * press feedback
 *
 * A 120 ms scale on press-in, the touch equivalent of the hover states in
 * the web shell. The animation runs on the ui thread, so a list that is
 * still fetching stays at 60 fps while a row is held.
 * ------------------------------------------------------------------ */

export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; children: React.ReactNode }) {
  const pressed = useSharedValue(0)
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
  }))

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: 120 })
        rest.onPressIn?.(event)
      }}
      onPressOut={(event) => {
        pressed.value = withTiming(0, { duration: 120 })
        rest.onPressOut?.(event)
      }}
      onLongPress={
        rest.onLongPress
          ? (event) => {
              // the menu appears without a visible transition of its own, so
              // the tick is what tells the finger the press was registered
              void Haptics.selectionAsync()
              rest.onLongPress?.(event)
            }
          : undefined
      }
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  )
}
