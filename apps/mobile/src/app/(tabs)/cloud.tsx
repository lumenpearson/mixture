import * as Clipboard from "expo-clipboard"
import * as DocumentPicker from "expo-document-picker"
import { router } from "expo-router"
import * as Sharing from "expo-sharing"
import * as React from "react"
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { EntryRow } from "@/components/entry-row"
import { PromptSheet } from "@/components/fields"
import { ActionButton, Explain, Pill, SectionHeading, SegmentedControl } from "@/components/primitives"
import { ContextMenu, type MenuAction } from "@/components/sheet"
import { Busy, Empty, Failure } from "@/components/state"
import { useI18n } from "@/i18n"
import { useFileManager, type CloudSource } from "@/lib/cloud"
import { MAX_UPLOAD_BYTES, joinPath, mediaKindOf } from "@/lib/files"
import type { FileEntry } from "@/lib/rpc/codec"
import { useSettings } from "@/lib/settings"
import { font, radius, space, type, useTheme } from "@/theme"

/* ------------------------------------------------------------------ *
 * the cloud tab
 *
 * A file manager over two sources: the cloud repository through
 * CloudService, and the folder android granted through SAF. Long pressing
 * a row — or the empty space below the listing — opens the bottom-sheet
 * menu; what it offers depends on the target, and the actions are grouped
 * open / edit / organise / danger with a separator between groups.
 * ------------------------------------------------------------------ */

type SortBy = "name" | "size" | "kind"
type Filter = "all" | "folders" | "media" | "docs"

export default function CloudTab() {
  const { t } = useI18n()
  const { palette } = useTheme()
  const insets = useSafeAreaInsets()
  const { settings, update } = useSettings()
  const manager = useFileManager()

  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<SortBy>("name")
  const [filter, setFilter] = React.useState<Filter>("all")
  const [menuFor, setMenuFor] = React.useState<FileEntry | "space" | null>(null)
  const [prompt, setPrompt] = React.useState<
    { mode: "folder" } | { mode: "rename" | "move"; entry: FileEntry } | null
  >(null)
  const [busyMessage, setBusyMessage] = React.useState("")
  const [failure, setFailure] = React.useState("")

  const run = React.useCallback(async (work: () => Promise<unknown>, message = "") => {
    setBusyMessage(message)
    setFailure("")
    try {
      await work()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusyMessage("")
    }
  }, [])

  const entries = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = manager.entries.filter((entry) => {
      if (needle && !entry.name.toLowerCase().includes(needle)) return false
      if (filter === "folders") return entry.directory
      if (filter === "media") {
        const kind = mediaKindOf(entry.name, entry.contentType)
        return kind === "image" || kind === "video" || kind === "audio"
      }
      if (filter === "docs") {
        const kind = mediaKindOf(entry.name, entry.contentType)
        return kind === "pdf" || kind === "text" || kind === "markdown" || kind === "code"
      }
      return true
    })
    return [...filtered].sort((a, b) => {
      if (a.directory !== b.directory) return a.directory ? -1 : 1
      if (sort === "size") return b.size - a.size
      if (sort === "kind") return mediaKindOf(a.name).localeCompare(mediaKindOf(b.name))
      return a.name.localeCompare(b.name)
    })
  }, [manager.entries, query, filter, sort])

  const pickAndUpload = React.useCallback(async () => {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
    if (picked.canceled || picked.assets.length === 0) return
    const asset = picked.assets[0]
    if ((asset.size ?? 0) > MAX_UPLOAD_BYTES) throw new Error(t("cloud.uploadTooLarge"))
    await manager.upload(asset.name, asset.uri)
  }, [manager, t])

  const menuActions = React.useMemo<MenuAction[]>(() => {
    const listActions: MenuAction[] = [
      {
        id: "new-folder",
        label: t("menu.newFolder"),
        icon: "folder-plus-outline",
        group: "organise",
        run: () => setPrompt({ mode: "folder" }),
      },
      {
        id: "upload",
        label: t("menu.upload"),
        icon: "upload-outline",
        group: "organise",
        disabled: manager.source !== "cloud",
        run: () => void run(pickAndUpload, t("cloud.uploading")),
      },
      {
        id: "refresh",
        label: t("menu.refresh"),
        icon: "refresh",
        group: "organise",
        run: () => void manager.refresh(),
      },
    ]

    if (menuFor === null || menuFor === "space") return listActions

    const entry = menuFor
    const cloud = entry.source === "cloud"
    return [
      {
        id: "open",
        label: entry.directory ? t("menu.open") : t("menu.preview"),
        icon: entry.directory ? "folder-open-outline" : "eye-outline",
        group: "open",
        run: () => manager.open(entry.path),
      },
      {
        id: "insert",
        label: t("menu.useAsInsert"),
        icon: "plus-box-outline",
        group: "open",
        disabled: entry.directory,
        run: () => router.push("/wizard/kind"),
      },
      {
        id: "download",
        label: t("menu.download"),
        icon: "download-outline",
        group: "edit",
        disabled: !cloud || entry.directory || !settings.localRoot,
        run: () => void run(() => manager.download(entry)),
      },
      {
        id: "copy-path",
        label: t("menu.copyPath"),
        icon: "content-copy",
        group: "edit",
        run: () => void Clipboard.setStringAsync(entry.path),
      },
      {
        id: "share",
        label: t("menu.share"),
        icon: "share-variant-outline",
        group: "edit",
        // a cloud file has no uri on the device until it is downloaded
        disabled: cloud || entry.directory,
        run: () => void run(() => Sharing.shareAsync(entry.path)),
      },
      {
        id: "rename",
        label: t("menu.rename"),
        icon: "rename-box",
        group: "edit",
        disabled: !cloud || !entry.editable,
        run: () => setPrompt({ mode: "rename", entry }),
      },
      {
        id: "move",
        label: t("menu.move"),
        icon: "folder-move-outline",
        group: "organise",
        disabled: !cloud || !entry.editable,
        run: () => setPrompt({ mode: "move", entry }),
      },
      ...listActions.filter((action) => action.id !== "open"),
      {
        id: "delete",
        label: t("menu.delete"),
        icon: "trash-can-outline",
        group: "danger",
        danger: true,
        disabled: cloud && !entry.editable,
        // deleting a folder in the cloud is one recursive commit, so it asks
        // first — there is nothing to undo it with
        run: () =>
          Alert.alert(t("cloud.deleteConfirm"), entry.name, [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("common.delete"),
              style: "destructive",
              onPress: () => void run(() => manager.remove(entry)),
            },
          ]),
      },
    ]
  }, [menuFor, manager, run, pickAndUpload, settings.localRoot, t])

  const localMissing = manager.source === "local" && !settings.localRoot

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md }}>
        <SectionHeading title={t("cloud.title")} />
        <Explain>{t("cloud.desc")}</Explain>

        <SegmentedControl<CloudSource>
          options={[
            { value: "cloud", label: t("cloud.source.cloud") },
            { value: "local", label: t("cloud.source.local") },
          ]}
          value={manager.source}
          onChange={manager.setSource}
        />

        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("cloud.search")}
            placeholderTextColor={palette.textFaint}
            autoCapitalize="none"
            style={{
              flex: 1,
              height: 40,
              paddingHorizontal: space.md,
              borderRadius: radius.sm,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: palette.panelBorder,
              backgroundColor: palette.control,
              color: palette.foreground,
              fontFamily: font.regular,
              fontSize: type.small,
            }}
          />
          <Pill
            onPress={() => update({ cloudView: settings.cloudView === "list" ? "grid" : "list" })}
          >
            {settings.cloudView === "list" ? t("cloud.view.list") : t("cloud.view.grid")}
          </Pill>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {(["all", "folders", "media", "docs"] as Filter[]).map((value) => (
            <Pill key={value} active={filter === value} onPress={() => setFilter(value)}>
              {t(`cloud.filter.${value}`)}
            </Pill>
          ))}
          {(["name", "size", "kind"] as SortBy[]).map((value) => (
            <Pill key={value} active={sort === value} onPress={() => setSort(value)}>
              {t(`cloud.sort.${value}`)}
            </Pill>
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Pill onPress={manager.goUp}>{t("cloud.up")}</Pill>
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontFamily: font.regular, fontSize: type.micro, color: palette.textFaint }}
          >
            {manager.path || t("cloud.root")}
          </Text>
        </View>

        {manager.source === "cloud" && !manager.status.configured && !manager.loading ? (
          <Explain>{t("cloud.connectDesc")}</Explain>
        ) : null}
      </View>

      {busyMessage ? <Busy label={busyMessage} /> : null}
      {failure || manager.error ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <Failure
            message={failure || manager.error}
            retryLabel={t("common.retry")}
            onRetry={() => void manager.refresh()}
          />
        </View>
      ) : null}

      {localMissing ? (
        <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
          <Empty label={t("cloud.noLocal")} icon="folder-off-outline" />
          <ActionButton
            label={t("cloud.grantLocal")}
            icon="folder-open-outline"
            onPress={() => router.push("/onboarding")}
          />
        </View>
      ) : (
        <FlatList<FileEntry>
          data={entries}
          key={settings.cloudView}
          numColumns={settings.cloudView === "grid" ? 3 : 1}
          keyExtractor={(entry) => entry.path}
          contentContainerStyle={{
            paddingHorizontal: space.lg - 4,
            paddingBottom: insets.bottom + 96,
          }}
          refreshing={manager.loading}
          onRefresh={() => void manager.refresh()}
          ListEmptyComponent={manager.loading ? null : <Empty label={t("cloud.empty")} />}
          // the empty space below the rows is a long-press target of its own:
          // it opens the menu for the folder rather than for a file
          ListFooterComponent={
            <Pressable
              style={{ height: 140 }}
              onLongPress={() => setMenuFor("space")}
              delayLongPress={280}
              accessibilityLabel={t("menu.hint")}
            />
          }
          renderItem={({ item }) => (
            <EntryRow
              entry={item}
              mode={settings.cloudView}
              onPress={() => (item.directory ? manager.open(item.path) : setMenuFor(item))}
              onLongPress={() => setMenuFor(item)}
            />
          )}
        />
      )}

      <View
        style={{
          position: "absolute",
          left: space.lg,
          right: space.lg,
          bottom: insets.bottom + space.md,
        }}
      >
        <ActionButton
          label={t("menu.hint")}
          icon="dots-horizontal"
          tone="quiet"
          onPress={() => setMenuFor("space")}
        />
      </View>

      <ContextMenu
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor && menuFor !== "space" ? menuFor.name : manager.path || t("cloud.root")}
        actions={menuActions}
        groupLabels={{
          open: t("menu.group.open"),
          edit: t("menu.group.edit"),
          organise: t("menu.group.organise"),
          danger: t("menu.group.danger"),
        }}
      />

      <PromptSheet
        visible={prompt !== null}
        title={prompt?.mode === "move" ? t("cloud.movePrompt") : t("cloud.namePrompt")}
        initial={prompt && prompt.mode !== "folder" ? prompt.entry.name : ""}
        confirmLabel={t("common.save")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setPrompt(null)}
        onConfirm={(value) => {
          const current = prompt
          setPrompt(null)
          if (!current) return
          if (current.mode === "folder") void run(() => manager.createDirectory(value))
          else if (current.mode === "rename") void run(() => manager.rename(current.entry, value))
          else void run(() => manager.move(current.entry, joinPath("", value)))
        }}
      />
    </View>
  )
}
