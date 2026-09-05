import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectLocale, translations } from './i18n';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('language detection', () => {
  it.each(['ru', 'ru-RU', 'ru-BY', 'RU-ru'])('uses Russian for %s', (language) => {
    expect(detectLocale(language)).toBe('ru');
  });
  it.each(['en', 'en-US', 'de-DE', '', 'rue'])('falls back to English for %s', (language) => {
    expect(detectLocale(language)).toBe('en');
  });
  it('uses browser language until the visitor chooses and remembers another language', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ru-RU');
    const i18n = await import('./i18n');
    expect(i18n.locale.value).toBe('ru');
    i18n.setLocale('en');
    expect(i18n.messages.value.search).toBe('Search by service name');
    vi.resetModules();
    expect((await import('./i18n')).locale.value).toBe('en');
  });
  it('ignores unsupported saved languages', async () => {
    localStorage.setItem('rucens-language', 'de');
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ru');
    expect((await import('./i18n')).locale.value).toBe('ru');
  });
  it('can switch languages when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    const i18n = await import('./i18n');
    i18n.setLocale('ru');
    expect(i18n.messages.value.search).toBe('Поиск по названию сервиса');
  });
});

describe('Russian counts', () => {
  it.each([
    [0, 'сервисов', 'записей', 'маршрутов'],
    [1, 'сервис', 'запись', 'маршрут'],
    [2, 'сервиса', 'записи', 'маршрута'],
    [5, 'сервисов', 'записей', 'маршрутов'],
    [11, 'сервисов', 'записей', 'маршрутов'],
    [21, 'сервис', 'запись', 'маршрут'],
    [22, 'сервиса', 'записи', 'маршрута'],
    [111, 'сервисов', 'записей', 'маршрутов'],
  ])('inflects counts for %i', (count, services, entries, routes) => {
    expect(translations.ru.selectedCount(count)).toBe(`Выбрано: ${count} ${services}`);
    expect(translations.ru.sourceCount(count, 'dns')).toBe(`${count} ${entries} в исходном списке`);
    expect(translations.ru.sourceCount(count, 'bat')).toBe(`${count} ${routes} в исходном списке`);
  });
});
