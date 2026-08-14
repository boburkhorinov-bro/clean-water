import type { Locale } from './locales';

/**
 * Interfeys matnlari.
 *
 * Mahsulot kontentidan farqli o'laroq (u bazada va `localized()` orqali
 * o'zbekchaga tushadi), interfeys matnlari to'liq bo'lishi SHART. Buni
 * TypeScript majburlaydi: `ru` obyekti `typeof uz` tipida, ya'ni bitta kalit
 * unutilsa build yiqiladi. Ish vaqtidagi fallback dan ishonchliroq.
 */

const uz = {
  brand: 'Clean Water',
  tagline: 'Siz va oilangiz salomatligi uchun',

  navFilters: 'Osmos filtrlar',
  navCartridges: 'Kartrijlar',
  navMyFilter: 'Mening filtrim',

  catalogFiltersTitle: 'Osmos suv filtrlari',
  catalogFiltersLead: 'Uy va ofis uchun teskari osmos tizimlari.',
  catalogCartridgesTitle: 'Almashtirish kartrijlari',
  catalogCartridgesLead: 'Har bir kartrij o‘z muddatiga ega — pastda ko‘rsatilgan.',
  catalogEmpty: 'Hozircha mahsulot qo‘shilmagan.',

  price: 'Narxi',
  currency: 'so‘m',
  resource: 'Almashtirish muddati',
  months: 'oy',
  compatibleWith: 'Mos filtrlar',
  compatibleCartridges: 'Bu filtrga mos kartrijlar',
  noCompatible: 'Mos kartrijlar hali ko‘rsatilmagan.',

  order: 'Buyurtma berish',
  orderTitle: 'Ariza qoldirish',
  orderLead: 'Telefon raqamingizni qoldiring — menejer bog‘lanadi.',
  formName: 'Ismingiz',
  formPhone: 'Telefon raqami',
  formComment: 'Izoh',
  formOptional: 'ixtiyoriy',
  formSubmit: 'Ariza yuborish',
  formSending: 'Yuborilmoqda…',
  formSuccess: 'Arizangiz qabul qilindi. Menejer tez orada bog‘lanadi.',
  formErrorPhone: 'Telefon raqamini tekshiring. Namuna: +998 90 123 45 67',
  formErrorRate: 'Juda ko‘p urinish. Biroz kutib, qayta yuboring.',
  formErrorGeneric: 'Ariza yuborilmadi. Birozdan so‘ng qayta urinib ko‘ring.',

  themeToLight: 'Kunduzgi mavzu',
  themeToDark: 'Tungi mavzu',
  languageUz: 'O‘zbekcha',
  languageRu: 'Ruscha',

  notFoundTitle: 'Sahifa topilmadi',
  notFoundBack: 'Bosh sahifaga qaytish',
} as const;

export type MessageKey = keyof typeof uz;
export type Messages = Record<MessageKey, string>;

/**
 * `Record<MessageKey, string>` — bitta kalit unutilsa TypeScript build ni
 * yiqitadi. `typeof uz` emas, chunki `as const` tufayli u qiymatlarni ham
 * literal sifatida talab qilardi.
 */
const ru: Messages = {
  brand: 'Clean Water',
  tagline: 'Для здоровья вас и вашей семьи',

  navFilters: 'Осмос-фильтры',
  navCartridges: 'Картриджи',
  navMyFilter: 'Мой фильтр',

  catalogFiltersTitle: 'Фильтры обратного осмоса',
  catalogFiltersLead: 'Системы обратного осмоса для дома и офиса.',
  catalogCartridgesTitle: 'Сменные картриджи',
  catalogCartridgesLead: 'У каждого картриджа свой срок — он указан ниже.',
  catalogEmpty: 'Товары пока не добавлены.',

  price: 'Цена',
  currency: 'сум',
  resource: 'Срок замены',
  months: 'мес.',
  compatibleWith: 'Подходит к фильтрам',
  compatibleCartridges: 'Картриджи для этого фильтра',
  noCompatible: 'Совместимые картриджи пока не указаны.',

  order: 'Заказать',
  orderTitle: 'Оставить заявку',
  orderLead: 'Оставьте номер телефона — менеджер свяжется с вами.',
  formName: 'Ваше имя',
  formPhone: 'Номер телефона',
  formComment: 'Комментарий',
  formOptional: 'необязательно',
  formSubmit: 'Отправить заявку',
  formSending: 'Отправляем…',
  formSuccess: 'Заявка принята. Менеджер скоро свяжется с вами.',
  formErrorPhone: 'Проверьте номер телефона. Пример: +998 90 123 45 67',
  formErrorRate: 'Слишком много попыток. Подождите и отправьте снова.',
  formErrorGeneric: 'Заявка не отправлена. Попробуйте чуть позже.',

  themeToLight: 'Дневная тема',
  themeToDark: 'Ночная тема',
  languageUz: 'Узбекский',
  languageRu: 'Русский',

  notFoundTitle: 'Страница не найдена',
  notFoundBack: 'Вернуться на главную',
};

const dictionaries: Record<Locale, Messages> = { uz, ru };

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}
