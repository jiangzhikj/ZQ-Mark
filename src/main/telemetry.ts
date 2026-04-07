import { app, net } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getPlatformKey } from './updater'
import { getLocale } from './window-manager'

const INSTALLATION_DATA_URL =
  'https://aop.zq-platform.com/basic-api/api/online_dev/form-data/installation_data'

/** 安装统计接口 JWT（过期后需更换）；请求头 Authorization 为 Bearer 与本常量拼接 */
const INSTALLATION_TOKEN =
  'zqpat_211ad80f06ca088a18272078cff6ecf2caded95f559644f97e3d396c20662146'

const LOG = '[telemetry]'

function logInfo(msg: string, detail?: Record<string, unknown>): void {
  if (detail !== undefined) {
    console.log(LOG, msg, detail)
  } else {
    console.log(LOG, msg)
  }
}

function logWarn(msg: string, err?: unknown): void {
  if (err !== undefined) {
    console.warn(LOG, msg, err)
  } else {
    console.warn(LOG, msg)
  }
}

interface TelemetryState {
  install_id: string
  first_ping_sent: boolean
  last_active_date: string
}

function getTelemetryPath(): string {
  return join(app.getPath('userData'), 'telemetry.json')
}

function loadTelemetryState(): TelemetryState {
  const defaults: TelemetryState = {
    install_id: randomUUID(),
    first_ping_sent: false,
    last_active_date: ''
  }
  try {
    const p = getTelemetryPath()
    if (!existsSync(p)) {
      saveTelemetryState(defaults)
      return defaults
    }
    const parsed = JSON.parse(readFileSync(p, 'utf-8'))
    return {
      install_id: typeof parsed.install_id === 'string' ? parsed.install_id : defaults.install_id,
      first_ping_sent: Boolean(parsed.first_ping_sent),
      last_active_date: typeof parsed.last_active_date === 'string' ? parsed.last_active_date : ''
    }
  } catch {
    saveTelemetryState(defaults)
    return defaults
  }
}

function saveTelemetryState(state: TelemetryState): void {
  try {
    writeFileSync(getTelemetryPath(), JSON.stringify(state, null, 2), 'utf-8')
  } catch { /* ignore */ }
}

function formatSentAnt(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function localDateYMD(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function appVersionLabel(): string {
  const v = app.getVersion().replace(/^v/i, '')
  return v.startsWith('v') ? v : `v${v}`
}

async function postInstallationPayload(main: Record<string, string>, eventLabel: string): Promise<boolean> {
  const body = JSON.stringify({ main })
  logInfo('request', {
    event: eventLabel,
    url: INSTALLATION_DATA_URL,
    bytes: Buffer.byteLength(body)
  })
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await net.fetch(INSTALLATION_DATA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${INSTALLATION_TOKEN}`,
        'User-Agent': `zq-mark/${app.getVersion()}`
      },
      body,
      signal: controller.signal
    })
    const ok = res.ok
    if (ok) {
      logInfo('response', { event: eventLabel, status: res.status, statusText: res.statusText })
    } else {
      let bodyPreview = ''
      try {
        const text = await res.text()
        bodyPreview = text.slice(0, 500)
      } catch {
        /* ignore */
      }
      logWarn('response not ok', {
        event: eventLabel,
        status: res.status,
        statusText: res.statusText,
        bodyPreview: bodyPreview || '(empty)'
      })
    }
    return ok
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Error'
    const message = err instanceof Error ? err.message : String(err)
    logWarn('request failed', { event: eventLabel, name, message })
    return false
  } finally {
    clearTimeout(t)
  }
}

/**
 * 上报匿名装机与按日活跃（可设置关闭）。失败静默，下次启动重试。
 */
export async function reportInstallationTelemetry(telemetryEnabled: boolean): Promise<void> {
  logInfo('run', {
    telemetryEnabled,
    userData: app.getPath('userData'),
    telemetryFile: getTelemetryPath()
  })

  if (!telemetryEnabled) {
    logInfo('skip: telemetry disabled in settings')
    return
  }

  let state = loadTelemetryState()
  const today = localDateYMD()
  const sent_ant = formatSentAnt()
  logInfo('state', {
    install_id: state.install_id,
    first_ping_sent: state.first_ping_sent,
    last_active_date: state.last_active_date,
    today
  })

  const base = {
    install_id: state.install_id,
    platform: getPlatformKey(),
    app_version: appVersionLabel(),
    local: getLocale(),
    date: today,
    sent_ant
  }

  if (!state.first_ping_sent) {
    const ok = await postInstallationPayload(
      {
        ...base,
        event: 'first_open'
      },
      'first_open'
    )
    if (ok) {
      state = { ...state, first_ping_sent: true }
      saveTelemetryState(state)
      logInfo('saved first_ping_sent=true')
    } else {
      logWarn('first_open failed; will retry on next launch')
    }
  }

  state = loadTelemetryState()
  if (!state.first_ping_sent) {
    logInfo('skip active: first_open not yet successful')
    return
  }
  if (state.last_active_date === today) {
    logInfo('skip active: already reported today', { last_active_date: state.last_active_date })
    return
  }

  const okActive = await postInstallationPayload(
    {
      ...base,
      event: 'active'
    },
    'active'
  )
  if (okActive) {
    saveTelemetryState({ ...state, last_active_date: today })
    logInfo('saved last_active_date', { last_active_date: today })
  } else {
    logWarn('active failed; will retry on next launch')
  }
}
