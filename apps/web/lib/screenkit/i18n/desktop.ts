import type { FeatureDictionary } from "./index"

/* strings for the desktop title bar, its settings and the offline screen —
   keep ru and en key sets identical */
const dictionary: FeatureDictionary = {
  ru: {
    // title bar
    "desktop.titlebar.brand": "mixture · screenkit",
    "desktop.titlebar.label": "заголовок окна",
    "desktop.titlebar.minimize": "свернуть окно",
    "desktop.titlebar.maximize": "развернуть окно",
    "desktop.titlebar.restore": "восстановить размер окна",
    "desktop.titlebar.close": "закрыть окно",

    // settings card
    "desktop.settings.title": "десктоп",
    "desktop.settings.desc": "как ведёт себя окно приложения и как выглядит наша верхняя панель вместо системной рамки.",
    "desktop.settings.webOnly": "эти настройки живут в десктопном приложении: в браузере окном управляет сама система.",
    "desktop.settings.window": "окно",
    "desktop.settings.alwaysOnTop": "поверх всех окон",
    "desktop.settings.alwaysOnTopDesc": "окно остаётся видимым поверх монтажки и просмотрщика материала.",
    "desktop.settings.startMaximized": "открывать развёрнутым",
    "desktop.settings.startMaximizedDesc": "при запуске окно сразу занимает весь экран.",
    "desktop.settings.remember": "запоминать размер и положение",
    "desktop.settings.rememberDesc":
      "оболочка сама сохраняет размер, положение и развёрнутое состояние окна рядом с данными приложения; переключатель решает, восстанавливать ли их при запуске.",
    "desktop.settings.minSize": "минимальный размер",
    "desktop.settings.minSizeDesc": "ниже этого предела окно не сжимается — рельса и контент перестают помещаться рядом.",
    "desktop.settings.minSize.none": "без ограничения",
    "desktop.settings.bar": "верхняя панель",
    "desktop.settings.showBar": "показывать панель",
    "desktop.settings.showBarDesc": "полоса с названием, разделом и кнопками окна вместо системного заголовка.",
    "desktop.settings.compact": "компактная высота",
    "desktop.settings.compactDesc": "32 пикселя вместо 40 — больше места под контент.",
    "desktop.settings.side": "сторона кнопок",
    "desktop.settings.sideDesc": "где стоят «свернуть», «развернуть» и «закрыть».",
    "desktop.settings.side.left": "слева",
    "desktop.settings.side.right": "справа",
    "desktop.settings.clock": "часы",
    "desktop.settings.clockDesc": "текущее время в панели — удобно, когда окно закрывает системную панель задач.",
    "desktop.settings.sectionTitle": "название раздела",
    "desktop.settings.sectionTitleDesc": "в панели видно, какой раздел открыт.",
    "desktop.settings.accentLine": "акцентная линия",
    "desktop.settings.accentLineDesc": "тонкая цветная полоса под панелью отделяет её от контента.",
    "desktop.settings.reset": "сбросить настройки десктопа",

    // offline screen
    "desktop.offline.label": "нет сети",
    "desktop.offline.title": "нет подключения к интернету",
    "desktop.offline.desc":
      "приложение не может достучаться до сервера: библиотека, облако и список изменений не обновятся, пока связь не вернётся.",
    "desktop.offline.hint": "встроенные вставки и локальные файлы работают и без сети.",
    "desktop.offline.retry": "повторить",
    "desktop.offline.retrying": "проверяем…",
    "desktop.offline.continue": "продолжить без сети",
    "desktop.offline.restored": "соединение восстановлено",
  },
  en: {
    // title bar
    "desktop.titlebar.brand": "mixture · screenkit",
    "desktop.titlebar.label": "window title bar",
    "desktop.titlebar.minimize": "minimize the window",
    "desktop.titlebar.maximize": "maximize the window",
    "desktop.titlebar.restore": "restore the window size",
    "desktop.titlebar.close": "close the window",

    // settings card
    "desktop.settings.title": "desktop",
    "desktop.settings.desc": "how the application window behaves and how our own title bar looks instead of the system frame.",
    "desktop.settings.webOnly": "these settings live in the desktop app: in a browser the window belongs to the system.",
    "desktop.settings.window": "window",
    "desktop.settings.alwaysOnTop": "always on top",
    "desktop.settings.alwaysOnTopDesc": "the window stays visible above the edit timeline and the footage viewer.",
    "desktop.settings.startMaximized": "start maximized",
    "desktop.settings.startMaximizedDesc": "the window fills the screen as soon as it opens.",
    "desktop.settings.remember": "remember size and position",
    "desktop.settings.rememberDesc":
      "the shell saves the window size, position and maximized state next to the app data on its own; this switch decides whether they are restored on start.",
    "desktop.settings.minSize": "minimum size",
    "desktop.settings.minSizeDesc": "below this the window stops shrinking — the rail and the content no longer fit side by side.",
    "desktop.settings.minSize.none": "no minimum",
    "desktop.settings.bar": "title bar",
    "desktop.settings.showBar": "show the bar",
    "desktop.settings.showBarDesc": "a strip with the name, the section and the window buttons instead of the system title.",
    "desktop.settings.compact": "compact height",
    "desktop.settings.compactDesc": "32 pixels instead of 40 — more room for the content.",
    "desktop.settings.side": "buttons side",
    "desktop.settings.sideDesc": "where minimize, maximize and close sit.",
    "desktop.settings.side.left": "left",
    "desktop.settings.side.right": "right",
    "desktop.settings.clock": "clock",
    "desktop.settings.clockDesc": "the current time in the bar — useful when the window covers the system taskbar.",
    "desktop.settings.sectionTitle": "section title",
    "desktop.settings.sectionTitleDesc": "the bar shows which section is open.",
    "desktop.settings.accentLine": "accent line",
    "desktop.settings.accentLineDesc": "a thin coloured line under the bar separates it from the content.",
    "desktop.settings.reset": "reset the desktop settings",

    // offline screen
    "desktop.offline.label": "no network",
    "desktop.offline.title": "no internet connection",
    "desktop.offline.desc":
      "the app cannot reach the server: the library, the cloud and the changelog will not update until the connection is back.",
    "desktop.offline.hint": "the built-in inserts and local files work without a network.",
    "desktop.offline.retry": "retry",
    "desktop.offline.retrying": "checking…",
    "desktop.offline.continue": "continue without a network",
    "desktop.offline.restored": "connection restored",
  },
  snark: {
    // title bar
    "desktop.titlebar.brand": "mixture · screenkit",
    "desktop.titlebar.label": "заголовок окна",
    "desktop.titlebar.minimize": "свернуть окно",
    "desktop.titlebar.maximize": "развернуть окно",
    "desktop.titlebar.restore": "вернуть окну прежний размер",
    "desktop.titlebar.close": "закрыть окно",

    // settings card
    "desktop.settings.title": "десктоп",
    "desktop.settings.desc": "как ведёт себя окно и как выглядит наша панель вместо системной рамки, которую мы сочли недостаточно красивой.",
    "desktop.settings.webOnly": "эти настройки живут в десктопном приложении. в браузере окном распоряжается система, и спорить с ней бесполезно.",
    "desktop.settings.window": "окно",
    "desktop.settings.alwaysOnTop": "поверх всех окон",
    "desktop.settings.alwaysOnTopDesc": "окно будет нависать над монтажкой. вы сами попросили.",
    "desktop.settings.startMaximized": "открывать развёрнутым",
    "desktop.settings.startMaximizedDesc": "при запуске окно сразу забирает весь экран.",
    "desktop.settings.remember": "запоминать размер и положение",
    "desktop.settings.rememberDesc":
      "оболочка запоминает размер, положение и развёрнутое состояние окна сама, даже когда вы об этом не просили. переключатель решает только одно: возвращать ли всё это при запуске.",
    "desktop.settings.minSize": "минимальный размер",
    "desktop.settings.minSizeDesc": "дальше окно не сжимается: рельса и контент рядом уже не помещаются.",
    "desktop.settings.minSize.none": "без ограничения",
    "desktop.settings.bar": "верхняя панель",
    "desktop.settings.showBar": "показывать панель",
    "desktop.settings.showBarDesc": "полоса с названием, разделом и кнопками окна — вместо системного заголовка.",
    "desktop.settings.compact": "компактная высота",
    "desktop.settings.compactDesc": "32 пикселя вместо 40. целых восемь пикселей контента.",
    "desktop.settings.side": "сторона кнопок",
    "desktop.settings.sideDesc": "слева как на макбуке или справа как у людей — решать вам.",
    "desktop.settings.side.left": "слева",
    "desktop.settings.side.right": "справа",
    "desktop.settings.clock": "часы",
    "desktop.settings.clockDesc": "время в панели — на случай, если окно закрыло собой всё остальное.",
    "desktop.settings.sectionTitle": "название раздела",
    "desktop.settings.sectionTitleDesc": "напоминание о том, куда вы вообще нажали.",
    "desktop.settings.accentLine": "акцентная линия",
    "desktop.settings.accentLineDesc": "тонкая цветная полоса под панелью. чисто для красоты.",
    "desktop.settings.reset": "сбросить настройки десктопа",

    // offline screen
    "desktop.offline.label": "нет сети",
    "desktop.offline.title": "нет подключения к интернету",
    "desktop.offline.desc":
      "сервер недоступен: библиотека, облако и список изменений подождут до лучших времён. проверьте кабель, вайфай и веру в провайдера.",
    "desktop.offline.hint": "встроенные вставки и локальные файлы работают и без сети — не всё потеряно.",
    "desktop.offline.retry": "повторить",
    "desktop.offline.retrying": "проверяем…",
    "desktop.offline.continue": "продолжить без сети",
    "desktop.offline.restored": "соединение восстановлено (ﾉ◕ヮ◕)ﾉ",
  },
}

export default dictionary
