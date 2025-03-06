import { Animated, Easing } from 'react-native';

// Animación de escala para celdas seleccionadas
export const cellSelectionAnimation = (scaleAnim: Animated.Value) => {
  Animated.sequence([
    Animated.timing(scaleAnim, {
      toValue: 1.15,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }),
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.cubic),
    }),
  ]).start();
};

// Animación de desvanecimiento
export const fadeAnimation = (
  fadeAnim: Animated.Value,
  toValue: number,
  duration: number = 300,
  callback?: () => void
) => {
  Animated.timing(fadeAnim, {
    toValue,
    duration,
    useNativeDriver: true,
    easing: Easing.inOut(Easing.cubic),
  }).start(callback);
};

// Animación de eliminación de celdas
export const cellRemoveAnimation = (
  scaleAnim: Animated.Value,
  opacityAnim: Animated.Value,
  callback?: () => void
) => {
  Animated.parallel([
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.5)),
      }),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.in(Easing.back(1.2)),
      }),
    ]),
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.cubic),
    }),
  ]).start(callback);
};

// Animación de aparición de celdas
export const cellAppearAnimation = (
  scaleAnim: Animated.Value,
  opacityAnim: Animated.Value,
  delay: number = 0,
  callback?: () => void
) => {
  Animated.parallel([
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 300,
      delay,
      useNativeDriver: true,
      easing: Easing.out(Easing.back(1.5)),
    }),
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 300,
      delay,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.cubic),
    }),
  ]).start(callback);
};

// Animación de pulsación
export const pulseAnimation = (
  scaleAnim: Animated.Value,
  duration: number = 800,
  min: number = 0.95,
  max: number = 1.05
) => {
  Animated.loop(
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: max,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.sin),
      }),
      Animated.timing(scaleAnim, {
        toValue: min,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.sin),
      }),
    ])
  ).start();
};

// Animación de sacudida
export const shakeAnimation = (
  translateXAnim: Animated.Value,
  intensity: number = 10,
  duration: number = 500,
  callback?: () => void
) => {
  Animated.sequence([
    Animated.timing(translateXAnim, {
      toValue: intensity,
      duration: duration / 5,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }),
    Animated.timing(translateXAnim, {
      toValue: -intensity,
      duration: duration / 5,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }),
    Animated.timing(translateXAnim, {
      toValue: intensity * 0.7,
      duration: duration / 5,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }),
    Animated.timing(translateXAnim, {
      toValue: -intensity * 0.5,
      duration: duration / 5,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }),
    Animated.timing(translateXAnim, {
      toValue: 0,
      duration: duration / 5,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }),
  ]).start(callback);
};

// Animación de nivel completado
export const levelCompleteAnimation = (
  scaleAnim: Animated.Value,
  opacityAnim: Animated.Value,
  callback?: () => void
) => {
  Animated.parallel([
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
      easing: Easing.out(Easing.back(1.7)),
    }),
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.cubic),
    }),
  ]).start(callback);
}; 