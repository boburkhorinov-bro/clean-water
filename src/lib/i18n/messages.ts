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

  heroTitle: 'CLEAN WATER ga xush kelibsiz',
  heroLead: 'Bu siz va oilangiz salomatligi uchun xizmat qiladigan platforma.',
  heroFilters: 'Filtrlarni ko‘rish',
  heroCartridges: 'Kartrijlarni ko‘rish',
  homeCatalogTitle: 'Katalogdan',
  homeCatalogEmpty: 'Katalog hozircha to‘ldirilmoqda.',
  homeAttention: 'Diqqat talab qiladi',
  homeAllGood: 'Barcha kartrijlar joyida.',
  homeOpenMyFilter: 'Mening filtrim',

  myFilterTitle: 'Mening filtrim',
  myFilterLead: 'O‘rnatilgan apparat va kartrijlarning haqiqiy holati.',
  myFilterEmpty: 'Sizda hali qayd etilgan o‘rnatish yo‘q.',
  myFilterEmptyHint: 'O‘rnatishdan so‘ng usta uni tizimga kiritadi.',
  myFilterSignIn: 'Ma‘lumotni ko‘rish uchun ilovaga Telegram orqali kiring.',
  myFilterInstalled: 'O‘rnatilgan',
  myFilterDue: 'Almashtirish',
  myFilterAddress: 'Manzil',
  myFilterNoParts: 'Bu apparatda kartrij qayd etilmagan.',
  daysLeft: 'kun qoldi',
  daysOverdue: 'kun kechikdi',
  dueToday: 'Bugun almashtirish kerak',
  orderReplacement: 'Almashtirishga buyurtma',
  replacementSending: 'Yuborilmoqda…',
  replacementCreated: 'Arizangiz qabul qilindi. Menejer tez orada bog‘lanadi.',
  replacementAlready: 'Bu kartrij bo‘yicha ariza allaqachon qabul qilingan.',
  replacementPhoneRequired: 'Ariza uchun telefon raqami kerak.',
  replacementError: 'Ariza yuborilmadi. Birozdan so‘ng qayta urinib ko‘ring.',

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

  heroTitle: 'Добро пожаловать в CLEAN WATER',
  heroLead: 'Платформа для здоровья вас и вашей семьи.',
  heroFilters: 'Смотреть фильтры',
  heroCartridges: 'Смотреть картриджи',
  homeCatalogTitle: 'Из каталога',
  homeCatalogEmpty: 'Каталог пока наполняется.',
  homeAttention: 'Требует внимания',
  homeAllGood: 'Все картриджи в порядке.',
  homeOpenMyFilter: 'Мой фильтр',

  myFilterTitle: 'Мой фильтр',
  myFilterLead: 'Реальное состояние установленного аппарата и картриджей.',
  myFilterEmpty: 'У вас пока нет зарегистрированных установок.',
  myFilterEmptyHint: 'После установки мастер внесёт её в систему.',
  myFilterSignIn: 'Чтобы увидеть данные, войдите в приложение через Telegram.',
  myFilterInstalled: 'Установлен',
  myFilterDue: 'Замена',
  myFilterAddress: 'Адрес',
  myFilterNoParts: 'Для этого аппарата картриджи не зарегистрированы.',
  daysLeft: 'дн. осталось',
  daysOverdue: 'дн. просрочено',
  dueToday: 'Заменить сегодня',
  orderReplacement: 'Заказать замену',
  replacementSending: 'Отправляем…',
  replacementCreated: 'Заявка принята. Менеджер скоро свяжется с вами.',
  replacementAlready: 'Заявка на этот картридж уже принята.',
  replacementPhoneRequired: 'Для заявки нужен номер телефона.',
  replacementError: 'Заявка не отправлена. Попробуйте чуть позже.',

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
