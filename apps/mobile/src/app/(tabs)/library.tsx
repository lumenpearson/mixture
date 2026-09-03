import type { Insert } from "@screenkit/core"
import { router } from "expo-router"
import * as React from "react"
import { StyleSheet, TextInput, View } from "react-native"
import Animated, { LinearTransition } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { InsertCard } from "@/components/insert-card"
import { ActionButton, Explain, Pill, SectionHeading } from "@/components/primitives"
import { Busy, Empty, Failure } from "@/components/state"
import { ContextMenu, type MenuAction } from "@/components/sheet"
import { useI18n } from "@/i18n"
import { useLibrary } from "@/lib/library"
import { font, radius, space, type, useTheme } from "@/theme"

/* ------------------------------------------------------------------ *
 * the library tab
 *
 * Search over title, episode and scene, a category filter as pills and
 * the favourites toggle — the phone-sized cut of the library section on
 * the web. A long press on a card opens the same grouped menu the cloud
 * uses, with the actions a library row can offer.
 * ------------------------------------------------------------------ */

export default function LibraryTab() {
  const { t } = useI18n()
  const { palette } = useTheme()
  const insets = useSafeAreaInsets()
  const { data, loading, error, favorites, refresh, toggleFavorite, select, pick } = useLibrary()

  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState("")
  const [onlyFavorites, setOnlyFavorites] = React.useState(false)
  const [menuFor, setMenuFor] = React.useState<Insert | null>(null)

  const inserts = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return data.inserts.filter((insert) => {
      if (category && String(insert.category) !== category) return false
      if (onlyFavorites && !favorites.includes(insert.id)) return false
      if (!needle) return true
      return [pick(insert.title), insert.episode, insert.scene, insert.id]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    })
  }, [data.inserts, query, category, onlyFavorites, favorites, pick])

  const open = React.useCallback(
    (insert: Insert) => {
      select(insert.id)
      router.push(`/insert/${insert.id}`)
    },
    [select],
  )

  const actions: MenuAction[] = menuFor
    ? [
        { id: "open", label: t("menu.open"), icon: "open-in-new", group: "open", run: () => open(menuFor) },
        {
          id: "preview",
          label: t("menu.preview"),
          icon: "cellphone-play",
          group: "open",
          run: () => {
            select(menuFor.id)
            router.push("/(tabs)/preview")
          },
        },
        {
          id: "favorite",
          label: favorites.includes(menuFor.id) ? t("menu.unfavorite") : t("menu.favorite"),
          icon: "star-outline",
          group: "edit",
          run: () => toggleFavorite(menuFor.id),
        },
        {
          id: "refresh",
          label: t("menu.refresh"),
          icon: "refresh",
          group: "organise",
          run: () => void refresh(),
        },
      ]
    : []

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md }}>
        <SectionHeading title={t("library.title")} />
        <Explain>{t("library.desc")}</Explain>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("library.search")}
          placeholderTextColor={palette.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            height: 44,
            paddingHorizontal: space.md,
            borderRadius: radius.sm,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: palette.panelBorder,
            backgroundColor: palette.control,
            color: palette.foreground,
            fontFamily: font.regular,
            fontSize: type.base,
          }}
        />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Pill active={!category && !onlyFavorites} onPress={() => {
            setCategory("")
            setOnlyFavorites(false)
          }}>
            {t("common.all")}
          </Pill>
          <Pill active={onlyFavorites} onPress={() => setOnlyFavorites((value) => !value)}>
            {t("library.favorites")}
          </Pill>
          {data.categories.map((entry) => (
            <Pill
              key={String(entry.id)}
              active={category === String(entry.id)}
              onPress={() => setCategory(category === String(entry.id) ? "" : String(entry.id))}
            >
              {pick(entry.label)}
            </Pill>
          ))}
        </View>

        <Explain style={{ fontSize: type.micro }}>
          {inserts.length} {t("library.count")}
        </Explain>

        {!data.persistent && !loading ? <Explain>{t("library.readonly")}</Explain> : null}
      </View>

      {loading && data.inserts.length === 0 ? <Busy label={t("common.loading")} /> : null}
      {error && data.inserts.length === 0 ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <Failure message={error} retryLabel={t("common.retry")} onRetry={() => void refresh()} />
        </View>
      ) : null}

      <Animated.FlatList<Insert>
        data={inserts}
        itemLayoutAnimation={LinearTransition.duration(220)}
        keyExtractor={(insert) => insert.id}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingBottom: insets.bottom + 96,
          gap: 6,
        }}
        refreshing={loading}
        onRefresh={() => void refresh()}
        ListEmptyComponent={
          loading ? null : <Empty label={t("library.empty")} icon="magnify" />
        }
        renderItem={({ item }) => (
          <InsertCard
            insert={item}
            title={pick(item.title)}
            category={data.categories.find((entry) => String(entry.id) === String(item.category))}
            favorite={favorites.includes(item.id)}
            statusLabel={item.status}
            onPress={() => open(item)}
            onLongPress={() => setMenuFor(item)}
          />
        )}
      />

      <View
        style={{
          position: "absolute",
          left: space.lg,
          right: space.lg,
          bottom: insets.bottom + space.md,
        }}
      >
        <ActionButton
          label={t("library.create")}
          icon="plus"
          onPress={() => router.push("/wizard/kind")}
        />
      </View>

      <ContextMenu
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? pick(menuFor.title) : undefined}
        actions={actions}
        groupLabels={{
          open: t("menu.group.open"),
          edit: t("menu.group.edit"),
          organise: t("menu.group.organise"),
          danger: t("menu.group.danger"),
        }}
      />
    </View>
  )
}
