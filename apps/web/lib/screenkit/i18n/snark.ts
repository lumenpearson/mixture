import type { Dict } from "./index"

/* the "snark" interface voice: russian with light sarcasm and kaomoji.
   Any key missing here falls back to plain russian at runtime, but the goal
   is full coverage of every base and feature key. */
export const SNARK: Dict = {
  "project.name": "экранные вставки",

  // sections / nav
  "section.overview": "обзор",
  "section.library": "библиотека",
  "section.preview": "превью",
  "section.timeline": "таймлайн",
  "section.prompts": "промпты",
  "section.style": "оформление",
  "section.about": "для души (¬‿¬)",
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
    "приватный инструмент художественного цеха (¬‿¬): проектируйте, просматривайте, организуйте и выгружайте экранные вставки, которые видны на телефонах, мониторах, камерах наблюдения и телевизорах в сериале. не загрузчик. не конвертер. только реквизит, не благодарите.",
  "overview.openLibrary": "открыть библиотеку",
  "overview.devicePreview": "превью на устройстве",
  "overview.recentInserts": "последние вставки",
  "overview.total": "всего",

  // library
  "library.title": "библиотека вставок",
  "library.desc":
    "все экранные вставки в производстве, до последней штуки. фильтруйте по категории, устройству или статусу и открывайте любую, чтобы закинуть её в превью устройства ( •_•)>⌐■-■",
  "library.search": "поиск вставок…",
  "library.category": "категория",
  "library.device": "устройство",
  "library.status": "статус",
  "library.all": "все",
  "library.dateEpisodeScene": "дата · серия · сцена",
  "library.preview": "превью",
  "library.empty": "по этим фильтрам вставок нет — попробуйте другие ¯\\_(ツ)_/¯",
  "library.countOne": "вставка",
  "library.countMany": "вставок",

  // timeline
  "timeline.title": "производственный таймлайн",
  "timeline.desc":
    "все вставки разложены по сериям и сценам в порядке съёмки, как и положено приличным людям. нажмите строку — она сама загрузится в превью устройства.",

  // preview
  "preview.title": "превью на устройстве",
  "preview.desc":
    "закиньте вставку на рамку устройства и отгрейдируйте под кадр: чистый источник, съёмка с экрана или совсем грязное воспроизведение — на любой вкус (¬‿¬).",
  "preview.openFullscreen": "открыть как полноэкранный скрин-стейт",
  "preview.deviceFormat": "формат устройства",
  "preview.deviceFormatDesc": "физический экран, на котором это всё будет жить.",
  "preview.playbackMode": "режим воспроизведения",
  "preview.aspect": "соотношение сторон",
  "preview.aspectDesc": "подгоните вставку под реквизитное устройство.",
  "preview.brightness": "яркость",
  "preview.brightnessDesc": "свечение экрана и то, как оно гаснет.",
  "preview.noise": "шум",
  "preview.noiseDesc": "зерно сенсора и артефакты компрессии — красота, а не брак.",
  "preview.reflections": "отражения",
  "preview.reflectionsDesc": "блики экрана и отражения комнаты при съёмке.",
  "preview.scanlines": "строчная развёртка",
  "preview.scanlinesDesc": "паттерн строк crt / чересстрочной развёртки.",
  "preview.timestamp": "таймстамп",
  "preview.timestampDesc": "вшитая дата/время поверх кадра.",
  "preview.insertLanguage": "язык вставки",
  "preview.insertLanguageDesc":
    "язык контента внутри именно этой вставки. переключается отдельно и язык сайта не трогает, расслабьтесь.",

  // prompts
  "prompts.title": "лист промптов",
  "prompts.desc":
    "промпты, готовые к генерации, — для каждой вставки. негативные промпты и технические заметки держат все экраны в тонусе и не дают бренду опозориться (¬‿¬).",
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
    "визуальный язык каждой вставки: терминальный интерфейс в духе cobalt и сдержанность уровня vercel — минимализм, но с характером.",
  "style.language": "язык",
  "style.languageDesc":
    "язык интерфейса всего сайта. русский тут главный, а внутри отдельных вставок язык переключается отдельно и никого не спрашивает.",
  "style.palette": "палитра",
  "style.typography": "типографика",
  "style.principles": "принципы",
  "style.typeSample": "экранные вставки",
  "style.typeMono": "geist mono · съешь ещё этих мягких булок 0123456789",
  "style.typeBody":
    "основной текст остаётся моноширинным, комфортного размера и с расслабленным межстрочным интервалом — как и подобает приличному терминалу.",
  "style.sw.background": "фон",
  "style.sw.panel": "панель",
  "style.sw.controlActive": "активный контрол",
  "style.sw.accentOrange": "акцент оранжевый",
  "style.sw.accentGreen": "акцент зелёный",
  "style.sw.accentBlue": "акцент синий",
  "style.rule.1":
    "везде моноширный шрифт, подписи строчными. интерфейс должен читаться как терминал, а не как рекламный буклет ┐(￣ヘ￣)┌.",
  "style.rule.2":
    "обобщённый, небрендированный корпус устройства. никогда не воспроизводите реальный продукт или логотип — юристы не одобрят.",
  "style.rule.3":
    "каждая вставка грейдится под кадр: чистая, съёмка с экрана или грязная — на выбор.",
  "style.rule.4":
    "минимум интерфейса на площадке: только тихая плавающая кнопка, без хедера и футера — никто вас не отвлекает.",
  "style.rule.5":
    "полноэкранный режим по умолчанию: скрин-стейт — это весь кадр, целиком.",

  // about
  "about.title": "о проекте",
  "about.desc":
    "система воспроизведения реквизита: проектирует, грейдит и поставляет фальшивые экраны для криминального сериала — телефоны, камеры наблюдения, трекеры, новостные бегущие строки и банковские терминалы, всё понарошку (¬‿¬).",
  "about.version": "версия",
  "about.totalInserts": "всего вставок",
  "about.categories": "категории",
  "about.defaultMode": "режим по умолчанию",
  "about.fullscreen": "полноэкранный",
  "about.architecture": "архитектура",
  "about.archDesc":
    "построено как сервис-ориентированное рабочее пространство: каждая вставка открывается как изолированный полноэкранный скрин-стейт без общего хедера или футера — только тихая плавающая кнопка для возврата, полноэкранного режима и ориентации. структура один в один ложится на раскладку turborepo apps/*, чтобы любая поверхность однажды выросла в отдельное приложение, если размечтается.",
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
    "полный список прямых зависимостей проекта и их лицензий. список и тексты лицензий сами себя собирают из node_modules при запуске и сборке — установили новый модуль, и всё обновилось само, руками трогать не надо (¬‿¬).",
  "licenses.search": "поиск по названию или лицензии…",
  "licenses.packages": "пакетов",
  "licenses.directDeps": "прямые зависимости",
  "licenses.loading": "загрузка текста лицензии…",
  "licenses.unavailable": "текст лицензии недоступен — бывает и так ¯\\_(ツ)_/¯",
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
  "fm.revealHintExit": "выйдите из полного экрана — тогда покажется меню",
  "fm.revealHintKey": "нажмите «m» — появится меню",

  // shared
  "common.copy": "копировать",
  "common.copied": "скопировано",
  "common.ruOnly": "только ru",
  "common.ruOnlyHint": "английский перевод пока не подвезли",

  // library editor
  "editor.addInsert": "добавить вставку",
  "editor.addCategory": "добавить категорию",
  "editor.reset": "сбросить библиотеку",
  "editor.newInsert": "новая вставка",
  "editor.newInsertDesc":
    "сохранится на сайте и будет видна всем — без права на анонимность. поля на английском необязательны, но кто мы такие, чтобы отговаривать.",
  "editor.newCategory": "новая категория",
  "editor.newCategoryDesc":
    "категории общие для всей библиотеки и сохраняются на сайте — сами по себе не разъедутся.",
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
  "editor.iconHint": "выберите ту, что по душе",
  "editor.color": "цвет",
  "editor.colorHint": "вставки в этой категории послушно перенимают его",
  "editor.aspect": "формат кадра",
  "editor.episode": "серия",
  "editor.scene": "сцена",
  "editor.date": "дата",
  "editor.description": "описание",
  "editor.prompt": "промпт",
  "editor.shortPrompt": "короткий промпт",
  "editor.negativePrompt": "негативный промпт",
  "editor.optional": "необязательно",
  "editor.required": "заполните обязательные поля, будьте так добры",
  "editor.save": "сохранить",
  "editor.cancel": "отмена",
  "editor.resetTitle": "точно сбросить библиотеку?",
  "editor.resetDesc":
    "все добавленные вставки и категории будут удалены без права на апелляцию. встроенный список вернётся к исходному состоянию, как будто ничего и не было (￣ヘ￣).",
  "editor.resetConfirm": "сбросить",

  // appearance / theme
  "theme.mode": "режим",
  "theme.dark": "тёмная",
  "theme.light": "светлая",
  "theme.system": "системная",
  "theme.palette": "палитра",
  "theme.paletteDesc": "набор акцентных цветов интерфейса — выбирайте со вкусом.",
  "theme.modeDesc": "светлая и тёмная схемы в стиле cobalt.tools. переключение перекрашивается плавно, без дёрганья.",
  "theme.gradients": "градиенты",
  "theme.gradientsDesc":
    "лёгкие одноцветные градиенты на плитках категорий, иконках и акцентах. по умолчанию сдержанно — прибавьте яркости, если душа просит (◕‿◕).",
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
    "плавные переходы, анимации появления и скелетоны при загрузке. уменьшите движение, если анимации раздражают или устройство еле дышит.",
  "motion.auto": "авто",
  "motion.full": "включено",
  "motion.reduced": "уменьшено",
  "motion.autoNoteOn":
    "авто: движение уменьшено — так просит система, или устройство просто не тянет.",
  "motion.autoNoteOff": "авто: анимации включены по предпочтениям системы.",
  "motion.manualOn": "движение уменьшено вручную.",
  "motion.manualOff": "анимации включены вручную.",

  // scale / zoom
  "scale.title": "масштаб",
  "scale.desc":
    "размер текста, отступов и элементов на сайте. подберите то, что удобно глазам — настройка запомнится сама.",
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
    "на этом деплое нет базы данных: библиотека только для чтения, увы. добавьте DATABASE_URL, чтобы сохранять вставки и категории по-настоящему.",
  "editor.locked": "редактирование защищено токеном",
  "editor.editToken": "токен редактирования",
  "editor.editTokenDesc":
    "сервер требует токен для любых изменений библиотеки. он живёт только в этом браузере и едет с каждым запросом, никуда больше не путешествует.",
  "editor.editTokenPh": "вставьте токен…",
  "editor.technicalNotes": "технические заметки",
  "editor.technicalNotesHint": "по одной на строку",
  "editor.deleteInsert": "удалить вставку",
  "editor.deleteInsertDesc": "вставка исчезнет с сайта для всех и сразу. встроенные вставки трогать нельзя — они на особом положении.",
  "editor.deleteCategory": "удалить категорию",
  "editor.deleteCategoryDesc": "категория исчезнет с сайта. сначала разберитесь со вставками внутри — сама она не опустеет.",
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
    "управляют только этой вставкой: задержкой входящего сообщения, темой, видео и тем, насколько плавно всё анимируется.",
  "preview.messenger.dark": "тёмная",
  "preview.messenger.light": "светлая",
  "preview.messenger.delay": "задержка сообщения",
  "preview.messenger.delayDesc": "через сколько секунд неизвестный контакт напишет и вывалит пачку видео.",
  "preview.messenger.delaySuffix": " сек.",
  "preview.messenger.videoFormat": "формат видео",
  "preview.messenger.videoFormatDesc": "влияет на карточки входящих видео и открытый видеоплеер.",
  "preview.messenger.mixed": "разные",
  "preview.messenger.motion": "плавные анимации",
  "preview.messenger.motionDesc": "по умолчанию выключены. включите — сообщения будут мягко всплывать, а переход в плеер станет плавным.",
  "preview.messenger.hiddenNumber": "скрытый номер",
  "preview.messenger.hiddenNumberDesc": "маскирует номер неизвестного отправителя в шапке чата.",
  "preview.prevInsert": "предыдущая вставка",
  "preview.nextInsert": "следующая вставка",

  // hotkeys
  "hotkeys.title": "горячие клавиши",
  "hotkeys.desc": "работают везде, кроме полей ввода — туда не лезут, не переживайте.",
  "hotkeys.search": "поиск по библиотеке",
  "hotkeys.prevNext": "предыдущая / следующая вставка",
  "hotkeys.fullscreen": "открыть скрин-стейт выбранной вставки",
  "hotkeys.favorite": "добавить выбранную вставку в избранное",
  "hotkeys.sections": "разделы: обзор, библиотека, превью, изменения, метаданные, оформление, облако",

  // appearance extras (moved from hard-coded strings)
  "style.glow": "glow эффект",
  "style.glowOn": "включён",
  "style.glowOff": "выключен",
  "style.glowDesc": "добавляет raycast-style внутреннюю окантовку и мягкое свечение основным поверхностям интерфейса — немного волшебства, но со вкусом.",
  "style.width": "ширина основной части",
  "style.widthNarrow": "узкая",
  "style.widthDefault": "обычная",
  "style.widthWide": "широкая",
  "style.widthDesc":
    "работает только там, где есть левая панель. на узких версиях с верхним меню контент и так занимает всё доступное место — тут выбирать не из чего.",
  "motion.advanced": "продвинутые настройки анимаций",
  "motion.reset": "сбросить",
  "motion.advancedDesc":
    "можно отключить конкретные семейства анимаций поодиночке. fluid-курсор остаётся живым даже при reduce motion, пока его отдельный переключатель горит.",
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
  "motion.feature.cursorDesc": "плавающий курсор-шарик, который подстраивается под форму элементов, как приличный хамелеон (っ◔◡◔)っ.",

  // not found / error
  "notFound.kicker": "404 / route not found",
  "notFound.title": "страница не найдена",
  "notFound.desc":
    "такого адреса в screenkit не существует и никогда не существовало (ಠ_ಠ). вернитесь на главную страницу библиотеки вставок или выберите нужный раздел в левой панели.",
  "error.kicker": "500 / something broke",
  "error.title": "что-то пошло не так",
  "error.desc": "раздел не смог отрисоваться, бывает и такое. попробуйте ещё раз — если ошибка повторяется, откройте журнал изменений или тихо вернитесь на главную.",

  // cloud drive
  "cloud.title": "облако",
  "cloud.desc":
    "файловое хранилище проекта поверх приватного github-репозитория: рендеры, референсы, готовые вставки. видимость файлов и доступ живут в конфиге cloud.config.json прямо в репозитории — там и разбирайтесь.",
  "cloud.repo": "репозиторий",
  "cloud.branch": "ветка",
  "cloud.role": "роль",
  "cloud.role.anonymous": "гость",
  "cloud.role.viewer": "просмотр",
  "cloud.role.editor": "редактор",
  "cloud.role.owner": "владелец",
  "cloud.signedInAs": "вы вошли как",
  "cloud.notConfigured": "хранилище пока не подключено",
  "cloud.openOnGithub": "открыть на github",
  "cloud.refresh": "обновить",
  "cloud.connect.title": "подключение",
  "cloud.connect.desc":
    "github-токен с правом contents на репозиторий облака даёт владельцу полный доступ; ключ из cloud.config.json — доступ съёмочной группе, без токенов и драмы. хранится только в этом браузере.",
  "cloud.connect.token": "github-токен",
  "cloud.connect.tokenPh": "github_pat_… или ghp_…",
  "cloud.connect.key": "ключ доступа",
  "cloud.connect.keyPh": "ключ от владельца облака",
  "cloud.connect.save": "подключить",
  "cloud.connect.clear": "отключить",
  "cloud.connect.saved": "подключено",
  "cloud.init.title": "репозиторий ещё не создан",
  "cloud.init.desc":
    "создаст приватный репозиторий облака под вашим аккаунтом и положит туда конфиг доступа по умолчанию. нужен github-токен владельца с правом создавать репозитории — простых смертных сюда не пускают.",
  "cloud.init.button": "создать репозиторий",
  "cloud.init.created": "репозиторий создан",
  "cloud.init.exists": "репозиторий уже существует, конфиг проверен",
  "cloud.root": "корень",
  "cloud.upload": "загрузить",
  "cloud.newFolder": "новая папка",
  "cloud.folderNamePh": "название папки",
  "cloud.create": "создать",
  "cloud.empty": "папка пуста, как и было задумано. перетащите файлы сюда или нажмите «загрузить».",
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
  "cloud.confirmDelete": "точно удалить из облака?",
  "cloud.confirmDeleteDesc": "файл или папка исчезнут из репозитория одним коммитом. история git их всё равно не забудет — такая уж у неё память.",
  "cloud.uploaded": "загружено",
  "cloud.deleted": "удалено",
  "cloud.moved": "перемещено",
  "cloud.folderCreated": "папка создана",
  "cloud.tooLarge": "файл больше 4 МБ — загрузите его напрямую в репозиторий",
  "cloud.readOnly": "только просмотр: подключите токен или ключ с правом редактирования",
  "cloud.largeFile": "файл слишком большой для предпросмотра, скачайте его",
  "cloud.noPreview": "для этого типа файла предпросмотра не завезли",
  "cloud.access.title": "доступ и видимость",
  "cloud.access.desc":
    "правила применяются по порядку, и последнее совпадение всегда побеждает — демократия тут не работает. шаблоны как в .gitignore: «public/**», «*.png», «renders/ep0?/**».",
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
    "ключ выдаёт роль без всякого github-аккаунта. хранится только его sha256, а сам ключ показывается один раз при создании — цените этот момент.",
  "cloud.access.keyName": "название",
  "cloud.access.keyRole": "роль",
  "cloud.access.generateKey": "создать ключ",
  "cloud.access.keyGenerated": "новый ключ — скопируйте прямо сейчас, второго шанса не будет:",
  "cloud.access.removeKey": "убрать",
  "cloud.access.save": "сохранить конфиг",
  "cloud.access.saved": "конфиг сохранён",
  "cloud.access.ownerOnly": "доступ меняет только владелец, остальным сюда нельзя",
}
