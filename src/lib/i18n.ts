import { computed, ref, watchEffect } from 'vue';
import type { RestrictionType, ServiceCategory } from '@/types/registry';

export const detectLocale = (language = '') =>
  language.toLowerCase().split('-')[0] === 'ru' ? 'ru' : 'en';

const russianPluralRules = new Intl.PluralRules('ru');
const russianCount = (count: number, one: string, few: string, many: string) => {
  const form = russianPluralRules.select(count);
  const forms = { one, few, many, other: many, zero: many, two: few };
  const word = forms[form];
  return `${count} ${word}`;
};

const en = {
  registry: 'Rucens Registry',
  theme: 'Theme',
  systemTheme: 'System',
  lightTheme: 'Light',
  darkTheme: 'Dark',
  heading: 'Build your custom route list for restricted services',
  introduction:
    'Search services, filter by category and restriction type, then select what you need. The app combines your selection into a DNS routing list or a Windows',
  file: ' file.',
  routingFormat: 'Routing format',
  dnsFormat: 'DNS routing · .txt',
  batFormat: 'IP routes · .bat',
  dnsDescription:
    'Domains and CIDR ranges for KeeneticOS 5+. Only services with a DNS list are shown.',
  batDescription: 'Static IP routes in the original BAT format.',
  selectionsPreserved: 'Selections are preserved when switching formats.',
  discover: 'Discover Services',
  visibleCount: (count: number) => `${count} visible service${count === 1 ? '' : 's'}`,
  search: 'Search by service name',
  filters: 'Filters',
  filterDescription: 'Narrow results by category and restriction type',
  category: 'Category',
  restrictionType: 'Restriction type',
  clearFilters: 'Clear filters',
  selectAll: 'Select all visible',
  clearSelection: 'Clear selection',
  selected: 'Selected',
  selectService: 'Select service',
  sourceCount: (count: number, format: 'dns' | 'bat'): string => {
    const singular = format === 'dns' ? 'entry' : 'route';
    const plural = format === 'dns' ? 'entries' : 'routes';
    const word = count === 1 ? singular : plural;
    return `${count} ${word} in source list`;
  },
  mergedOutput: 'Merged Output',
  selectedCount: (count: number) => `${count} service${count === 1 ? '' : 's'} selected`,
  selectedServices: 'Selected services',
  visibleServices: 'Visible services',
  mergedEntries: 'Merged entries',
  mergedRoutes: 'Merged routes',
  preview: 'Preview',
  emptyPreview: 'No routes yet. Select one or more services from the list.',
  copy: 'Copy merged text',
  download: (extension: string) => `Download .${extension}`,
  openSettings: (protocol: string) => `Open Keenetic ${protocol} settings`,
  newTab: '(opens in a new tab)',
  copied: 'Merged routes copied to clipboard',
  copyFailed: 'Clipboard write failed in this browser context',
  downloaded: (fileName: string) => `Downloaded ${fileName}`,
  notifications: 'Notifications',
  categories: {
    adult: 'Adult',
    ai: 'Ai',
    anime: 'Anime',
    developer: 'Developer',
    education: 'Education',
    email: 'Email',
    messenger: 'Messenger',
    music: 'Music',
    productivity: 'Productivity',
    social: 'Social',
    tools: 'Tools',
    torrent: 'Torrent',
    translation: 'Translation',
    video: 'Video',
    vpn: 'Vpn',
  } satisfies Record<ServiceCategory, string>,
  restrictions: {
    rkn_blocked: 'Blocked by Roskomnadzor',
    region_not_supported: "Service doesn't support Russia",
  } satisfies Record<RestrictionType, string>,
  restrictionBadges: {
    rkn_blocked: 'RKN blocked',
    region_not_supported: 'Region restricted',
  } satisfies Record<RestrictionType, string>,
};

const ru: typeof en = {
  registry: 'Каталог Rucens',
  theme: 'Тема',
  systemTheme: 'Системная',
  lightTheme: 'Светлая',
  darkTheme: 'Тёмная',
  heading: 'Создайте свой список маршрутов для сервисов с ограниченным доступом',
  introduction:
    'Найдите сервисы, отфильтруйте их по категории и типу ограничения и выберите нужные. Приложение объединит ваш выбор в список для DNS-маршрутизации или файл Windows в формате',
  file: '.',
  routingFormat: 'Формат маршрутизации',
  dnsFormat: 'DNS-маршрутизация · .txt',
  batFormat: 'IP-маршруты · .bat',
  dnsDescription:
    'Домены и диапазоны CIDR для KeeneticOS 5+. Показаны только сервисы со списком DNS.',
  batDescription: 'Статические IP-маршруты в исходном формате BAT.',
  selectionsPreserved: 'Выбор сохраняется при переключении формата.',
  discover: 'Выбор сервисов',
  visibleCount: (count) => `В списке: ${russianCount(count, 'сервис', 'сервиса', 'сервисов')}`,
  search: 'Поиск по названию сервиса',
  filters: 'Фильтры',
  filterDescription: 'Фильтрация по категории и типу ограничения',
  category: 'Категория',
  restrictionType: 'Тип ограничения',
  clearFilters: 'Сбросить фильтры',
  selectAll: 'Выбрать все в списке',
  clearSelection: 'Снять выделение',
  selected: 'Выбрано',
  selectService: 'Выбрать сервис',
  sourceCount: (count, format) =>
    `${format === 'dns' ? russianCount(count, 'запись', 'записи', 'записей') : russianCount(count, 'маршрут', 'маршрута', 'маршрутов')} в исходном списке`,
  mergedOutput: 'Объединённый список',
  selectedCount: (count) => `Выбрано: ${russianCount(count, 'сервис', 'сервиса', 'сервисов')}`,
  selectedServices: 'Выбрано сервисов',
  visibleServices: 'Сервисов в списке',
  mergedEntries: 'Всего записей',
  mergedRoutes: 'Всего маршрутов',
  preview: 'Предпросмотр',
  emptyPreview: 'Маршрутов пока нет. Выберите один или несколько сервисов из списка.',
  copy: 'Скопировать список',
  download: (extension) => `Скачать .${extension}`,
  openSettings: (protocol) => `Открыть настройки ${protocol} в Keenetic`,
  newTab: '(откроется в новой вкладке)',
  copied: 'Объединённый список скопирован в буфер обмена',
  copyFailed: 'Не удалось скопировать текст в буфер обмена',
  downloaded: (fileName) => `Скачан файл ${fileName}`,
  notifications: 'Уведомления',
  categories: {
    adult: 'Для взрослых',
    ai: 'ИИ',
    anime: 'Аниме',
    developer: 'Разработка',
    education: 'Образование',
    email: 'Почта',
    messenger: 'Мессенджеры',
    music: 'Музыка',
    productivity: 'Продуктивность',
    social: 'Соцсети',
    tools: 'Инструменты',
    torrent: 'Торренты',
    translation: 'Перевод',
    video: 'Видео',
    vpn: 'VPN',
  },
  restrictions: {
    rkn_blocked: 'Заблокирован Роскомнадзором',
    region_not_supported: 'Сервис не работает в России',
  },
  restrictionBadges: {
    rkn_blocked: 'Блокировка РКН',
    region_not_supported: 'Региональные ограничения',
  },
};

export const translations = { en, ru };
type Locale = keyof typeof translations;
const STORAGE_KEY = 'rucens-language';

const getInitialLocale = (): Locale => {
  try {
    const savedLocale = localStorage.getItem(STORAGE_KEY);
    if (savedLocale === 'en' || savedLocale === 'ru') return savedLocale;
  } catch {
    // Browser detection still works when storage is unavailable.
  }
  return detectLocale(typeof navigator === 'undefined' ? '' : navigator.language);
};

export const locale = ref(getInitialLocale());
export const messages = computed(() => translations[locale.value]);

export const setLocale = (language: Locale) => {
  locale.value = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Keep the chosen language for this visit when storage is unavailable.
  }
};

export const syncDocumentLanguage = () => {
  watchEffect(() => {
    document.documentElement.lang = locale.value;
  });
};
