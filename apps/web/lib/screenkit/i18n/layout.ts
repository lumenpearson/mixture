import type { FeatureDictionary } from "./index"

/* strings for the "layout" feature — keep ru and en key sets identical */
const dictionary: FeatureDictionary = {
  ru: {
    "layout.title": "рельса на маленьком экране",
    "layout.desc":
      "ниже md-ширины рельса перебирается вниз экрана; здесь — как её прятать и с какой стороны держать переключатель.",
    "layout.side": "сторона переключателя",
    "layout.side.left": "слева",
    "layout.side.right": "справа",
    "layout.sideDesc": "на какой стороне сидит круглая кнопка, которая прячет и возвращает нижнюю рельсу.",
    "layout.autoHide": "прятать рельсу при прокрутке вниз",
    "layout.autoHideDesc": "рельса сама уходит вниз при прокрутке контента вниз и возвращается при прокрутке вверх.",
    "layout.smoothScroll": "плавная прокрутка",
    "layout.smoothScrollDesc":
      "по умолчанию выключена на телефоне и планшете и включена на десктопе; переключатель работает как в разделе «движение».",
    "layout.hideRail": "скрыть рельсу",
    "layout.showRail": "показать рельсу",
    "layout.swipeHint": "смахните вверх от нижнего края, чтобы вернуть рельсу",
  },
  en: {
    "layout.title": "rail on a narrow screen",
    "layout.desc":
      "below the md width the rail moves to the bottom of the screen; this is how to hide it and which side its toggle sits on.",
    "layout.side": "toggle side",
    "layout.side.left": "left",
    "layout.side.right": "right",
    "layout.sideDesc": "which edge the round button lives on — it hides and brings back the bottom rail.",
    "layout.autoHide": "hide the rail while scrolling down",
    "layout.autoHideDesc": "the rail slides away while the content scrolls down and returns on scrolling up.",
    "layout.smoothScroll": "smooth scrolling",
    "layout.smoothScrollDesc":
      "off by default on phone and tablet, on on desktop; this switch is the same one as in the \"motion\" section.",
    "layout.hideRail": "hide the rail",
    "layout.showRail": "show the rail",
    "layout.swipeHint": "swipe up from the bottom edge to bring the rail back",
  },
}

export default dictionary
