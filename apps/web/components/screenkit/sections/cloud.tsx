"use client"

import { getCloudKey, getCloudToken } from "@/lib/rpc/client"
import { Role, type Status } from "@mixture/protocol/cloud"
import { SlidersHorizontal } from "lucide-react"
import * as React from "react"
import { CloudAccessEditor } from "../cloud-access"
import { CloudManager } from "../cloud/manager"
import { ConnectPanel, InitCard, StatusCard } from "../cloud/status"
import { toolbarButtonCls } from "../cloud/toolbar"
import { Explain, SectionHeading } from "../primitives"
import { CloudSettings } from "../settings/cloud-settings"
import { SettingsTabs } from "../settings-tabs"
import { useScreenkit } from "../store"

/* ------------------------------------------------------------------ *
 * cloud drive — files on a private GitHub repository
 *
 * This section is the frame: which repository, which role, how to connect,
 * who may see what. The file manager itself lives in `components/screenkit/
 * cloud/` and speaks to storage only through a CloudProvider.
 * ------------------------------------------------------------------ */

export function CloudSection() {
  const { t } = useScreenkit()
  const [status, setStatus] = React.useState<Status | null>(null)
  const [showConnect, setShowConnect] = React.useState(false)
  const [showAccess, setShowAccess] = React.useState(false)
  const [showSettings, setShowSettings] = React.useState(false)
  const [connected, setConnected] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    setConnected(Boolean(getCloudToken() || getCloudKey()))
  }, [reloadToken])

  const role = status?.role ?? Role.ANONYMOUS
  const canEdit = role === Role.EDITOR || role === Role.OWNER
  const isOwner = role === Role.OWNER
  const reload = () => setReloadToken((value) => value + 1)

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="flex min-w-0 flex-col gap-3">
        <SectionHeading title={t("cloud.title")} link />
        <Explain>{t("cloud.desc")}</Explain>
        <SettingsTabs />
      </header>

      <StatusCard
        status={status}
        connected={connected}
        refreshing={false}
        onConnect={() => setShowConnect((value) => !value)}
        onRefresh={reload}
        onAccess={canEdit ? () => setShowAccess((value) => !value) : undefined}
      >
        <button
          type="button"
          className={toolbarButtonCls}
          aria-expanded={showSettings}
          onClick={() => setShowSettings((value) => !value)}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden="true" /> {t("cloudfm.settings.title")}
        </button>
      </StatusCard>

      {showSettings ? <CloudSettings /> : null}

      {showConnect || (!connected && !status?.configured) ? (
        <ConnectPanel
          onDone={() => {
            setShowConnect(false)
            reload()
          }}
        />
      ) : null}

      {status && !status.reachable && connected ? <InitCard onDone={reload} /> : null}

      {showAccess && canEdit ? <CloudAccessEditor canSave={isOwner} /> : null}

      <CloudManager onStatus={setStatus} reloadToken={reloadToken} />
    </div>
  )
}
