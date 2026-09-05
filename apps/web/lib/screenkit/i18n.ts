import type {
  BuiltInCategoryId,
  CategoryId,
  DeviceType,
  InsertStatus,
  Locale,
  PlaybackMode,
  UiLocale,
} from "./types"
import { FEATURE_DICTIONARIES } from "./i18n/index"
import { SNARK } from "./i18n/snark"

/** content locales: what inserts can be written in */
export const LOCALES: Locale[] = ["ru", "en"]
/** interface locales: content locales plus the sarcastic russian voice */
export const UI_LOCALES: UiLocale[] = ["ru", "en", "snark"]
export const DEFAULT_LOCALE: UiLocale = "ru"
export const LOCALE_STORAGE_KEY = "screenkit-locale"

export const isUiLocale = (value: unknown): value is UiLocale =>
  value === "ru" || value === "en" || value === "snark"

export const LANG_LABEL: Record<UiLocale, string> = {
  ru: "русский",
  en: "english",
  snark: "русский с сарказмом (¬‿¬)",
}

/* short tag used on compact toggles */
export const LANG_TAG: Record<Locale, string> = {
  ru: "ru",
  en: "en",
}

/* ---------------------------- ui dictionary ---------------------------- */

type Dict = Record<string, string>

const RU: Dict = {
  "project.name": "экранные вставки",

  // sections / nav
  "section.overview": "обзор",
  "section.library": "библиотека",
  "section.preview": "превью",
  "section.timeline": "таймлайн",
  "section.prompts": "промпты",
  "section.style": "оформление",
  "section.about": "для души",
  "nav.appearance": "оформление",
  "nav.metadata": "метаданные",
  "nav.infoForNerds": "для души",
  "nav.about": "о проекте",
  "nav.allInserts": "все вставки",
  "nav.categories": "категории",
  "nav.menu": "меню",
  "nav.navigation": "навигация",
  "nav.openMenu": "открыть меню",
  "nav.closeMenu": "закрыть меню",

  // overview
  "overview.lead":
    "приватный инструмент художественного цеха: проектируйте, просматривайте, организуйте и выгружайте экранные вставки, которые видны на телефонах, мониторах, камерах наблюдения и телевизорах в сериале. не загрузчик. не конвертер. только реквизит.",
  "overview.openLibrary": "открыть библиотеку",
  "overview.devicePreview": "превью на устройстве",
  "overview.recentInserts": "последние вставки",
  "overview.total": "всего",

  // library
  "library.title": "библиотека вставок",
  "library.desc":
    "все экранные вставки в производстве. фильтруйте по категории, устройству или статусу. откройте любую, чтобы загрузить её в превью устройства.",
  "library.search": "поиск вставок…",
  "library.category": "категория",
  "library.device": "устройство",
  "library.status": "статус",
  "library.all": "все",
  "library.dateEpisodeScene": "дата · серия · сцена",
  "library.preview": "превью",
  "library.empty": "нет вставок по этим фильтрам.",
  "library.countOne": "вставка",
  "library.countMany": "вставок",

  // timeline
  "timeline.title": "производственный таймлайн",
  "timeline.desc":
    "все вставки сгруппированы по сериям и сценам в порядке съёмки. нажмите строку, чтобы загрузить её в превью устройства.",

  // preview
  "preview.title": "превью на устройстве",
  "preview.desc":
    "загрузите вставку на рамку устройства и отгрейдируйте её под кадр. чистый источник, съёмка с экрана или грязное воспроизведение.",
  "preview.openFullscreen": "открыть как полноэкранный скрин-стейт",
  "preview.deviceFormat": "формат устройства",
  "preview.deviceFormatDesc": "физический экран, на котором появляется вставка.",
  "preview.playbackMode": "режим воспроизведения",
  "preview.aspect": "соотношение сторон",
  "preview.aspectDesc": "кадрируйте вставку под реквизитное устройство.",
  "preview.brightness": "яркость",
  "preview.brightnessDesc": "светимость экрана и спад.",
  "preview.noise": "шум",
  "preview.noiseDesc": "зерно сенсора и артефакты компрессии.",
  "preview.reflections": "отражения",
  "preview.reflectionsDesc": "блики экрана и отражения комнаты при съёмке.",
  "preview.scanlines": "строчная развёртка",
  "preview.scanlinesDesc": "паттерн строк crt / чересстрочной развёртки.",
  "preview.timestamp": "таймстамп",
  "preview.timestampDesc": "вшитая дата/время поверх кадра.",
  "preview.insertLanguage": "язык вставки",
  "preview.insertLanguageDesc":
    "язык контента внутри этой вставки. меняется отдельно и не затрагивает язык сайта.",

  // prompts
  "prompts.title": "лист промптов",
  "prompts.desc":
    "готовые к генерации промпты для каждой вставки. негативные промпты и технические заметки держат каждый экран консистентным и безопасным для бренда.",
  "prompts.id": "id",
  "prompts.episodeScene": "серия / сцена",
  "prompts.device": "устройство",
  "prompts.aspect": "соотношение",
  "prompts.full": "полный промпт",
  "prompts.short": "короткий промпт",
  "prompts.negative": "негативный промпт",
  "prompts.notes": "технические заметки",

  // style / appearance
  "style.title": "оформление",
  "style.desc":
    "визуальный язык каждой экранной вставки — терминальный интерфейс в духе cobalt со сдержанностью уровня vercel.",
  "style.language": "язык",
  "style.languageDesc":
    "язык интерфейса всего сайта. русский — основной. язык внутри отдельных вставок переключается независимо.",
  "style.palette": "палитра",
  "style.typography": "типографика",
  "style.principles": "принципы",
  "style.typeSample": "экранные вставки",
  "style.typeMono": "geist mono · съешь ещё этих мягких булок 0123456789",
  "style.typeBody":
    "основной текст остаётся в моноширинном начертании при комфортном размере с расслабленным межстрочным интервалом.",
  "style.sw.background": "фон",
  "style.sw.panel": "панель",
  "style.sw.controlActive": "активный контрол",
  "style.sw.accentOrange": "акцент оранжевый",
  "style.sw.accentGreen": "акцент зелёный",
  "style.sw.accentBlue": "акцент синий",
  "style.rule.1":
    "везде моноширный шрифт, подписи строчными. интерфейс читается как терминал, а не как буклет.",
  "style.rule.2":
    "обобщённый, небрендированный корпус устройства. никогда не воспроизводите реальный продукт или логотип.",
  "style.rule.3":
    "каждая вставка грейдится под кадр: чистая, съёмка с экрана или грязная.",
  "style.rule.4":
    "минимум интерфейса на площадке — только тихая плавающая кнопка, без хедера и футера.",
  "style.rule.5":
    "полноэкранный режим по умолчанию. скрин-стейт — это весь кадр.",

  // about
  "about.title": "о проекте",
  "about.desc":
    "система воспроизведения реквизита, которая проектирует, грейдит и поставляет фальшивые экраны из криминального сериала: телефоны, камеры наблюдения, трекеры, новостные бегущие строки и банковские терминалы.",
  "about.version": "версия",
  "about.totalInserts": "всего вставок",
  "about.categories": "категории",
  "about.defaultMode": "режим по умолчанию",
  "about.fullscreen": "полноэкранный",
  "about.architecture": "архитектура",
  "about.archDesc":
    "построено как сервис-ориентированное рабочее пространство: каждая вставка открывается как изолированный полноэкранный скрин-стейт без общего хедера или футера — только тихая плавающая кнопка для возврата, полноэкранного режима и ориентации. структура напрямую ложится на раскладку turborepo apps/*, чтобы каждая поверхность могла вырасти в отдельное приложение.",
  "about.shell": "оболочка",
  "about.ui": "ui",
  "about.screenStates": "скрин-стейты",
  "about.formfactors": "формфакторы",
  "about.formfactorsValue": "мобильный → тв",
  "about.catalogue": "каталог",
  "about.insertsSuffix": "вставок",

  // licenses
  "licenses.title": "лицензии и права",
  "licenses.desc":
    "полный список прямых зависимостей проекта с их лицензиями. список и тексты лицензий собираются автоматически из node_modules при запуске и сборке — при установке новых модулей он обновляется сам.",
  "licenses.search": "поиск по названию или лицензии…",
  "licenses.packages": "пакетов",
  "licenses.directDeps": "прямые зависимости",
  "licenses.loading": "загрузка текста лицензии…",
  "licenses.unavailable": "текст лицензии недоступен.",
  "licenses.empty": "ничего не найдено.",

  // floating menu
  "fm.back": "к предпросмотру",
  "fm.fullscreen": "полный экран",
  "fm.exitFullscreen": "выйти из полного экрана",
  "fm.rotate": "повернуть",
  "fm.landscape": "альбомная",
  "fm.portrait": "книжная",
  "fm.revealExit": "меню: выход из полного экрана",
  "fm.revealHotkey": "меню: клавиша «m»",
  "fm.revealHintExit": "выйдите из полного экрана, чтобы показать меню",
  "fm.revealHintKey": "нажмите «m», чтобы показать меню",

  // shared
  "common.copy": "копировать",
  "common.copied": "скопировано",
  "common.ruOnly": "только ru",
  "common.ruOnlyHint": "английский перевод не добавлен",

  // library editor
  "editor.addInsert": "добавить вставку",
  "editor.addCategory": "добавить категорию",
  "editor.reset": "сбросить библиотеку",
  "editor.newInsert": "новая вставка",
  "editor.newInsertDesc":
    "сохраняется на сайте и видна всем. поля на английском необязательны.",
  "editor.newCategory": "новая категория",
  "editor.newCategoryDesc":
    "категории общие для всей библиотеки и сохраняются на сайте.",
  "editor.labelRu": "название (ru)",
  "editor.labelEn": "название (en)",
  "editor.labelRuPh": "напр. дроны",
  "editor.labelEnPh": "напр. drones",
  "editor.titleRu": "заголовок (ru)",
  "editor.titleEn": "заголовок (en)",
  "editor.titleRuPh": "напр. экран блокировки телефона",
  "editor.titleEnPh": "напр. phone lock screen",
  "editor.slug": "слаг (адрес)",
  "editor.slugHint": "необязательно, латиница",
  "editor.slugPh": "напр. phone-lock-screen",
  "editor.icon": "иконка",
  "editor.iconHint": "выберите свою",
  "editor.color": "цвет",
  "editor.colorHint": "вставки в этой категории перенимают его",
  "editor.aspect": "формат кадра",
  "editor.episode": "серия",
  "editor.scene": "сцена",
  "editor.date": "дата",
  "editor.description": "описание",
  "editor.prompt": "промпт",
  "editor.shortPrompt": "короткий промпт",
  "editor.negativePrompt": "негативный промпт",
  "editor.optional": "необязательно",
  "editor.required": "заполните обязательные поля",
  "editor.save": "сохранить",
  "editor.cancel": "отмена",
  "editor.resetTitle": "сбросить библиотеку?",
  "editor.resetDesc":
    "все добавленные вставки и категории будут удалены. встроенный список вернётся к исходному состоянию.",
  "editor.resetConfirm": "сбросить",

  // appearance / theme
  "theme.mode": "режим",
  "theme.dark": "тёмная",
  "theme.light": "светлая",
  "theme.system": "системная",
  "theme.palette": "палитра",
  "theme.paletteDesc": "набор акцентных цветов интерфейса.",
  "theme.modeDesc": "светлая и тёмная схемы в стиле cobalt.tools. переключение плавно перекрашивается.",
  "theme.gradients": "градиенты",
  "theme.gradientsDesc":
    "лёгкие одноцветные градиенты на плитках категорий, иконках и акцентах. сдержанно по умолчанию — настройте под себя.",
  "theme.gradOff": "выкл",
  "theme.gradSoft": "мягкие",
  "theme.gradVivid": "яркие",
  "palette.cobalt": "кобальт",
  "palette.sunset": "закат",
  "palette.forest": "лес",
  "palette.mono": "моно",

  // motion / accessibility
  "motion.title": "движение",
  "motion.desc":
    "плавные переходы, анимации появления и скелетоны при загрузке. уменьшите движение, если анимации мешают или устройство тормозит.",
  "motion.auto": "авто",
  "motion.full": "включено",
  "motion.reduced": "уменьшено",
  "motion.autoNoteOn":
    "авто: движение уменьшено — так просит система или устройство недостаточно мощное.",
  "motion.autoNoteOff": "авто: анимации включены по предпочтениям системы.",
  "motion.manualOn": "движение уменьшено вручную.",
  "motion.manualOff": "анимации включены вручную.",

  // scale / zoom
  "scale.title": "масштаб",
  "scale.desc":
    "размер текста, отступов и элементов на сайте. подберите комфортный масштаб — настройка запоминается.",
  "scale.compact": "компактный",
  "scale.normal": "обычный",
  "scale.large": "крупный",
  "scale.huge": "очень крупный",

  // navigation extras
  "nav.changelog": "изменения",
  "nav.resizePanel": "изменить ширину панели категорий",
  "section.cloud": "облако",

  // settings hub
  "settings.title": "настройки",
  "settings.tabs.appearance": "оформление",
  "settings.tabs.cloud": "облако",

  // library extras
  "library.favorites": "избранное",
  "library.favoritesOnly": "только избранное",
  "library.clearFilters": "сбросить фильтры",
  "common.favorite": "в избранное",
  "common.unfavorite": "убрать из избранного",
  "common.delete": "удалить",
  "common.share": "скопировать ссылку",
  "common.linkCopied": "ссылка скопирована",
  "common.export": "экспорт",
  "common.prev": "назад",
  "common.next": "вперёд",
  "common.close": "закрыть",
  "common.retry": "повторить",
  "common.home": "на главную",
  "common.loading": "загрузка…",
  "common.custom": "добавлено на сайте",

  // editor extras
  "editor.noDatabase":
    "на этом деплое нет базы данных: библиотека доступна только для чтения. добавьте DATABASE_URL, чтобы сохранять вставки и категории.",
  "editor.locked": "редактирование защищено токеном",
  "editor.editToken": "токен редактирования",
  "editor.editTokenDesc":
    "сервер требует токен для изменений библиотеки. он хранится только в этом браузере и отправляется с каждым запросом.",
  "editor.editTokenPh": "вставьте токен…",
  "editor.technicalNotes": "технические заметки",
  "editor.technicalNotesHint": "по одной на строку",
  "editor.deleteInsert": "удалить вставку",
  "editor.deleteInsertDesc": "вставка будет удалена с сайта для всех. встроенные вставки удалить нельзя.",
  "editor.deleteCategory": "удалить категорию",
  "editor.deleteCategoryDesc": "категория будет удалена с сайта. сначала удалите вставки, которые в ней лежат.",
  "editor.deleteConfirm": "удалить",
  "editor.deleted": "удалено",
  "editor.saved": "сохранено",
  "editor.promptEn": "промпт (en)",
  "editor.shortPromptEn": "короткий промпт (en)",
  "editor.negativePromptEn": "негативный промпт (en)",
  "editor.descriptionEn": "описание (en)",

  // prompts extras
  "prompts.exportSheet": "скачать лист",
  "prompts.exportAll": "скачать все промпты",
  "prompts.copyAll": "копировать всё",

  // preview extras
  "preview.messenger.title": "настройки мессенджера",
  "preview.messenger.desc":
    "управляют только этой вставкой: задержкой входящего сообщения, темой, видео и плавностью анимаций.",
  "preview.messenger.dark": "тёмная",
  "preview.messenger.light": "светлая",
  "preview.messenger.delay": "задержка сообщения",
  "preview.messenger.delayDesc": "через сколько секунд неизвестный контакт отправит сообщение и пачку видео.",
  "preview.messenger.delaySuffix": " сек.",
  "preview.messenger.videoFormat": "формат видео",
  "preview.messenger.videoFormatDesc": "влияет на карточки входящих видео и открытый видеоплеер.",
  "preview.messenger.mixed": "разные",
  "preview.messenger.motion": "плавные анимации",
  "preview.messenger.motionDesc": "по умолчанию выключены; включает мягкое появление сообщений и переход в плеер.",
  "preview.messenger.hiddenNumber": "скрытый номер",
  "preview.messenger.hiddenNumberDesc": "маскирует номер неизвестного отправителя в шапке чата.",
  "preview.prevInsert": "предыдущая вставка",
  "preview.nextInsert": "следующая вставка",

  // hotkeys
  "hotkeys.title": "горячие клавиши",
  "hotkeys.desc": "работают везде, кроме полей ввода.",
  "hotkeys.search": "поиск по библиотеке",
  "hotkeys.prevNext": "предыдущая / следующая вставка",
  "hotkeys.fullscreen": "открыть скрин-стейт выбранной вставки",
  "hotkeys.favorite": "добавить выбранную вставку в избранное",
  "hotkeys.sections": "разделы: обзор, библиотека, превью, изменения, метаданные, оформление, облако",

  // appearance extras (moved from hard-coded strings)
  "style.glow": "glow эффект",
  "style.glowOn": "включён",
  "style.glowOff": "выключен",
  "style.glowDesc": "добавляет raycast-like внутреннюю окантовку и мягкое свечение к основным поверхностям интерфейса.",
  "style.width": "ширина основной части",
  "style.widthNarrow": "узкая",
  "style.widthDefault": "обычная",
  "style.widthWide": "широкая",
  "style.widthDesc":
    "работает только на экранах, где есть левая панель. на узких версиях с верхним меню содержимое всегда занимает всю доступную ширину.",
  "motion.advanced": "продвинутые настройки анимаций",
  "motion.reset": "сбросить",
  "motion.advancedDesc":
    "можно отключить конкретные семейства анимаций. fluid-курсор остаётся анимированным даже при reduce motion, пока его отдельный переключатель включён.",
  "motion.feature.sections": "появление секций",
  "motion.feature.sectionsDesc": "fade/slide-анимации при переключении разделов и блоков.",
  "motion.feature.layout": "изменение размеров",
  "motion.feature.layoutDesc": "плавная перестройка ширины, карточек и layout-контейнеров.",
  "motion.feature.skeletons": "скелетоны",
  "motion.feature.skeletonsDesc": "анимированная загрузка и shimmer перед показом контента.",
  "motion.feature.scroll": "плавный скролл",
  "motion.feature.scrollDesc": "smooth scroll для внутренних областей и переходов.",
  "motion.feature.viewTransitions": "переключения тем",
  "motion.feature.viewTransitionsDesc":
    "плавный crossfade и цветовые переходы при смене светлой/тёмной темы, палитры, масштаба и glow.",
  "motion.feature.cursor": "fluid-курсор",
  "motion.feature.cursorDesc": "плавающий курсор-шарик, который принимает форму элементов.",

  // not found / error
  "notFound.kicker": "404 / route not found",
  "notFound.title": "страница не найдена",
  "notFound.desc":
    "такого адреса в screenkit нет. вернитесь на главную страницу библиотеки вставок или выберите нужный раздел в левой панели.",
  "error.kicker": "500 / something broke",
  "error.title": "что-то пошло не так",
  "error.desc": "раздел не смог отрисоваться. попробуйте ещё раз — если ошибка повторяется, откройте журнал изменений или вернитесь на главную.",

  // cloud drive
  "cloud.title": "облако",
  "cloud.desc":
    "файловое хранилище проекта поверх приватного github-репозитория: рендеры, референсы, готовые вставки. видимость файлов и доступ задаются конфигом cloud.config.json прямо в репозитории.",
  "cloud.repo": "репозиторий",
  "cloud.branch": "ветка",
  "cloud.role": "роль",
  "cloud.role.anonymous": "гость",
  "cloud.role.viewer": "просмотр",
  "cloud.role.editor": "редактор",
  "cloud.role.owner": "владелец",
  "cloud.signedInAs": "вы вошли как",
  "cloud.notConfigured": "хранилище не подключено",
  "cloud.openOnGithub": "открыть на github",
  "cloud.refresh": "обновить",
  "cloud.connect.title": "подключение",
  "cloud.connect.desc":
    "github-токен с правом contents на репозиторий облака даёт полный доступ владельцу; ключ доступа из cloud.config.json — доступ съёмочной группе. хранится только в этом браузере.",
  "cloud.connect.token": "github-токен",
  "cloud.connect.tokenPh": "github_pat_… или ghp_…",
  "cloud.connect.key": "ключ доступа",
  "cloud.connect.keyPh": "ключ от владельца облака",
  "cloud.connect.save": "подключить",
  "cloud.connect.clear": "отключить",
  "cloud.connect.saved": "подключено",
  "cloud.init.title": "репозиторий ещё не создан",
  "cloud.init.desc":
    "создать приватный репозиторий облака под вашим аккаунтом и положить в него конфиг доступа по умолчанию. нужен github-токен владельца с правом создавать репозитории.",
  "cloud.init.button": "создать репозиторий",
  "cloud.init.created": "репозиторий создан",
  "cloud.init.exists": "репозиторий уже существует, конфиг проверен",
  "cloud.root": "корень",
  "cloud.upload": "загрузить",
  "cloud.newFolder": "новая папка",
  "cloud.folderNamePh": "название папки",
  "cloud.create": "создать",
  "cloud.empty": "папка пуста. перетащите файлы сюда или нажмите «загрузить».",
  "cloud.dropHere": "отпустите, чтобы загрузить",
  "cloud.loading": "читаю репозиторий…",
  "cloud.name": "имя",
  "cloud.size": "размер",
  "cloud.visibility": "видимость",
  "cloud.visibility.private": "приватный",
  "cloud.visibility.public": "публичный",
  "cloud.visibility.hidden": "скрытый",
  "cloud.actions": "действия",
  "cloud.download": "скачать",
  "cloud.preview": "просмотр",
  "cloud.rename": "переименовать / переместить",
  "cloud.renamePh": "новый путь, напр. renders/ep01/file.png",
  "cloud.move": "переместить",
  "cloud.delete": "удалить",
  "cloud.confirmDelete": "удалить из облака?",
  "cloud.confirmDeleteDesc": "файл или папка будут удалены из репозитория одним коммитом. история git сохранит их.",
  "cloud.uploaded": "загружено",
  "cloud.deleted": "удалено",
  "cloud.moved": "перемещено",
  "cloud.folderCreated": "папка создана",
  "cloud.tooLarge": "файл больше 4 МБ — загрузите его напрямую в репозиторий",
  "cloud.readOnly": "только просмотр: подключите токен или ключ с правом редактирования",
  "cloud.largeFile": "файл слишком большой для предпросмотра, скачайте его",
  "cloud.noPreview": "предпросмотр недоступен для этого типа файла",
  "cloud.access.title": "доступ и видимость",
  "cloud.access.desc":
    "правила применяются по порядку, последнее совпадение побеждает. шаблоны как в .gitignore: «public/**», «*.png», «renders/ep0?/**».",
  "cloud.access.defaultVisibility": "видимость по умолчанию",
  "cloud.access.rules": "правила видимости",
  "cloud.access.pattern": "шаблон",
  "cloud.access.addRule": "добавить правило",
  "cloud.access.owners": "владельцы",
  "cloud.access.editors": "редакторы",
  "cloud.access.viewers": "зрители",
  "cloud.access.loginsHint": "github-логины через запятую",
  "cloud.access.anonymousPublic": "публичные файлы видны без входа",
  "cloud.access.keys": "ключи доступа",
  "cloud.access.keysDesc":
    "ключ выдаёт роль без github-аккаунта. хранится только его sha256; сам ключ показывается один раз при создании.",
  "cloud.access.keyName": "название",
  "cloud.access.keyRole": "роль",
  "cloud.access.generateKey": "создать ключ",
  "cloud.access.keyGenerated": "новый ключ (скопируйте сейчас, больше он не покажется):",
  "cloud.access.removeKey": "убрать",
  "cloud.access.save": "сохранить конфиг",
  "cloud.access.saved": "конфиг сохранён",
  "cloud.access.ownerOnly": "менять доступ может только владелец",
}

const EN: Dict = {
  "project.name": "screen inserts",

  "section.overview": "overview",
  "section.library": "library",
  "section.preview": "preview",
  "section.timeline": "timeline",
  "section.prompts": "prompts",
  "section.style": "appearance",
  "section.about": "info for nerds",
  "nav.appearance": "appearance",
  "nav.metadata": "metadata",
  "nav.infoForNerds": "info for nerds",
  "nav.about": "about",
  "nav.allInserts": "all inserts",
  "nav.categories": "categories",
  "nav.menu": "menu",
  "nav.navigation": "navigation",
  "nav.openMenu": "open menu",
  "nav.closeMenu": "close menu",

  "overview.lead":
    "a private art-department tool to design, preview, organize and export the screen inserts seen on phones, monitors, cctv feeds and tv sets across the series. not a downloader. not a converter. just props.",
  "overview.openLibrary": "open library",
  "overview.devicePreview": "device preview",
  "overview.recentInserts": "recent inserts",
  "overview.total": "total",

  "library.title": "insert library",
  "library.desc":
    "every screen insert in the production. filter by category, device or status. open any item to load it into the device preview.",
  "library.search": "search inserts…",
  "library.category": "category",
  "library.device": "device",
  "library.status": "status",
  "library.all": "all",
  "library.dateEpisodeScene": "date · episode · scene",
  "library.preview": "preview",
  "library.empty": "no inserts match these filters.",
  "library.countOne": "insert",
  "library.countMany": "inserts",

  "timeline.title": "production timeline",
  "timeline.desc":
    "every insert grouped by episode and scene, in shooting order. tap a row to load it into the device preview.",

  "preview.title": "device preview",
  "preview.desc":
    "load an insert onto a device frame and grade it for the shot. clean source, filmed-from-screen, or dirty playback.",
  "preview.openFullscreen": "open as fullscreen screen-state",
  "preview.deviceFormat": "device format",
  "preview.deviceFormatDesc": "the physical screen the insert appears on.",
  "preview.playbackMode": "playback mode",
  "preview.aspect": "aspect ratio",
  "preview.aspectDesc": "frame the insert to match the prop device.",
  "preview.brightness": "brightness",
  "preview.brightnessDesc": "screen luminance and falloff.",
  "preview.noise": "noise",
  "preview.noiseDesc": "sensor grain and compression artefacts.",
  "preview.reflections": "reflections",
  "preview.reflectionsDesc": "screen glare and room reflections when filmed.",
  "preview.scanlines": "scanlines",
  "preview.scanlinesDesc": "crt / interlace scanline pattern.",
  "preview.timestamp": "timestamp",
  "preview.timestampDesc": "burned-in date/time overlay.",
  "preview.insertLanguage": "insert language",
  "preview.insertLanguageDesc":
    "the language of the content inside this insert. switches independently and does not affect the site language.",

  "prompts.title": "prompt sheet",
  "prompts.desc":
    "generation-ready prompts for each insert. negative prompts and technical notes keep every screen consistent and brand-safe.",
  "prompts.id": "id",
  "prompts.episodeScene": "episode / scene",
  "prompts.device": "device",
  "prompts.aspect": "aspect",
  "prompts.full": "full prompt",
  "prompts.short": "short prompt",
  "prompts.negative": "negative prompt",
  "prompts.notes": "technical notes",

  "style.title": "appearance",
  "style.desc":
    "the visual language behind every screen insert — a cobalt-style terminal interface with vercel-grade restraint.",
  "style.language": "language",
  "style.languageDesc":
    "the interface language of the whole site. russian is primary. the language inside individual inserts switches independently.",
  "style.palette": "palette",
  "style.typography": "typography",
  "style.principles": "principles",
  "style.typeSample": "screen inserts",
  "style.typeMono": "geist mono · the quick brown fox 0123456789",
  "style.typeBody":
    "body copy stays in mono at a comfortable reading size with relaxed line-height.",
  "style.sw.background": "background",
  "style.sw.panel": "panel",
  "style.sw.controlActive": "control active",
  "style.sw.accentOrange": "accent orange",
  "style.sw.accentGreen": "accent green",
  "style.sw.accentBlue": "accent blue",
  "style.rule.1":
    "monospace everywhere, lowercase labels. interface reads like a terminal, not a brochure.",
  "style.rule.2":
    "generic, unbranded device chrome. never reproduce a real product or logo.",
  "style.rule.3":
    "every insert is graded for the shot: clean, filmed-from-screen, or dirty playback.",
  "style.rule.4":
    "minimal chrome on set — only a quiet floating control, never a header or footer.",
  "style.rule.5":
    "fullscreen by default. the screen-state is the whole frame.",

  "about.title": "about",
  "about.desc":
    "a prop playback system that designs, grades and delivers the fake screens you see in a crime series: phones, cctv feeds, trackers, news tickers and bank terminals.",
  "about.version": "version",
  "about.totalInserts": "total inserts",
  "about.categories": "categories",
  "about.defaultMode": "default mode",
  "about.fullscreen": "fullscreen",
  "about.architecture": "architecture",
  "about.archDesc":
    "built as a service-oriented workspace: each insert opens as its own isolated fullscreen screen-state with no shared header or footer — only a quiet floating control for back, fullscreen and orientation. the structure maps directly onto a turborepo apps/* layout so each surface can graduate into its own deployable app.",
  "about.shell": "shell",
  "about.ui": "ui",
  "about.screenStates": "screen-states",
  "about.formfactors": "formfactors",
  "about.formfactorsValue": "mobile → tv",
  "about.catalogue": "catalogue",
  "about.insertsSuffix": "inserts",

  "licenses.title": "licenses & rights",
  "licenses.desc":
    "the full list of the project's direct dependencies with their licenses. the list and license texts are collected automatically from node_modules on dev start and build — installing new modules refreshes it on its own.",
  "licenses.search": "search by name or license…",
  "licenses.packages": "packages",
  "licenses.directDeps": "direct dependencies",
  "licenses.loading": "loading license text…",
  "licenses.unavailable": "license text unavailable.",
  "licenses.empty": "nothing found.",

  "fm.back": "back to preview",
  "fm.fullscreen": "fullscreen",
  "fm.exitFullscreen": "exit fullscreen",
  "fm.rotate": "rotate",
  "fm.landscape": "landscape",
  "fm.portrait": "portrait",
  "fm.revealExit": "menu: exit fullscreen",
  "fm.revealHotkey": "menu: press “m”",
  "fm.revealHintExit": "exit fullscreen to show the menu",
  "fm.revealHintKey": "press “m” to show the menu",

  "common.copy": "copy",
  "common.copied": "copied",
  "common.ruOnly": "ru only",
  "common.ruOnlyHint": "english translation not added",

  // library editor
  "editor.addInsert": "add insert",
  "editor.addCategory": "add category",
  "editor.reset": "reset library",
  "editor.newInsert": "new insert",
  "editor.newInsertDesc":
    "saved on the site and visible to everyone. english fields are optional.",
  "editor.newCategory": "new category",
  "editor.newCategoryDesc":
    "categories are shared across the whole library and saved on the site.",
  "editor.labelRu": "label (ru)",
  "editor.labelEn": "label (en)",
  "editor.labelRuPh": "e.g. дроны",
  "editor.labelEnPh": "e.g. drones",
  "editor.titleRu": "title (ru)",
  "editor.titleEn": "title (en)",
  "editor.titleRuPh": "e.g. экран блокировки телефона",
  "editor.titleEnPh": "e.g. phone lock screen",
  "editor.slug": "slug (url)",
  "editor.slugHint": "optional, latin only",
  "editor.slugPh": "e.g. phone-lock-screen",
  "editor.icon": "icon",
  "editor.iconHint": "pick your own",
  "editor.color": "color",
  "editor.colorHint": "inserts in this category inherit it",
  "editor.aspect": "aspect ratio",
  "editor.episode": "episode",
  "editor.scene": "scene",
  "editor.date": "date",
  "editor.description": "description",
  "editor.prompt": "prompt",
  "editor.shortPrompt": "short prompt",
  "editor.negativePrompt": "negative prompt",
  "editor.optional": "optional",
  "editor.required": "fill in the required fields",
  "editor.save": "save",
  "editor.cancel": "cancel",
  "editor.resetTitle": "reset library?",
  "editor.resetDesc":
    "all added inserts and categories will be removed. the built-in list returns to its original state.",
  "editor.resetConfirm": "reset",

  // appearance / theme
  "theme.mode": "mode",
  "theme.dark": "dark",
  "theme.light": "light",
  "theme.system": "system",
  "theme.palette": "palette",
  "theme.paletteDesc": "the set of interface accent colors.",
  "theme.modeDesc": "light and dark schemes in the cobalt.tools style. switching crossfades smoothly.",
  "theme.gradients": "gradients",
  "theme.gradientsDesc":
    "subtle single-hue gradients on category tiles, icons and accents. restrained by default — tune it to taste.",
  "theme.gradOff": "off",
  "theme.gradSoft": "soft",
  "theme.gradVivid": "vivid",
  "palette.cobalt": "cobalt",
  "palette.sunset": "sunset",
  "palette.forest": "forest",
  "palette.mono": "mono",

  // motion / accessibility
  "motion.title": "motion",
  "motion.desc":
    "smooth transitions, enter animations and loading skeletons. reduce motion if animations get in the way or the device feels slow.",
  "motion.auto": "auto",
  "motion.full": "on",
  "motion.reduced": "reduced",
  "motion.autoNoteOn":
    "auto: motion reduced — the system asks for it or the device looks underpowered.",
  "motion.autoNoteOff": "auto: animations on, following the system preference.",
  "motion.manualOn": "motion reduced manually.",
  "motion.manualOff": "animations enabled manually.",

  // scale / zoom
  "scale.title": "scale",
  "scale.desc":
    "size of text, padding and elements across the site. pick a comfortable scale — it is remembered.",
  "scale.compact": "compact",
  "scale.normal": "normal",
  "scale.large": "large",
  "scale.huge": "huge",

  // navigation extras
  "nav.changelog": "changelog",
  "nav.resizePanel": "resize the category panel",
  "section.cloud": "cloud",

  // settings hub
  "settings.title": "settings",
  "settings.tabs.appearance": "appearance",
  "settings.tabs.cloud": "cloud",

  // library extras
  "library.favorites": "favorites",
  "library.favoritesOnly": "favorites only",
  "library.clearFilters": "clear filters",
  "common.favorite": "add to favorites",
  "common.unfavorite": "remove from favorites",
  "common.delete": "delete",
  "common.share": "copy link",
  "common.linkCopied": "link copied",
  "common.export": "export",
  "common.prev": "previous",
  "common.next": "next",
  "common.close": "close",
  "common.retry": "retry",
  "common.home": "home",
  "common.loading": "loading…",
  "common.custom": "added on the site",

  // editor extras
  "editor.noDatabase":
    "this deployment has no database: the library is read-only. add DATABASE_URL to save inserts and categories.",
  "editor.locked": "editing is protected by a token",
  "editor.editToken": "edit token",
  "editor.editTokenDesc":
    "the server requires a token for library changes. it stays in this browser only and travels with every request.",
  "editor.editTokenPh": "paste the token…",
  "editor.technicalNotes": "technical notes",
  "editor.technicalNotesHint": "one per line",
  "editor.deleteInsert": "delete insert",
  "editor.deleteInsertDesc": "the insert is removed from the site for everyone. built-in inserts cannot be deleted.",
  "editor.deleteCategory": "delete category",
  "editor.deleteCategoryDesc": "the category is removed from the site. delete the inserts inside it first.",
  "editor.deleteConfirm": "delete",
  "editor.deleted": "deleted",
  "editor.saved": "saved",
  "editor.promptEn": "prompt (en)",
  "editor.shortPromptEn": "short prompt (en)",
  "editor.negativePromptEn": "negative prompt (en)",
  "editor.descriptionEn": "description (en)",

  // prompts extras
  "prompts.exportSheet": "download sheet",
  "prompts.exportAll": "download all prompts",
  "prompts.copyAll": "copy all",

  // preview extras
  "preview.messenger.title": "messenger settings",
  "preview.messenger.desc":
    "affect only this insert: the incoming message delay, theme, video format and animation smoothness.",
  "preview.messenger.dark": "dark",
  "preview.messenger.light": "light",
  "preview.messenger.delay": "message delay",
  "preview.messenger.delayDesc": "seconds until the unknown contact sends a message and a batch of videos.",
  "preview.messenger.delaySuffix": " s",
  "preview.messenger.videoFormat": "video format",
  "preview.messenger.videoFormatDesc": "applies to incoming video cards and the opened video player.",
  "preview.messenger.mixed": "mixed",
  "preview.messenger.motion": "smooth animations",
  "preview.messenger.motionDesc": "off by default; enables soft message reveals and the player transition.",
  "preview.messenger.hiddenNumber": "hidden number",
  "preview.messenger.hiddenNumberDesc": "masks the unknown sender's number in the chat header.",
  "preview.prevInsert": "previous insert",
  "preview.nextInsert": "next insert",

  // hotkeys
  "hotkeys.title": "keyboard shortcuts",
  "hotkeys.desc": "work everywhere except inside text fields.",
  "hotkeys.search": "search the library",
  "hotkeys.prevNext": "previous / next insert",
  "hotkeys.fullscreen": "open the selected insert as a screen-state",
  "hotkeys.favorite": "toggle the selected insert as favorite",
  "hotkeys.sections": "sections: overview, library, preview, changelog, metadata, appearance, cloud",

  // appearance extras (moved from hard-coded strings)
  "style.glow": "glow effect",
  "style.glowOn": "on",
  "style.glowOff": "off",
  "style.glowDesc": "adds a raycast-like inner outline and a soft glow to the main interface surfaces.",
  "style.width": "content width",
  "style.widthNarrow": "narrow",
  "style.widthDefault": "default",
  "style.widthWide": "wide",
  "style.widthDesc":
    "only applies on screens with the left panel. narrow layouts with the top menu always use the full width.",
  "motion.advanced": "advanced animation settings",
  "motion.reset": "reset",
  "motion.advancedDesc":
    "disable specific animation families. the fluid cursor stays animated even with reduced motion while its own switch is on.",
  "motion.feature.sections": "section reveals",
  "motion.feature.sectionsDesc": "fade/slide animations when switching sections and blocks.",
  "motion.feature.layout": "resizing",
  "motion.feature.layoutDesc": "smooth width changes of panels, cards and layout containers.",
  "motion.feature.skeletons": "skeletons",
  "motion.feature.skeletonsDesc": "animated loading and shimmer before content shows.",
  "motion.feature.scroll": "smooth scroll",
  "motion.feature.scrollDesc": "smooth scrolling for inner areas and jumps.",
  "motion.feature.viewTransitions": "theme switches",
  "motion.feature.viewTransitionsDesc":
    "crossfade and color transitions when changing light/dark mode, palette, scale and glow.",
  "motion.feature.cursor": "fluid cursor",
  "motion.feature.cursorDesc": "a floating cursor blob that takes the shape of elements.",

  // not found / error
  "notFound.kicker": "404 / route not found",
  "notFound.title": "page not found",
  "notFound.desc":
    "there is no such address in screenkit. go back to the insert library or pick a section in the left panel.",
  "error.kicker": "500 / something broke",
  "error.title": "something went wrong",
  "error.desc": "this section failed to render. try again — if it keeps failing, open the changelog or go home.",

  // cloud drive
  "cloud.title": "cloud drive",
  "cloud.desc":
    "project file storage on top of a private github repository: renders, references, finished inserts. file visibility and access are set in cloud.config.json inside the repository itself.",
  "cloud.repo": "repository",
  "cloud.branch": "branch",
  "cloud.role": "role",
  "cloud.role.anonymous": "guest",
  "cloud.role.viewer": "viewer",
  "cloud.role.editor": "editor",
  "cloud.role.owner": "owner",
  "cloud.signedInAs": "signed in as",
  "cloud.notConfigured": "storage is not connected",
  "cloud.openOnGithub": "open on github",
  "cloud.refresh": "refresh",
  "cloud.connect.title": "connection",
  "cloud.connect.desc":
    "a github token with contents access to the cloud repository gives the owner full access; an access key from cloud.config.json gives the crew theirs. stored in this browser only.",
  "cloud.connect.token": "github token",
  "cloud.connect.tokenPh": "github_pat_… or ghp_…",
  "cloud.connect.key": "access key",
  "cloud.connect.keyPh": "a key from the cloud owner",
  "cloud.connect.save": "connect",
  "cloud.connect.clear": "disconnect",
  "cloud.connect.saved": "connected",
  "cloud.init.title": "the repository does not exist yet",
  "cloud.init.desc":
    "create the private cloud repository under your account with a default access config. needs an owner github token allowed to create repositories.",
  "cloud.init.button": "create repository",
  "cloud.init.created": "repository created",
  "cloud.init.exists": "repository already exists, config checked",
  "cloud.root": "root",
  "cloud.upload": "upload",
  "cloud.newFolder": "new folder",
  "cloud.folderNamePh": "folder name",
  "cloud.create": "create",
  "cloud.empty": "this folder is empty. drop files here or press “upload”.",
  "cloud.dropHere": "release to upload",
  "cloud.loading": "reading the repository…",
  "cloud.name": "name",
  "cloud.size": "size",
  "cloud.visibility": "visibility",
  "cloud.visibility.private": "private",
  "cloud.visibility.public": "public",
  "cloud.visibility.hidden": "hidden",
  "cloud.actions": "actions",
  "cloud.download": "download",
  "cloud.preview": "preview",
  "cloud.rename": "rename / move",
  "cloud.renamePh": "new path, e.g. renders/ep01/file.png",
  "cloud.move": "move",
  "cloud.delete": "delete",
  "cloud.confirmDelete": "delete from the cloud?",
  "cloud.confirmDeleteDesc": "the file or folder is removed from the repository in one commit. git history keeps it.",
  "cloud.uploaded": "uploaded",
  "cloud.deleted": "deleted",
  "cloud.moved": "moved",
  "cloud.folderCreated": "folder created",
  "cloud.tooLarge": "file is over 4 MB — push it to the repository directly",
  "cloud.readOnly": "view only: connect a token or a key with edit rights",
  "cloud.largeFile": "file is too large to preview, download it instead",
  "cloud.noPreview": "no preview for this file type",
  "cloud.access.title": "access and visibility",
  "cloud.access.desc":
    "rules apply in order, the last match wins. patterns work like .gitignore: “public/**”, “*.png”, “renders/ep0?/**”.",
  "cloud.access.defaultVisibility": "default visibility",
  "cloud.access.rules": "visibility rules",
  "cloud.access.pattern": "pattern",
  "cloud.access.addRule": "add rule",
  "cloud.access.owners": "owners",
  "cloud.access.editors": "editors",
  "cloud.access.viewers": "viewers",
  "cloud.access.loginsHint": "github logins, comma separated",
  "cloud.access.anonymousPublic": "public files are visible without signing in",
  "cloud.access.keys": "access keys",
  "cloud.access.keysDesc":
    "a key grants a role without a github account. only its sha256 is stored; the key itself is shown once at creation.",
  "cloud.access.keyName": "name",
  "cloud.access.keyRole": "role",
  "cloud.access.generateKey": "generate key",
  "cloud.access.keyGenerated": "new key (copy it now, it will not be shown again):",
  "cloud.access.removeKey": "remove",
  "cloud.access.save": "save config",
  "cloud.access.saved": "config saved",
  "cloud.access.ownerOnly": "only an owner can change access",
}

/* base dictionaries + every feature dictionary, merged once at module load */
const RU_ALL: Dict = Object.assign({}, RU, ...FEATURE_DICTIONARIES.map((d) => d.ru))
const EN_ALL: Dict = Object.assign({}, EN, ...FEATURE_DICTIONARIES.map((d) => d.en))
const SNARK_ALL: Dict = Object.assign({}, SNARK, ...FEATURE_DICTIONARIES.map((d) => d.snark ?? {}))

const DICT: Record<UiLocale, Dict> = { ru: RU_ALL, en: EN_ALL, snark: SNARK_ALL }

export function translate(locale: UiLocale, key: string): string {
  return DICT[locale][key] ?? DICT.ru[key] ?? key
}

/** every key of the base + feature dictionaries for a locale (for tooling and tests) */
export function dictionaryKeys(locale: UiLocale): string[] {
  return Object.keys(DICT[locale])
}

/* ----------------------- localized entity labels ----------------------- */

export const CATEGORY_LABELS: Record<
  Locale,
  Record<BuiltInCategoryId, string>
> = {
  ru: {
    phones: "телефоны",
    cctv: "видеонаблюдение",
    trackers: "трекеры",
    "tv-news": "тв-новости",
    bank: "банк",
    "hq-monitors": "мониторы штаба",
  },
  en: {
    phones: "phones",
    cctv: "cctv",
    trackers: "trackers",
    "tv-news": "tv news",
    bank: "bank",
    "hq-monitors": "hq monitors",
  },
}

export const DEVICE_LABELS: Record<Locale, Record<DeviceType, string>> = {
  ru: {
    phone: "телефон",
    monitor: "монитор",
    tv: "тв",
    tablet: "планшет",
    projector: "проектор",
    cctv: "камера",
  },
  en: {
    phone: "phone",
    monitor: "monitor",
    tv: "tv",
    tablet: "tablet",
    projector: "projector",
    cctv: "cctv",
  },
}

export const STATUS_LABELS: Record<Locale, Record<InsertStatus, string>> = {
  ru: {
    draft: "черновик",
    ready: "готово",
    "needs review": "на проверку",
    shooting: "съёмка",
  },
  en: {
    draft: "draft",
    ready: "ready",
    "needs review": "needs review",
    shooting: "shooting",
  },
}

export const MODE_LABELS: Record<Locale, Record<PlaybackMode, string>> = {
  ru: { clean: "чистый", filmed: "съёмка с экрана", dirty: "грязный" },
  en: { clean: "clean", filmed: "filmed", dirty: "dirty" },
}

export const MODE_NOTES: Record<Locale, Record<PlaybackMode, string>> = {
  ru: {
    clean: "чёткий сгенерированный кадр-источник",
    filmed: "съёмка с экрана: муар, блум, отражения",
    dirty: "грязное воспроизведение: компрессия, артефакты cctv, выпавшие кадры",
  },
  en: {
    clean: "crisp generated source frame",
    filmed: "filmed from screen: moiré, bloom, reflections",
    dirty: "dirty playback: compression, cctv artifacts, dropped frames",
  },
}

export const categoryLabel = (id: CategoryId, locale: Locale) =>
  CATEGORY_LABELS[locale][id as BuiltInCategoryId] ??
  CATEGORY_LABELS.ru[id as BuiltInCategoryId] ??
  id
export const deviceLabel = (id: DeviceType, locale: Locale) =>
  DEVICE_LABELS[locale][id]
export const statusLabel = (id: InsertStatus, locale: Locale) =>
  STATUS_LABELS[locale][id]
export const modeLabel = (id: PlaybackMode, locale: Locale) =>
  MODE_LABELS[locale][id]
export const modeNote = (id: PlaybackMode, locale: Locale) =>
  MODE_NOTES[locale][id]
