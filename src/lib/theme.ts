import { createSharedComposable, useColorMode } from '@vueuse/core';

export const useTheme = createSharedComposable(() => {
  const theme = useColorMode({ emitAuto: true });

  return { theme, resolvedTheme: theme.state };
});
