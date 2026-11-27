exports.repo = "hugo529100/hfs-Tree-nav"
exports.version = 3.7
exports.description = "Tree navigation sidebar: jump quickly between folders at any depth to cut/copy/move files easily, with starred shortcuts."
exports.apiRequired = 9.6
exports.frontend_css = 'style.css'
exports.frontend_js = ['main.js']

// ★ 在模塊加載時同步讀 config.yaml 的頂層 title，
//   作為 rootLabel 的 defaultValue 注入前端（只讀一次，後續不再變）
function readHfsTitle() {
    try {
        const fs = require('fs')
        const path = require('path')
        const candidates = [
            path.resolve(process.cwd(), 'config.yaml'),
            path.resolve(__dirname, '..', '..', 'config.yaml'),
            path.resolve(__dirname, '..', '..', '..', 'config.yaml'),
        ]
        const p = candidates.find(f => fs.existsSync(f))
        if (!p) return ''
        const txt = fs.readFileSync(p, 'utf8')
        // 匹配頂層（行首無縮進）的 title:
        const m = txt.match(/^title\s*:\s*(.+)$/m)
        if (!m) return ''
        return m[1].trim().replace(/^['"]|['"]$/g, '')
    } catch { return '' }
}

const HFS_TITLE = readHfsTitle()

exports.config = {
    hideFolders: {
        frontend: true,
        type: 'string',
        label: "Hidden folder names (comma or newline separated, supports * ?)",
        placeholder: "cache, .*, private, node_modules, temp",
        defaultValue: "cache, .*, private, node_modules, temp",
        multiline: true,
        sm: 12,
    },
    // ★ 只讀字段：後端注入，前端只讀，不再讓用戶改
    rootLabel: {
        frontend: true,
        type: 'string',
        label: "Root label (auto from config.yaml title, read-only)",
        defaultValue: HFS_TITLE || 'Root',
        readonly: true,
        sm: 12,
    },
}

// ---------------------------------------------------------------------------
// Starred path library, one JSON file per signed-in account.
// Guests use the browser's localStorage (7-day expiry) handled by main.js.
// ---------------------------------------------------------------------------
exports.init = async api => {
    const fs = api.require('fs')
    const path = api.require('path')
    const crypto = api.require('crypto')
    const fsp = fs.promises
    const storageDir = String(api.storageDir || '')
    if (!storageDir) return {}
    const accountsDir = path.join(storageDir, 'accounts')
    try { await fsp.mkdir(accountsDir, { recursive: true }) }
    catch (e) { api.log('[Tree-nav] cannot create account folder', String(e)) }

    const MAX_STARS = 5000
    const cache = new Map()   // username -> { state, exists }
    const queues = new Map()  // username -> last write promise

    const log = (...args) => api.log('[Tree-nav]', ...args)

    function normalizePath(value) {
        if (typeof value !== 'string') return ''
        if (!value || value.length > 3000 || value.includes('\0')) return ''
        let p = value
        if (!p.startsWith('/')) p = '/' + p
        p = p.replace(/\/{2,}/g, '/')
        if (!p.endsWith('/')) p += '/'
        return p
    }

    function normalizeName(value) {
        if (typeof value !== 'string') return ''
        const name = value.trim()
        return name && name.length <= 300 && !name.includes('\uFFFD') ? name : ''
    }

    function displayName(p) {
        const segment = p.split('/').filter(Boolean).pop() || '/'
        try { return decodeURIComponent(segment) } catch { return segment }
    }

    function normalizeStars(list) {
        if (!Array.isArray(list)) return []
        const byPath = new Map()
        for (const raw of list) {
            if (!raw || typeof raw !== 'object') continue
            const p = normalizePath(raw.path || raw.uri)
            if (!p) continue
            const name = normalizeName(raw.name) || displayName(p)
            const at = Number(raw.at)
            byPath.set(p, { path: p, name, at: Number.isFinite(at) && at > 0 ? at : Date.now() })
        }
        return Array.from(byPath.values()).slice(0, MAX_STARS)
    }

    function accountFile(username) {
        const base = username
            .replace(/[^A-Za-z0-9._-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 40) || 'account'
        const digest = crypto.createHash('sha1').update(username, 'utf8').digest('hex').slice(0, 10)
        return path.join(accountsDir, base + '-' + digest + '.json')
    }

    function queueAccount(username, task) {
        const previous = queues.get(username) || Promise.resolve()
        const next = previous.then(task, task)
        queues.set(username, next.catch(() => {}))
        return next
    }

    async function load(username) {
        const cached = cache.get(username)
        if (cached) return cached
        let raw = null
        let exists = false
        try {
            raw = JSON.parse(await fsp.readFile(accountFile(username), 'utf8'))
            exists = true
        } catch (e) {
            if (e?.code !== 'ENOENT') log('cannot read account file', username, String(e))
        }
        const entry = {
            state: { v: 1, username, stars: normalizeStars(raw?.stars) },
            exists,
        }
        cache.set(username, entry)
        return entry
    }

    async function save(username, entry) {
        await fsp.mkdir(accountsDir, { recursive: true })
        const file = accountFile(username)
        const temp = `${file}.${process.pid}.${Date.now()}.tmp`
        const body = JSON.stringify({
            v: 1,
            username,
            stars: entry.state.stars,
        }, null, 2)
        try {
            await fsp.writeFile(temp, body, 'utf8')
            await fsp.rename(temp, file)
            entry.exists = true
        } catch (e) {
            try { await fsp.unlink(temp) } catch {}
            throw e
        }
    }

    function requireUser(ctx) {
        let username = ''
        try { username = String(api.getCurrentUsername(ctx) || '') }
        catch (e) { log('getCurrentUsername failed', String(e)) }
        return username
    }

    const visible = list => (list || []).map(item => ({ path: item.path, name: item.name, at: item.at }))

    async function treeStars_get(params, ctx) {
        const username = requireUser(ctx)
        if (!username) return { ok: false, reason: 'auth' }
        const entry = await load(username)
        return { ok: true, exists: entry.exists, stars: visible(entry.state.stars), now: Date.now() }
    }

    async function treeStars_set(params, ctx) {
        const username = requireUser(ctx)
        if (!username) return { ok: false, reason: 'auth' }
        const stars = normalizeStars(params?.stars)
        return queueAccount(username, async () => {
            const entry = await load(username)
            const before = entry.state.stars
            entry.state.stars = stars
            try { await save(username, entry) }
            catch (e) {
                entry.state.stars = before
                log('cannot save stars', username, String(e))
                return { ok: false, reason: 'save' }
            }
            return { ok: true, exists: true, stars: visible(entry.state.stars) }
        })
    }

    async function treeStars_toggle(params, ctx) {
        const username = requireUser(ctx)
        if (!username) return { ok: false, reason: 'auth' }
        const p = normalizePath(params?.path)
        if (!p || typeof params?.starred !== 'boolean') return { ok: false, reason: 'bad' }
        const name = normalizeName(params?.name)
        return queueAccount(username, async () => {
            const entry = await load(username)
            const before = entry.state.stars.map(item => ({ ...item }))
            const list = entry.state.stars
            const index = list.findIndex(item => item.path === p)
            if (params.starred) {
                if (index >= 0) {
                    list[index] = { ...list[index], name: name || list[index].name, at: Date.now() }
                } else {
                    list.push({
                        path: p,
                        name: name || displayName(p),
                        at: Date.now(),
                    })
                    if (list.length > MAX_STARS) list.splice(0, list.length - MAX_STARS)
                }
            } else if (index >= 0) {
                list.splice(index, 1)
            }
            try { await save(username, entry) }
            catch (e) {
                entry.state.stars = before
                log('cannot toggle star', username, String(e))
                return { ok: false, reason: 'save' }
            }
            return { ok: true, exists: true, stars: visible(entry.state.stars) }
        })
    }

    return {
        customRest: {
            treeStars_get,
            treeStars_set,
            treeStars_toggle,
        },
    }
}
