import type { FeatureDictionary } from "./index"

/* strings for the "cloud-manager" feature — keep ru and en key sets identical.
   Existing `cloud.*` keys (upload, rename, delete, roles, visibility, connect,
   access, init) stay in the base dictionary; everything the overhauled file
   manager adds lives here under `cloudfm.*`. */
const dictionary: FeatureDictionary = {
  ru: {
    /* sources */
    "cloudfm.source.label": "источник",
    "cloudfm.source.github": "github",

    /* file types */
    "cloudfm.type.image": "изображения",
    "cloudfm.type.video": "видео",
    "cloudfm.type.audio": "аудио",
    "cloudfm.type.document": "документы",
    "cloudfm.type.archive": "архивы",
    "cloudfm.type.code": "код",
    "cloudfm.type.other": "прочее",

    /* search */
    "cloudfm.search.placeholder": "поиск в этой папке…",
    "cloudfm.search.placeholderAll": "поиск по всему облаку…",
    "cloudfm.search.scopeFolder": "в папке",
    "cloudfm.search.scopeAll": "везде",
    "cloudfm.search.clear": "очистить поиск",
    "cloudfm.search.searching": "ищем…",
    "cloudfm.search.results": "найдено",
    "cloudfm.search.empty": "ничего не нашлось",
    "cloudfm.search.truncated": "репозиторий больше одного обхода: показана часть",

    /* sorting */
    "cloudfm.sort.label": "сортировка",
    "cloudfm.sort.name": "по имени",
    "cloudfm.sort.size": "по размеру",
    "cloudfm.sort.type": "по расширению",
    "cloudfm.sort.kind": "по типу",
    "cloudfm.sort.asc": "по возрастанию",
    "cloudfm.sort.desc": "по убыванию",
    "cloudfm.sort.foldersFirst": "папки сверху",

    /* filters */
    "cloudfm.filter.label": "фильтры",
    "cloudfm.filter.type": "тип файла",
    "cloudfm.filter.visibility": "видимость",
    "cloudfm.filter.any": "любая",
    "cloudfm.filter.clear": "сбросить фильтры",

    /* view */
    "cloudfm.view.label": "вид",
    "cloudfm.view.list": "список",
    "cloudfm.view.grid": "плитка",
    "cloudfm.density.label": "плотность",
    "cloudfm.density.comfortable": "свободно",
    "cloudfm.density.compact": "плотно",

    /* uploads */
    "cloudfm.upload.files": "файлы",
    "cloudfm.upload.folder": "папку",
    "cloudfm.upload.queue": "очередь загрузки",
    "cloudfm.upload.retry": "повторить",
    "cloudfm.upload.cancelOne": "отменить",
    "cloudfm.upload.clear": "очистить очередь",
    "cloudfm.upload.statusPending": "в очереди",
    "cloudfm.upload.statusUploading": "загружается…",
    "cloudfm.upload.statusDone": "готово",
    "cloudfm.upload.statusError": "ошибка",
    "cloudfm.upload.statusSkipped": "пропущено",
    "cloudfm.upload.statusCancelled": "отменено",
    "cloudfm.upload.statusConflict": "файл уже есть",
    "cloudfm.upload.overwrite": "заменить",
    "cloudfm.upload.keepBoth": "оба",
    "cloudfm.upload.skip": "пропустить",
    "cloudfm.upload.overwriteAll": "заменить все",
    "cloudfm.upload.skipAll": "пропустить все",
    "cloudfm.upload.direct": "напрямую в github",
    "cloudfm.upload.capServer": "через сервер — не больше 4 МиБ на файл",
    "cloudfm.upload.capNote":
      "без своего github-токена файл идёт через сервер: тело запроса на vercel ограничено 4 МиБ. подключите токен — большие файлы пойдут в github напрямую из браузера.",
    "cloudfm.upload.capNoteToken": "большие файлы уходят из браузера прямо в github, до 90 МБ.",
    "cloudfm.upload.tooLargeItem": "больше допустимого размера",
    "cloudfm.upload.rejected": "путь отклонён",
    "cloudfm.upload.dropHint": "бросьте файлы или папки сюда",
    "cloudfm.upload.here": "загрузить сюда",

    /* context menu */
    "cloudfm.menu.label": "меню файла",
    "cloudfm.menu.open": "открыть",
    "cloudfm.menu.copyLink": "скопировать ссылку",
    "cloudfm.menu.copyPath": "скопировать путь",
    "cloudfm.menu.moveTo": "переместить…",
    "cloudfm.menu.duplicate": "дублировать",
    "cloudfm.menu.favorite": "в избранное",
    "cloudfm.menu.unfavorite": "убрать из избранного",
    "cloudfm.menu.properties": "свойства",
    "cloudfm.menu.folderProperties": "свойства папки",
    "cloudfm.menu.newFolderHere": "новая папка внутри",
    "cloudfm.menu.cut": "вырезать",
    "cloudfm.menu.copy": "копировать",
    "cloudfm.menu.paste": "вставить",
    "cloudfm.menu.selectAll": "выделить всё",
    "cloudfm.menu.sort": "сортировка",
    "cloudfm.menu.view": "вид",

    /* selection */
    "cloudfm.select.selected": "выбрано",
    "cloudfm.select.clear": "снять выделение",
    "cloudfm.select.delete": "удалить выбранные",
    "cloudfm.select.move": "переместить выбранные",
    "cloudfm.select.moveDesc": "папка, в которую переедут выбранные файлы",

    /* properties */
    "cloudfm.props.title": "свойства",
    "cloudfm.props.path": "путь",
    "cloudfm.props.category": "тип",
    "cloudfm.props.contentType": "content-type",
    "cloudfm.props.sha": "sha",
    "cloudfm.props.downloadUrl": "прямая ссылка",
    "cloudfm.props.none": "—",

    /* rename and move */
    "cloudfm.rename.hint": "enter — сохранить, esc — отменить",
    "cloudfm.rename.exists": "такое имя уже занято",
    "cloudfm.rename.done": "переименовано",
    "cloudfm.move.title": "переместить",
    "cloudfm.move.target": "новый путь",
    "cloudfm.duplicate.done": "создана копия",

    /* delete */
    "cloudfm.delete.many": "удалить выбранные записи безвозвратно?",

    /* listing */
    "cloudfm.back": "назад",
    "cloudfm.emptyFiltered": "под фильтры ничего не подошло",
    "cloudfm.showing": "показано",
    "cloudfm.loadMore": "показать ещё",
    "cloudfm.rowHint": "стрелки — навигация, enter — открыть, f2 — переименовать, delete — удалить",
    "cloudfm.kbdMenu": "shift+f10 — меню",

    /* settings */
    "cloudfm.settings.title": "файловый менеджер",
    "cloudfm.settings.desc": "как выглядит список облака: цвета по типу, плотность, вид по умолчанию.",
    "cloudfm.settings.colors": "цвет по типу файла",
    "cloudfm.settings.colorsDesc": "иконка каждого типа получает свой акцент палитры",
    "cloudfm.settings.accents": "акценты по типам",
    "cloudfm.settings.thumbnails": "миниатюры изображений",
    "cloudfm.settings.reset": "вернуть по умолчанию",
    "cloudfm.settings.saved": "настройки облака сохранены",

    /* status: the server sends these keys in Status.message, never a sentence */
    "cloud.status.noToken": "облако не подключено: вставьте свой github-токен или ключ доступа",
    "cloud.status.unreachable": "репозиторий облака недоступен с текущим доступом",
    "cloud.status.configInvalid": "настройки доступа повреждены, действуют значения по умолчанию",
    "cloud.status.signIn": "войдите с github-токеном или ключом доступа, чтобы увидеть файлы",
  },
  en: {
    /* sources */
    "cloudfm.source.label": "source",
    "cloudfm.source.github": "github",

    /* file types */
    "cloudfm.type.image": "images",
    "cloudfm.type.video": "video",
    "cloudfm.type.audio": "audio",
    "cloudfm.type.document": "documents",
    "cloudfm.type.archive": "archives",
    "cloudfm.type.code": "code",
    "cloudfm.type.other": "other",

    /* search */
    "cloudfm.search.placeholder": "search this folder…",
    "cloudfm.search.placeholderAll": "search the whole drive…",
    "cloudfm.search.scopeFolder": "this folder",
    "cloudfm.search.scopeAll": "everywhere",
    "cloudfm.search.clear": "clear search",
    "cloudfm.search.searching": "searching…",
    "cloudfm.search.results": "found",
    "cloudfm.search.empty": "nothing matched",
    "cloudfm.search.truncated": "the repository is larger than one walk: this is a part of it",

    /* sorting */
    "cloudfm.sort.label": "sort",
    "cloudfm.sort.name": "by name",
    "cloudfm.sort.size": "by size",
    "cloudfm.sort.type": "by extension",
    "cloudfm.sort.kind": "by kind",
    "cloudfm.sort.asc": "ascending",
    "cloudfm.sort.desc": "descending",
    "cloudfm.sort.foldersFirst": "folders first",

    /* filters */
    "cloudfm.filter.label": "filters",
    "cloudfm.filter.type": "file type",
    "cloudfm.filter.visibility": "visibility",
    "cloudfm.filter.any": "any",
    "cloudfm.filter.clear": "clear filters",

    /* view */
    "cloudfm.view.label": "view",
    "cloudfm.view.list": "list",
    "cloudfm.view.grid": "grid",
    "cloudfm.density.label": "density",
    "cloudfm.density.comfortable": "comfortable",
    "cloudfm.density.compact": "compact",

    /* uploads */
    "cloudfm.upload.files": "files",
    "cloudfm.upload.folder": "folder",
    "cloudfm.upload.queue": "upload queue",
    "cloudfm.upload.retry": "retry",
    "cloudfm.upload.cancelOne": "cancel",
    "cloudfm.upload.clear": "clear the queue",
    "cloudfm.upload.statusPending": "queued",
    "cloudfm.upload.statusUploading": "uploading…",
    "cloudfm.upload.statusDone": "done",
    "cloudfm.upload.statusError": "failed",
    "cloudfm.upload.statusSkipped": "skipped",
    "cloudfm.upload.statusCancelled": "cancelled",
    "cloudfm.upload.statusConflict": "already there",
    "cloudfm.upload.overwrite": "replace",
    "cloudfm.upload.keepBoth": "keep both",
    "cloudfm.upload.skip": "skip",
    "cloudfm.upload.overwriteAll": "replace all",
    "cloudfm.upload.skipAll": "skip all",
    "cloudfm.upload.direct": "straight to github",
    "cloudfm.upload.capServer": "through the server — 4 MiB per file",
    "cloudfm.upload.capNote":
      "without your own github token a file goes through the server, whose request body tops out at 4 MiB on vercel. connect a token and large files go from the browser straight to github.",
    "cloudfm.upload.capNoteToken": "large files go from this browser straight to github, up to 90 MB.",
    "cloudfm.upload.tooLargeItem": "over the size limit",
    "cloudfm.upload.rejected": "path refused",
    "cloudfm.upload.dropHint": "drop files or folders here",
    "cloudfm.upload.here": "upload here",

    /* context menu */
    "cloudfm.menu.label": "file menu",
    "cloudfm.menu.open": "open",
    "cloudfm.menu.copyLink": "copy link",
    "cloudfm.menu.copyPath": "copy path",
    "cloudfm.menu.moveTo": "move to…",
    "cloudfm.menu.duplicate": "duplicate",
    "cloudfm.menu.favorite": "add to favourites",
    "cloudfm.menu.unfavorite": "remove from favourites",
    "cloudfm.menu.properties": "properties",
    "cloudfm.menu.folderProperties": "folder properties",
    "cloudfm.menu.newFolderHere": "new folder inside",
    "cloudfm.menu.cut": "cut",
    "cloudfm.menu.copy": "copy",
    "cloudfm.menu.paste": "paste",
    "cloudfm.menu.selectAll": "select all",
    "cloudfm.menu.sort": "sort",
    "cloudfm.menu.view": "view",

    /* selection */
    "cloudfm.select.selected": "selected",
    "cloudfm.select.clear": "clear the selection",
    "cloudfm.select.delete": "delete the selection",
    "cloudfm.select.move": "move the selection",
    "cloudfm.select.moveDesc": "the folder the selected files move into",

    /* properties */
    "cloudfm.props.title": "properties",
    "cloudfm.props.path": "path",
    "cloudfm.props.category": "kind",
    "cloudfm.props.contentType": "content-type",
    "cloudfm.props.sha": "sha",
    "cloudfm.props.downloadUrl": "direct link",
    "cloudfm.props.none": "—",

    /* rename and move */
    "cloudfm.rename.hint": "enter saves, esc cancels",
    "cloudfm.rename.exists": "that name is taken",
    "cloudfm.rename.done": "renamed",
    "cloudfm.move.title": "move",
    "cloudfm.move.target": "new path",
    "cloudfm.duplicate.done": "copy created",

    /* delete */
    "cloudfm.delete.many": "delete the selected entries for good?",

    /* listing */
    "cloudfm.back": "back",
    "cloudfm.emptyFiltered": "nothing matched the filters",
    "cloudfm.showing": "showing",
    "cloudfm.loadMore": "show more",
    "cloudfm.rowHint": "arrows move, enter opens, f2 renames, delete removes",
    "cloudfm.kbdMenu": "shift+f10 opens the menu",

    /* settings */
    "cloudfm.settings.title": "file manager",
    "cloudfm.settings.desc": "how the cloud listing looks: colours per type, density, the default view.",
    "cloudfm.settings.colors": "colour by file type",
    "cloudfm.settings.colorsDesc": "each type takes its own accent from the palette",
    "cloudfm.settings.accents": "accent per type",
    "cloudfm.settings.thumbnails": "image thumbnails",
    "cloudfm.settings.reset": "back to defaults",
    "cloudfm.settings.saved": "cloud settings saved",

    /* status: the server sends these keys in Status.message, never a sentence */
    "cloud.status.noToken": "the cloud is not connected: paste your github token or an access key",
    "cloud.status.unreachable": "the cloud repository is not reachable with the current access",
    "cloud.status.configInvalid": "the access settings are damaged, defaults are in effect",
    "cloud.status.signIn": "sign in with a github token or an access key to see files",
  },
  snark: {
    /* sources */
    "cloudfm.source.label": "источник",
    "cloudfm.source.github": "github",

    /* file types */
    "cloudfm.type.image": "изображения",
    "cloudfm.type.video": "видео",
    "cloudfm.type.audio": "аудио",
    "cloudfm.type.document": "документы",
    "cloudfm.type.archive": "архивы",
    "cloudfm.type.code": "код",
    "cloudfm.type.other": "прочее",

    /* search */
    "cloudfm.search.placeholder": "поиск в этой папке…",
    "cloudfm.search.placeholderAll": "поиск по всему облаку…",
    "cloudfm.search.scopeFolder": "в папке",
    "cloudfm.search.scopeAll": "везде",
    "cloudfm.search.clear": "очистить поиск",
    "cloudfm.search.searching": "рыщем…",
    "cloudfm.search.results": "найдено",
    "cloudfm.search.empty": "ничего не нашлось. возможно, его тут и не было (¬_¬)",
    "cloudfm.search.truncated": "репозиторий больше одного обхода: показали, сколько успели",

    /* sorting */
    "cloudfm.sort.label": "сортировка",
    "cloudfm.sort.name": "по имени",
    "cloudfm.sort.size": "по размеру",
    "cloudfm.sort.type": "по расширению",
    "cloudfm.sort.kind": "по типу",
    "cloudfm.sort.asc": "по возрастанию",
    "cloudfm.sort.desc": "по убыванию",
    "cloudfm.sort.foldersFirst": "папки сверху",

    /* filters */
    "cloudfm.filter.label": "фильтры",
    "cloudfm.filter.type": "тип файла",
    "cloudfm.filter.visibility": "видимость",
    "cloudfm.filter.any": "любая",
    "cloudfm.filter.clear": "сбросить фильтры",

    /* view */
    "cloudfm.view.label": "вид",
    "cloudfm.view.list": "список",
    "cloudfm.view.grid": "плитка",
    "cloudfm.density.label": "плотность",
    "cloudfm.density.comfortable": "свободно",
    "cloudfm.density.compact": "плотно",

    /* uploads */
    "cloudfm.upload.files": "файлы",
    "cloudfm.upload.folder": "папку",
    "cloudfm.upload.queue": "очередь загрузки",
    "cloudfm.upload.retry": "повторить",
    "cloudfm.upload.cancelOne": "отменить",
    "cloudfm.upload.clear": "очистить очередь",
    "cloudfm.upload.statusPending": "в очереди",
    "cloudfm.upload.statusUploading": "загружается…",
    "cloudfm.upload.statusDone": "готово",
    "cloudfm.upload.statusError": "ошибка",
    "cloudfm.upload.statusSkipped": "пропущено",
    "cloudfm.upload.statusCancelled": "отменено",
    "cloudfm.upload.statusConflict": "такой уже есть",
    "cloudfm.upload.overwrite": "заменить",
    "cloudfm.upload.keepBoth": "оба",
    "cloudfm.upload.skip": "пропустить",
    "cloudfm.upload.overwriteAll": "заменить все",
    "cloudfm.upload.skipAll": "пропустить все",
    "cloudfm.upload.direct": "напрямую в github",
    "cloudfm.upload.capServer": "через сервер — 4 МиБ на файл, и ни байтом больше",
    "cloudfm.upload.capNote":
      "без своего github-токена файл идёт через сервер, а тело запроса на vercel заканчивается на 4 МиБ — не мы это придумали. подключите токен, и большие файлы поедут в github прямо из браузера, минуя посредника.",
    "cloudfm.upload.capNoteToken":
      "большие файлы уходят из браузера прямо в github, до 90 МБ. дальше вопросы уже к вашему каналу (¬‿¬).",
    "cloudfm.upload.tooLargeItem": "не влезает",
    "cloudfm.upload.rejected": "такой путь мы не берём",
    "cloudfm.upload.dropHint": "бросайте файлы или папки сюда, не стесняйтесь (っ◔◡◔)っ",
    "cloudfm.upload.here": "загрузить сюда",

    /* context menu */
    "cloudfm.menu.label": "меню файла",
    "cloudfm.menu.open": "открыть",
    "cloudfm.menu.copyLink": "скопировать ссылку",
    "cloudfm.menu.copyPath": "скопировать путь",
    "cloudfm.menu.moveTo": "переместить…",
    "cloudfm.menu.duplicate": "дублировать",
    "cloudfm.menu.favorite": "в избранное",
    "cloudfm.menu.unfavorite": "убрать из избранного",
    "cloudfm.menu.properties": "свойства",
    "cloudfm.menu.folderProperties": "свойства папки",
    "cloudfm.menu.newFolderHere": "новая папка внутри",
    "cloudfm.menu.cut": "вырезать",
    "cloudfm.menu.copy": "копировать",
    "cloudfm.menu.paste": "вставить",
    "cloudfm.menu.selectAll": "выделить всё",
    "cloudfm.menu.sort": "сортировка",
    "cloudfm.menu.view": "вид",

    /* selection */
    "cloudfm.select.selected": "выбрано",
    "cloudfm.select.clear": "снять выделение",
    "cloudfm.select.delete": "удалить выбранные",
    "cloudfm.select.move": "переместить выбранные",
    "cloudfm.select.moveDesc": "папка, в которую всё это переедет",

    /* properties */
    "cloudfm.props.title": "свойства",
    "cloudfm.props.path": "путь",
    "cloudfm.props.category": "тип",
    "cloudfm.props.contentType": "content-type",
    "cloudfm.props.sha": "sha",
    "cloudfm.props.downloadUrl": "прямая ссылка",
    "cloudfm.props.none": "—",

    /* rename and move */
    "cloudfm.rename.hint": "enter — сохранить, esc — передумать",
    "cloudfm.rename.exists": "имя занято, придумайте другое",
    "cloudfm.rename.done": "переименовано",
    "cloudfm.move.title": "переместить",
    "cloudfm.move.target": "новый путь",
    "cloudfm.duplicate.done": "копия создана, теперь их две",

    /* delete */
    "cloudfm.delete.many": "удалить выбранное без права на возврат?",

    /* listing */
    "cloudfm.back": "назад",
    "cloudfm.emptyFiltered": "под такие фильтры не подошло ничего ¯\\_(ツ)_/¯",
    "cloudfm.showing": "показано",
    "cloudfm.loadMore": "показать ещё",
    "cloudfm.rowHint": "стрелки — навигация, enter — открыть, f2 — переименовать, delete — прощаться",
    "cloudfm.kbdMenu": "shift+f10 — меню",

    /* settings */
    "cloudfm.settings.title": "файловый менеджер",
    "cloudfm.settings.desc":
      "как выглядит список облака: цвета по типу, плотность, вид по умолчанию. на скорость github не влияет ни одна из них.",
    "cloudfm.settings.colors": "цвет по типу файла",
    "cloudfm.settings.colorsDesc": "иконка каждого типа получает свой акцент палитры — глазу проще, чем вчитываться в расширения",
    "cloudfm.settings.accents": "акценты по типам",
    "cloudfm.settings.thumbnails": "миниатюры изображений",
    "cloudfm.settings.reset": "вернуть по умолчанию",
    "cloudfm.settings.saved": "настройки облака сохранены",

    /* status: the server sends these keys in Status.message, never a sentence */
    "cloud.status.noToken": "облако молчит: токена или ключа не завезли",
    "cloud.status.unreachable": "репозиторий облака не отвечает — с таким доступом его как бы и нет",
    "cloud.status.configInvalid": "настройки доступа сломаны, работают значения по умолчанию",
    "cloud.status.signIn": "покажите токен или ключ — иначе файлов не будет",
  },
}

export default dictionary
