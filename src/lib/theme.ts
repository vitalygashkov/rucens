import { useDark, useToggle } from '@vueuse/core';

export const useTheme = () => {
  const isDark = useDark();
  const toggleDark = useToggle(isDark);

  return { isDark, toggleDark };
};
