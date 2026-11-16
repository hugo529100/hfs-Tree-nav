"use strict"; {
    const cfg = HFS.getPluginConfig()
    const VISITED_URI_KEY = 'tree-nav-visited-uris-v1'
    const STATE_KEY = 'tree-nav-open-v1'
    const STAR_KEY = 'tree-nav-starred-v1'
    const RATIO_DESK_KEY = 'tree-nav-ratio-desk-v1'
    const RATIO_MOB_KEY = 'tree-nav-ratio-mob-v1'
    const STAR_ON = '\u2605\uFE0E'
    const STAR_OFF = '\u2606\uFE0E'

    const DEFAULT_DESK_VW = 20
    const DEFAULT_MOB_VH = 25

    const { h, React } = HFS

let rootLabelCache = null
function extractRootFromTitle(raw) {
    if (!raw) return ''
    let s = String(raw).trim()
    if (!s || s === 'HFS' || s === 'HFS - ') return ''
    const m = s.match(/^([^|\-–—\/\\]+?)(?:\s*[|\-–—\/\\]|$)/)
    if (m && m[1]) {
        const head = m[1].trim()
        if (head) return head
    }
    if (s.includes('/')) {
        const head = s.split('/')[0].trim()
        if (head) return head
    }
    return s
}

function getRootLabel() {
    if (rootLabelCache != null) return rootLabelCache
    try {
        const rl = cfg && cfg.rootLabel
        if (rl && String(rl).trim() && String(rl).trim() !== 'Root') {
            rootLabelCache = String(rl).trim()
            return rootLabelCache
        }
    } catch {}
    try {
        const t = (HFS.state && HFS.state.title) || ''
        const head = extractRootFromTitle(t)
        if (head) { rootLabelCache = head; return rootLabelCache }
    } catch {}
    try {
        const head = extractRootFromTitle(document.title)
        if (head) { rootLabelCache = head; return rootLabelCache }
    } catch {}
    try {
        const lw = document.querySelector('.list-wrapper[uri]')
        const u = lw && lw.getAttribute('uri')
        if (u && u !== '/') {
            const parts = canonicalUri(u).split('/').filter(Boolean)
            if (parts.length) return decodeName(parts[parts.length - 1])
        }
    } catch {}
    return 'Root'
}

    function parseList(str) {
        if (!str) return []
        if (Array.isArray(str)) return str.map(s => String(s).trim()).filter(Boolean)
        return String(str).split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
    }
    function makeMatchers(patterns) {
        return patterns.map(p => {
            try {
                const re = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
                return new RegExp('^' + re + '$', 'i')
            } catch { return null }
        }).filter(Boolean)
    }
    const hideMatchers = makeMatchers(parseList(cfg.hideFolders))
    function isHiddenFolder(name) {
        if (!name) return false
        return hideMatchers.some(re => re.test(name))
    }

    function loadVisitedUris() {
        try {
            const arr = JSON.parse(sessionStorage.getItem(VISITED_URI_KEY) || '[]')
            if (Array.isArray(arr)) return arr
        } catch {}
        return []
    }
    function saveVisitedUris(arr) {
        try { sessionStorage.setItem(VISITED_URI_KEY, JSON.stringify(arr.slice(0, 500))) } catch {}
    }
    let visitedUris = loadVisitedUris()
    function markVisited(uri) {
        uri = canonicalUri(uri)
        if (!visitedUris.includes(uri)) {
            visitedUris.push(uri)
            saveVisitedUris(visitedUris)
        }
    }
    function pruneVisitedUris() {
        const keep = new Set()
        function walk(n) {
            if (!n) return
            keep.add(n.uri)
            for (const c of n.children || []) walk(c)
        }
        walk(visited['/'])
        const before = visitedUris.length
        visitedUris = visitedUris.filter(u => keep.has(u))
        if (visitedUris.length !== before) saveVisitedUris(visitedUris)
    }

    function loadOpenState() {
        try {
            const v = localStorage.getItem(STATE_KEY)
            if (v === '0') return false
            if (v === '1') return true
        } catch {}
        return false
    }
    function saveOpenState(open) {
        try { localStorage.setItem(STATE_KEY, open ? '1' : '0') } catch {}
    }

    function loadRatio(key) {
        try {
            const v = parseFloat(localStorage.getItem(key))
            if (isFinite(v) && v > 0) return v
        } catch {}
        return null
    }
    function saveRatio(key, val) {
        if (!isFinite(val) || val <= 0) return
        try { localStorage.setItem(key, String(val)) } catch {}
    }

    function loadStarred() {
        try {
            const raw = JSON.parse(localStorage.getItem(STAR_KEY) || '[]')
            const map = new Map()
            if (Array.isArray(raw)) {
                for (const item of raw) {
                    if (item && typeof item === 'object' && typeof item.uri === 'string') {
                        const uri = canonicalUri(item.uri)
                        const name = typeof item.name === 'string' && item.name
                            ? item.name
                            : (function () {
                                const parts = uri.split('/').filter(Boolean)
                                return parts.length ? decodeName(parts[parts.length - 1]) : getRootLabel()
                            })()
                        map.set(uri, name)
                    }
                }
            }
            return map
        } catch {}
        return new Map()
    }
    function saveStarred(map) {
        try {
            const arr = Array.from(map.entries()).map(([uri, name]) => ({ uri, name }))
            localStorage.setItem(STAR_KEY, JSON.stringify(arr))
        } catch {}
    }
    let starred = loadStarred()
    function isStarred(uri) { return starred.has(canonicalUri(uri)) }
    function toggleStar(uri, name) {
        uri = canonicalUri(uri)
        if (starred.has(uri)) {
            starred.delete(uri)
        } else {
            let n = name
            if (n == null || n === '') {
                const parts = uri.split('/').filter(Boolean)
                n = parts.length ? decodeName(parts[parts.length - 1]) : getRootLabel()
            }
            starred.set(uri, n)
        }
        saveStarred(starred)
        try { window.dispatchEvent(new CustomEvent('tree-nav-star-changed')) } catch {}
    }

    function decodeName(s) {
        if (!s) return ''
        let r = String(s)
        for (let i = 0; i < 3; i++) {
            try {
                const d = decodeURIComponent(r)
                if (d === r) break
                r = d
            } catch { break }
        }
        return r.replace(/\/+$/, '')
    }

    function canonicalUri(u) {
        if (!u) return '/'
        let s = String(u)
        s = s.split('?')[0].split('#')[0]
        if (!s.startsWith('/')) s = '/' + s
        const parts = s.split('/').filter(x => x.length > 0)
        const encodedParts = parts.map(p => {
            let d = p
            try { d = decodeURIComponent(p) } catch {}
            return encodeURIComponent(d)
        })
        return '/' + encodedParts.join('/') + (encodedParts.length ? '/' : '')
    }

    function readCurrentUri() {
        if (HFS.state && typeof HFS.state.uri === 'string' && HFS.state.uri) return canonicalUri(HFS.state.uri)
        const lw = document.querySelector('.list-wrapper[uri]')
        if (lw) {
            const u = lw.getAttribute('uri')
            if (u) return canonicalUri(u)
        }
        return canonicalUri(location.pathname)
    }

    function getSortConfig() {
        const st = HFS.state || {}
        return {
            sortBy: st.sort_by || 'name',
            invert: typeof st.invert_order === 'boolean' ? st.invert_order : false,
            foldersFirst: typeof st.folders_first === 'boolean' ? st.folders_first : true,
            numerics: typeof st.sort_numerics === 'boolean' ? st.sort_numerics : true,
        }
    }
    function sortKey() {
        const c = getSortConfig()
        return `${c.sortBy}|${c.invert}|${c.foldersFirst}|${c.numerics}`
    }
    function sortEntries(list) {
        const c = getSortConfig()
        const collator = new Intl.Collator(undefined, { numeric: c.numerics, sensitivity: 'base' })
        const arr = list.slice()
        arr.sort((a, b) => {
            if (c.foldersFirst) {
                const fa = a.isFolder ? 0 : 1
                const fb = b.isFolder ? 0 : 1
                if (fa !== fb) return fa - fb
            }
            let cmp = 0
            if (c.sortBy === 'size') cmp = (a.size || 0) - (b.size || 0)
            else if (['time', 'creation', 'mtime'].includes(c.sortBy)) {
                const ta = a.mtime ? new Date(a.mtime).getTime() : 0
                const tb = b.mtime ? new Date(b.mtime).getTime() : 0
                cmp = ta - tb
            } else if (c.sortBy === 'extension') {
                const ea = (a.name.split('.').pop() || '').toLowerCase()
                const eb = (b.name.split('.').pop() || '').toLowerCase()
                cmp = collator.compare(ea, eb)
            } else {
                cmp = collator.compare(a.name || '', b.name || '')
            }
            return c.invert ? -cmp : cmp
        })
        return arr
    }

    const FFO_STORAGE_KEY = 'hfs_fixed_folder_order_enabled'
    function isFixedFolderOrderEnabled() {
        let pluginPresent = false
        try {
            const p = HFS.plugins && HFS.plugins['Fixed-folder-order']
            if (p && (typeof p === 'object')) pluginPresent = true
        } catch {}
        if (!pluginPresent) {
            try {
                pluginPresent = !!document.querySelector('script[plugin="Fixed-folder-order"]')
            } catch {}
        }
        if (!pluginPresent) return false
        try {
            const v = localStorage.getItem(FFO_STORAGE_KEY)
            return v === null ? true : v === 'true'
        } catch {
            return true
        }
    }

    function ffoGetConfig() {
        try {
            const p = HFS.plugins && HFS.plugins['Fixed-folder-order']
            if (p && typeof p === 'object') return p
        } catch {}
        return {}
    }
    function ffoWildcardToRegex(pattern) {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
        return new RegExp('^' + escaped.replace(/\*/g, '.*') + '$', 'i')
    }
    function ffoGetPatterns(configKey) {
        const cfgF = ffoGetConfig()
        return String(cfgF[configKey] || '')
            .split(/\r?\n/)
            .map(x => x.trim())
            .filter(Boolean)
            .map(pattern => ({ pattern, regex: ffoWildcardToRegex(pattern) }))
    }
    function ffoFirstMatchingIndex(name, patterns) {
        for (let i = 0; i < patterns.length; i++) {
            if (patterns[i].regex.test(name)) return i
        }
        return -1
    }
    function ffoTagPrefix(tag) {
        if (!tag) return ''
        const match = tag.match(/^(.+?)(\d*)$/)
        return match ? match[1] : tag
    }
    function ffoCompare(a, b) {
        const cfgF = ffoGetConfig()
        const nameA = a.raw || a.name || ''
        const nameB = b.raw || b.name || ''
        const isFolderA = !!a.isFolder
        const isFolderB = !!b.isFolder

        if (isFolderA && !isFolderB) return -1
        if (!isFolderA && isFolderB) return 1

        if (cfgF.commentOrderEnabled === true) {
            const tagPatterns = ffoGetPatterns('commentOrder')
            if (tagPatterns.length > 0) {
                const aTagPrefix = ffoTagPrefix(a.comment || '')
                const bTagPrefix = ffoTagPrefix(b.comment || '')
                const aTagIndex = ffoFirstMatchingIndex(aTagPrefix, tagPatterns)
                const bTagIndex = ffoFirstMatchingIndex(bTagPrefix, tagPatterns)
                const aHasTag = aTagIndex !== -1
                const bHasTag = bTagIndex !== -1
                if (aHasTag && !bHasTag) return -1
                if (!aHasTag && bHasTag) return 1
                if (aHasTag && bHasTag) {
                    if (aTagIndex !== bTagIndex) return aTagIndex - bTagIndex
                    return 0
                }
            }
        }

        const orderConfigKey = isFolderA ? 'fixedOrder' : 'fileOrder'
        const orderPatterns = ffoGetPatterns(orderConfigKey)
        if (orderPatterns.length > 0) {
            const aIndex = ffoFirstMatchingIndex(nameA, orderPatterns)
            const bIndex = ffoFirstMatchingIndex(nameB, orderPatterns)
            const aInOrder = aIndex !== -1
            const bInOrder = bIndex !== -1
            if (aInOrder && !bInOrder) return -1
            if (!aInOrder && bInOrder) return 1
            if (aInOrder && bInOrder) return aIndex - bIndex
        }
        return 0
    }
    function ffoSortEntries(list) {
        const arr = list.slice()
        const decorated = arr.map((it, i) => ({ it, i }))
        decorated.sort((x, y) => {
            const c = ffoCompare(x.it, y.it)
            if (c !== 0) return c
            return x.i - y.i
        })
        return decorated.map(d => d.it)
    }

    function buildDirsFromList(uri, list) {
        uri = canonicalUri(uri)

        let domOrder = null
        const lw = document.querySelector('.list-wrapper[uri]')
        if (lw && canonicalUri(lw.getAttribute('uri')) === uri) {
            const nodes = lw.querySelectorAll('ul.dir > li.folder')
            if (nodes.length) {
                domOrder = []
                nodes.forEach(li => {
                    const a = li.querySelector('a[id]')
                    if (!a) return
                    const href = a.getAttribute('href') || ''
                    if (href) domOrder.push(canonicalUri(href))
                })
            }
        }

        let dirs = (Array.isArray(list) ? list : [])
            .filter(x => x && x.n && x.n.endsWith('/'))
            .map(x => {
                const rawName = x.n.replace(/\/$/, '')
                const name = decodeName(rawName)
                const childUri = canonicalUri(uri + rawName)
                return {
                    name, uri: childUri, raw: rawName,
                    isFolder: true, size: 0,
                    mtime: x.m || x.c || null,
                    comment: x.comment || x.commentText || '',
                    children: [],
                }
            })
            .filter(x => x.name && !isHiddenFolder(x.name))

        const seen = new Set()
        dirs = dirs.filter(d => {
            const k = d.uri
            if (seen.has(k)) return false
            seen.add(k)
            return true
        })

        if (domOrder) {
            const orderMap = new Map(domOrder.map((u, i) => [u, i]))
            dirs.sort((a, b) => {
                const ia = orderMap.has(a.uri) ? orderMap.get(a.uri) : 9999
                const ib = orderMap.has(b.uri) ? orderMap.get(b.uri) : 9999
                return ia - ib
            })
        } else if (isFixedFolderOrderEnabled()) {
            dirs = ffoSortEntries(dirs)
        } else {
            dirs = sortEntries(dirs)
        }
        return dirs
    }

    async function fetchDirs(uri) {
        uri = canonicalUri(uri)
        const url = '/~/api/get_file_list?uri=' + encodeURIComponent(uri)
        const r = await fetch(url, { credentials: 'same-origin' })
        if (!r.ok) throw new Error('get_file_list failed ' + r.status)
        const data = await r.json()
        return buildDirsFromList(uri, data.list)
    }

    const visited = {}

    function ensureRootNode() {
        if (!visited['/']) {
            visited['/'] = { name: getRootLabel(), uri: '/', children: [], _loaded: false }
        }
        if (!Array.isArray(visited['/'].children)) visited['/'].children = []
        return visited['/']
    }

    function ensureNodePath(uri) {
        uri = canonicalUri(uri)
        ensureRootNode()
        if (uri === '/') return visited['/']
        const parts = uri.split('/').filter(Boolean)
        let parent = visited['/']
        for (let i = 0; i < parts.length; i++) {
            const rawPart = parts[i]
            const name = decodeName(rawPart)
            const childUri = '/' + parts.slice(0, i + 1).join('/') + '/'
            parent.children = parent.children || []
            let child = parent.children.find(c => c.uri === childUri)
            if (!child) {
                if (parent._loaded) return null
                child = { name, uri: childUri, raw: rawPart, children: [], _loaded: false }
                parent.children.push(child)
            } else {
                if (!child.name || child.name === child.raw) child.name = name
                if (typeof child._loaded !== 'boolean') child._loaded = false
            }
            if (!Array.isArray(child.children)) child.children = []
            parent = child
        }
        return parent
    }

    function findNodeByUri(uri) {
        uri = canonicalUri(uri)
        if (!visited['/']) return null
        if (uri === '/') return visited['/']
        const parts = uri.split('/').filter(Boolean)
        let p = visited['/']
        for (let i = 0; i < parts.length; i++) {
            const childUri = '/' + parts.slice(0, i + 1).join('/') + '/'
            const child = (p.children || []).find(c => c.uri === childUri)
            if (!child) return null
            p = child
        }
        return p
    }

    function upsertNodeByList(uri, list) {
        uri = canonicalUri(uri)

        if (uri === '/') {
            const root = ensureRootNode()
            const dirs = buildDirsFromList('/', list)
            const oldMap = new Map((root.children || []).map(c => [c.uri, c]))
            const next = dirs.map(d => {
                const old = oldMap.get(d.uri)
                return old ? { ...d, children: old.children || [], _loaded: !!old._loaded } : d
            })
            const oldKeys = (root.children || []).map(c => c.uri + '|' + c.name).join('\n')
            const newKeys = next.map(c => c.uri + '|' + c.name).join('\n')
            root.children = next
            root._loaded = true
            return oldKeys !== newKeys
        }

        const parts = uri.split('/').filter(Boolean)
        const parentUri = '/' + parts.slice(0, -1).join('/') + (parts.length > 1 ? '/' : '')
        const parent = ensureNodePath(parentUri)
        if (!parent) return false

        let node = (parent.children || []).find(c => c.uri === uri)
        if (!node) {
            const rawName = parts[parts.length - 1]
            node = {
                name: decodeName(rawName),
                uri,
                raw: rawName,
                children: [],
                _loaded: false,
            }
            parent.children.push(node)
        }

        const dirs = buildDirsFromList(uri, list)
        const oldMap = new Map((node.children || []).map(c => [c.uri, c]))
        const next = dirs.map(d => {
            const old = oldMap.get(d.uri)
            return old ? { ...d, children: old.children || [], _loaded: !!old._loaded } : d
        })
        const oldKeys = (node.children || []).map(c => c.uri + '|' + c.name).join('\n')
        const newKeys = next.map(c => c.uri + '|' + c.name).join('\n')
        node.children = next
        node._loaded = true
        return oldKeys !== newKeys
    }

    async function loadChildrenInto(node) {
        try {
            const dirs = await fetchDirs(node.uri)
            const oldMap = new Map((node.children || []).map(c => [c.uri, c]))
            node.children = dirs.map(d => {
                const old = oldMap.get(d.uri)
                if (old) {
                    return { ...d, children: old.children || [], _loaded: !!old._loaded }
                }
                return d
            })
            node._loaded = true
            try {
                window.dispatchEvent(new CustomEvent('tree-nav-node-loaded', {
                    detail: { uri: node.uri },
                }))
            } catch {}
        } catch (e) {
            console.warn('[Tree-nav] loadChildrenInto failed', node.uri, e)
        }
    }
    async function ensureChildren(node) {
        if (node._loaded) return node.children || []
        await loadChildrenInto(node)
        return node.children || []
    }

    const origFetchRef = { current: null }
    const GET_LIST_RE = /\/~\/api\/get_file_list(?:\?|$)/

    function installGetFileListTap() {
        if (window.__treeNavListTapInstalled) return
        window.__treeNavListTapInstalled = true

        const origFetch = window.fetch.bind(window)
        origFetchRef.current = origFetch

        window.fetch = async function (input, init) {
            const res = await origFetch(input, init)
            try {
                const url = typeof input === 'string'
                    ? input
                    : (input && input.url) || ''
                if (GET_LIST_RE.test(url) && res.ok) {
                    const m = url.match(/[?&]uri=([^&]+)/)
                    const reqUri = m ? canonicalUri(decodeURIComponent(m[1])) : '/'
                    res.clone().json().then(data => {
                        const changed = upsertNodeByList(reqUri, data.list)
                        if (changed) {
                            try {
                                window.dispatchEvent(new CustomEvent('tree-nav-tree-updated', {
                                    detail: { uri: reqUri },
                                }))
                            } catch {}
                        }
                    }).catch(() => {})
                }
            } catch {}
            return res
        }
    }

    const iconMapByUri = new Map()
    const iconMapByName = new Map()

    function extractIconClass(li) {
        const a = li.querySelector('a[id]')
        if (!a) return ''
        const iconEl = a.querySelector('.icon.font-icon')
        if (!iconEl) return ''
        const classes = Array.from(iconEl.classList).filter(c => /^fa-/.test(c))
        return classes.join(' ')
    }

    function rebuildIconMap() {
        iconMapByUri.clear()
        iconMapByName.clear()
        try {
            document.querySelectorAll('.list-wrapper ul.dir > li.folder').forEach(li => {
                const a = li.querySelector('a[id]')
                if (!a) return
                const href = a.getAttribute('href') || ''
                if (!href) return
                const icon = extractIconClass(li)
                if (!icon) return
                const uri = canonicalUri(href)
                iconMapByUri.set(uri, icon)
                const nameEl = li.querySelector('.entry-name')
                const name = nameEl ? nameEl.textContent.trim() : ''
                if (name) iconMapByName.set(name, icon)
            })
        } catch (e) {
            console.warn('[Tree-nav] rebuildIconMap failed', e)
        }
    }

    function getIconForNode(node) {
        if (!node) return ''
        if (node.uri && iconMapByUri.has(node.uri)) return iconMapByUri.get(node.uri)
        if (node.name && iconMapByName.has(node.name)) return iconMapByName.get(node.name)
        return ''
    }

    function findMenuTargetUri(menu) {
        try {
            const du = menu.getAttribute('data-uri')
            if (du) return canonicalUri(du)
            const a = menu.querySelector('a[href]')
            if (a) {
                const href = a.getAttribute('href') || ''
                if (href && !href.startsWith('?')) return canonicalUri(href)
            }
            const li = menu.closest('li.folder')
            if (li) {
                const a2 = li.querySelector('a[id]')
                if (a2) {
                    const href = a2.getAttribute('href') || ''
                    if (href) return canonicalUri(href)
                }
            }
        } catch {}
        return ''
    }
    function injectIconIntoMenu(menu) {
        if (!menu || menu.dataset.treeNavIconInjected === '1') return
        const uri = findMenuTargetUri(menu)
        if (!uri) return
        let iconClass = iconMapByUri.get(uri)
        if (!iconClass) {
            const titleEl = menu.querySelector('.file-menu-title, .dialog-title')
            const name = titleEl ? titleEl.textContent.trim() : ''
            if (name && iconMapByName.has(name)) iconClass = iconMapByName.get(name)
        }
        if (!iconClass) return

        let anchor = menu.querySelector('.file-menu-title, .dialog-title')
        if (!anchor) anchor = menu.querySelector('a, button')
        const span = document.createElement('span')
        span.className = 'icon font-icon tree-nav-menu-icon ' + iconClass
        span.setAttribute('aria-hidden', 'true')
        span.style.marginRight = '0.4em'

        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(span, anchor)
        } else {
            menu.insertBefore(span, menu.firstChild)
        }
        menu.dataset.treeNavIconInjected = '1'
    }

    let iconInjectionInited = false
    function initIconInjection() {
        if (iconInjectionInited) return
        iconInjectionInited = true

        rebuildIconMap()

        const listObserver = new MutationObserver(() => {
            rebuildIconMap()
        })
        const lw = document.querySelector('.list-wrapper')
        if (lw) {
            listObserver.observe(lw, { childList: true, subtree: true })
        } else {
            const waitObserver = new MutationObserver(() => {
                const el = document.querySelector('.list-wrapper')
                if (el) {
                    waitObserver.disconnect()
                    listObserver.observe(el, { childList: true, subtree: true })
                    rebuildIconMap()
                }
            })
            waitObserver.observe(document.body, { childList: true, subtree: true })
        }

        const menuObserver = new MutationObserver(muts => {
            for (const m of muts) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof Element)) continue
                    if (node.classList && node.classList.contains('file-menu')) {
                        injectIconIntoMenu(node)
                    }
                    const menus = node.querySelectorAll && node.querySelectorAll('.file-menu')
                    if (menus && menus.length) menus.forEach(injectIconIntoMenu)
                }
            }
        })
        menuObserver.observe(document.body, { childList: true, subtree: true })
    }

    const HINT_KEYFRAMES_ID = 'tree-nav-hint-keyframes'
    function injectHintKeyframes() {
        if (document.getElementById(HINT_KEYFRAMES_ID)) return
        const style = document.createElement('style')
        style.id = HINT_KEYFRAMES_ID
        style.textContent = `
@keyframes tree-nav-hint-btn {
    0%   { opacity: .7; }
    25%  { opacity: 1;  }
    50%  { opacity: .85; }
    75%  { opacity: 1;  }
    100% { opacity: .9; }
}
@keyframes tree-nav-hint-line-desk {
    0%   { width: 2px;  background-color: var(--faint-contrast); opacity: .8; box-shadow: none; }
    25%  { width: 4px;  background-color: var(--text);           opacity: 1;  box-shadow: 0 0 6px var(--text); }
    50%  { width: 2px;  background-color: var(--faint-contrast); opacity: .8; box-shadow: none; }
    75%  { width: 4px;  background-color: var(--text);           opacity: 1;  box-shadow: 0 0 6px var(--text); }
    100% { width: 2px;  background-color: var(--faint-contrast); opacity: .8; box-shadow: none; }
}
@keyframes tree-nav-hint-line-mob {
    0%   { width: 44px; background-color: var(--bg);   opacity: .9; box-shadow: none; }
    25%  { width: 72px; background-color: var(--text); opacity: 1;  box-shadow: 0 0 8px var(--text); }
    50%  { width: 44px; background-color: var(--bg);   opacity: .9; box-shadow: none; }
    75%  { width: 72px; background-color: var(--text); opacity: 1;  box-shadow: 0 0 8px var(--text); }
    100% { width: 44px; background-color: var(--bg);   opacity: .9; box-shadow: none; }
}
`
        document.head.appendChild(style)
    }

    function TreeNode({ node, depth, currentUri, onNavigate, inSelectedSubtree, starVersion }) {
        const isCurrent = currentUri === node.uri
        const isOnPath = currentUri !== '/' && (currentUri === node.uri || currentUri.startsWith(node.uri))
        const [open, setOpen] = React.useState(isOnPath)
        const [children, setChildren] = React.useState(() => node.children || [])
        const [loading, setLoading] = React.useState(false)

        React.useEffect(() => {}, [starVersion])

        React.useEffect(() => {
            setChildren(node.children || [])
        }, [node.children])

        React.useEffect(() => {
            if (isOnPath) {
                setOpen(true)
                if (!node._loaded && !loading) {
                    setLoading(true)
                    ensureChildren(node).then(kids => {
                        setChildren(kids)
                        setLoading(false)
                    }).catch(() => setLoading(false))
                }
            } else {
                setOpen(false)
            }
        }, [currentUri])

        const toggle = async e => {
            e.stopPropagation()
            e.preventDefault()
            const next = !open
            setOpen(next)
            if (next) {
                setLoading(true)
                try {
                    await loadChildrenInto(node)
                    setChildren(node.children || [])
                } catch {}
                setLoading(false)
            }
        }

        const inSubtree = !!inSelectedSubtree && !isCurrent

        const rowClass =
            'tree-row' +
            (isCurrent ? ' current' : '') +
            (isOnPath ? ' on-path' : '') +
            (inSubtree ? ' in-subtree' : '')

        const childInSubtree = isCurrent

        const customIcon = getIconForNode(node)
        const iconClass = customIcon
            ? customIcon
            : 'fa-folder'

        const starredNow = isStarred(node.uri)

        const onStarClick = e => {
            e.stopPropagation()
            e.preventDefault()
            toggleStar(node.uri, node.name)
        }

        return h('div', {
            className: 'tree-node' + (inSubtree ? ' in-subtree-node' : ''),
            'data-depth': depth
        },
            h('div', {
                className: rowClass,
                onClick: () => onNavigate(node.uri),
                title: node.uri,
            },
                depth > 1
                    ? h('span', {
                        className: 'tree-star-slot' + (starredNow ? ' starred' : ''),
                        role: 'button',
                        'aria-label': starredNow ? 'Remove star' : 'Add star',
                        title: starredNow ? 'Remove star' : 'Add star',
                        onClick: onStarClick,
                    }, starredNow ? STAR_ON : STAR_OFF)
                    : null,
                h('span', {
                    className: 'tree-arrow' + (open ? ' open' : ''),
                    onClick: toggle,
                    role: 'button',
                    'aria-label': open ? 'Collapse' : 'Expand',
                }, loading ? '…' : (open ? '▾' : '▸')),
                h('span', {
                    className: 'icon font-icon ' + iconClass,
                    'aria-hidden': 'true',
                }),
                h('span', { className: 'tree-name' }, decodeName(node.name)),
            ),
            open && children.length > 0 && h('div', { className: 'tree-children' },
                children.map(c => h(TreeNode, {
                    key: c.uri, node: c, depth: depth + 1,
                    currentUri, onNavigate,
                    inSelectedSubtree: childInSubtree,
                    starVersion,
                }))
            ),
        )
    }

    function StarredSection({ currentUri, onNavigate, starVersion }) {
        const items = React.useMemo(() => {
            return Array.from(starred.entries())
                .map(([uri, name]) => ({ uri, name }))
                .sort((a, b) => a.name.localeCompare(b.name))
        }, [starVersion])

        if (items.length === 0) return null

        return h('div', { className: 'tree-starred-section' },
            items.map(it => {
                const isCurrent = currentUri === it.uri
                return h('div', {
                    key: it.uri,
                    className: 'tree-starred-row' + (isCurrent ? ' current' : ''),
                    title: it.uri,
                    onClick: () => onNavigate(it.uri),
                },
                    h('span', { className: 'tree-starred-icon', 'aria-hidden': 'true' }, STAR_ON),
                    h('span', { className: 'tree-starred-name' }, it.name),
                    h('button', {
                        className: 'tree-starred-remove',
                        title: 'Remove star',
                        'aria-label': 'Remove star',
                        onClick: e => {
                            e.stopPropagation()
                            toggleStar(it.uri, it.name)
                        },
                    }, '×'),
                )
            })
        )
    }

    function Sidebar({ currentUri, onNavigate, onClose, sortSig, onResize }) {
        const [tree, setTree] = React.useState(null)
        const [ready, setReady] = React.useState(false)
        const [starVersion, setStarVersion] = React.useState(0)
        const [folderStats, setFolderStats] = React.useState(() => readFolderStats())
        const scrollRef = React.useRef(null)
        const bootRef = React.useRef(false)

        function readFolderStats() {
            try {
                const el = document.querySelector('#folder-stats')
                if (!el) return ''
                return (el.textContent || '').trim()
            } catch { return '' }
        }

        React.useEffect(() => {
            const onStarChange = () => setStarVersion(v => v + 1)
            window.addEventListener('tree-nav-star-changed', onStarChange)
            return () => window.removeEventListener('tree-nav-star-changed', onStarChange)
        }, [])

        React.useEffect(() => {
            const sync = () => {
                const t = readFolderStats()
                setFolderStats(prev => (prev === t ? prev : t))
            }
            const mo = new MutationObserver(sync)
            const rootEl = document.getElementById('root')
            if (rootEl) {
                mo.observe(rootEl, { childList: true, subtree: true, characterData: true })
            }
            const timer = setInterval(sync, 800)
            sync()
            return () => {
                mo.disconnect()
                clearInterval(timer)
            }
        }, [])

        React.useEffect(() => () => {
            document.body.classList.remove('tree-resizing')
        }, [])

        React.useEffect(() => {
            if (!ready) return
            let t = 0
            const refresh = () => {
                clearTimeout(t)
                t = setTimeout(() => {
                    try { ensureNodePath(readCurrentUri()) } catch {}
                    setTree(visited['/'] ? { '/': visited['/'] } : null)
                }, 16)
            }
            window.addEventListener('tree-nav-tree-updated', refresh)
            window.addEventListener('tree-nav-node-loaded', refresh)
            return () => {
                clearTimeout(t)
                window.removeEventListener('tree-nav-tree-updated', refresh)
                window.removeEventListener('tree-nav-node-loaded', refresh)
            }
        }, [ready])

        React.useEffect(() => {
            if (!ready) return
            let cancelled = false
            ;(async () => {
                try {
                    const cur = canonicalUri(currentUri)
                    const node = ensureNodePath(cur)
                    if (node) {
                        await loadChildrenInto(node)
                        if (!cancelled) {
                            try { pruneVisitedUris() } catch {}
                            setTree(visited['/'] ? { '/': visited['/'] } : null)
                        }
                    }
                } catch (e) {
                }
            })()
            return () => { cancelled = true }
        }, [ready, currentUri])

        async function bootstrap() {
            if (bootRef.current) return
            bootRef.current = true
            const cur = readCurrentUri()

            const root = ensureRootNode()

            ensureNodePath(cur)

            if (!root._loaded) {
                await loadChildrenInto(root)
            }

            if (cur !== '/') {
                const parts = cur.split('/').filter(Boolean)
                let p = visited['/']
                for (let i = 0; i < parts.length; i++) {
                    const childUri = '/' + parts.slice(0, i + 1).join('/') + '/'
                    const child = (p.children || []).find(c => c.uri === childUri)
                    if (!child) break
                    if (!child._loaded) {
                        await loadChildrenInto(child)
                    }
                    p = child
                }
            }

            markVisited(cur)
        }

        React.useEffect(() => {
            (async () => {
                try { await bootstrap() } catch (e) { console.warn('[Tree-nav] bootstrap failed', e) }
                setTree(visited['/'] ? { '/': visited['/'] } : null)
                setReady(true)
            })()
        }, [])

        React.useEffect(() => {
            if (!ready) return
            ;(async () => {
                const cur = canonicalUri(currentUri)
                ensureNodePath(cur)
                markVisited(cur)

                const node = ensureNodePath(cur)
                if (node && !node._loaded) {
                    await loadChildrenInto(node)
                }

                const parts = cur.split('/').filter(Boolean)
                let p = visited['/']
                for (let i = 0; i < parts.length - 1; i++) {
                    const childUri = '/' + parts.slice(0, i + 1).join('/') + '/'
                    const child = (p.children || []).find(c => c.uri === childUri)
                    if (!child) break
                    if (!child._loaded) {
                        await loadChildrenInto(child)
                    }
                    p = child
                }

                setTree(visited['/'] ? { '/': visited['/'] } : null)
            })()
        }, [currentUri, ready])

        React.useEffect(() => {
            if (!ready) return
            ;(async () => {
                const cur = canonicalUri(currentUri)
                const node = ensureNodePath(cur)
                if (node && !node._loaded) {
                    await loadChildrenInto(node)
                }
                async function refreshAll(n) {
                    if (!n._loaded) return
                    await loadChildrenInto(n)
                    for (const c of n.children || []) {
                        if (c.uri && cur.startsWith(c.uri)) {
                            await refreshAll(c)
                        }
                    }
                }
                await refreshAll(visited['/'])
                setTree(visited['/'] ? { '/': visited['/'] } : null)
            })()
        }, [sortSig])

        React.useEffect(() => {
            if (!ready) return
            const t = setTimeout(() => {
                const scroller = scrollRef.current
                if (!scroller) return
                const el = scroller.querySelector('.tree-row.current')
                if (!el) return
                const sRect = scroller.getBoundingClientRect()
                const eRect = el.getBoundingClientRect()
                const needScrollY = eRect.top < sRect.top || eRect.bottom > sRect.bottom
                const needScrollX = eRect.left < sRect.left || eRect.right > sRect.right
                if (needScrollY || needScrollX) {
                    try {
                        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
                    } catch {
                        el.scrollIntoView(false)
                    }
                }
            }, 30)
            return () => clearTimeout(t)
        }, [currentUri, ready, sortSig])

        const dragRef = React.useRef(null)

        const onPointerDown = e => {
            e.preventDefault()
            const nav = e.currentTarget.parentNode
            const rect = nav.getBoundingClientRect()
            const isMobile = window.matchMedia('(orientation: portrait)').matches
            dragRef.current = {
                isMobile,
                startX: e.clientX,
                startY: e.clientY,
                startW: isMobile ? rect.height : rect.width,
                vw: window.innerWidth,
                vh: window.innerHeight,
                lastW: isMobile ? rect.height : rect.width,
                moved: false,
            }
            try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
            document.body.classList.add('tree-resizing')
        }

        const onPointerMove = e => {
            const d = dragRef.current
            if (!d) return
            const dx = e.clientX - d.startX
            const dy = e.clientY - d.startY
            if (!d.moved) {
                if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return
                d.moved = true
            }
            e.preventDefault()
            if (d.isMobile) {
                const dy2 = e.clientY - d.startY
                let hh = d.startW + dy2
                const min = d.vh * 0.10, max = d.vh * 0.70
                hh = Math.max(min, Math.min(max, hh))
                d.lastW = hh
                const vhVal = (hh / d.vh) * 100
                document.body.style.setProperty('--tree-mobile-h', vhVal + 'vh')
            } else {
                const dx2 = e.clientX - d.startX
                let ww = d.startW + dx2
                const min = d.vw * 0.10, max = d.vw * 0.60
                ww = Math.max(min, Math.min(max, ww))
                d.lastW = ww
                const vwVal = (ww / d.vw) * 100
                document.body.style.setProperty('--tree-width', vwVal + 'vw')
            }
        }

        const endDrag = e => {
            const d = dragRef.current
            if (!d) return
            dragRef.current = null
            try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
            document.body.classList.remove('tree-resizing')
            if (!d.moved) return
            if (d.isMobile) {
                onResize && onResize('mob', (d.lastW / d.vh) * 100)
            } else {
                onResize && onResize('desk', (d.lastW / d.vw) * 100)
            }
        }

        const onNavContextMenu = e => {
            e.preventDefault()
            e.stopPropagation()
            return false
        }

        return h('div', { className: 'hfs-tree-nav', onContextMenu: onNavContextMenu },
h('div', { className: 'tree-header' },
    h('span', { className: 'tree-title' }, 'Folders'),
    folderStats
        ? h('span', {
            className: 'tree-header-stats',
            title: folderStats,
        }, folderStats)
        : null
),
            h('button', {
                className: 'tree-close',
                title: 'Hide tree',
                onClick: e => {
                    e.currentTarget.blur()
                    onClose && onClose()
                },
                'aria-label': 'Hide tree',
            },
                h('span', { className: 'icon font-icon fa-cancel', 'aria-hidden': 'true' })
            ),
            h('div', { className: 'tree-scroll', ref: scrollRef },
                !ready && h('div', { className: 'tree-loading' }, 'Loading…'),
                ready && (!tree || !tree['/'] || (tree['/'].children || []).length === 0) &&
                    h('div', { className: 'tree-loading' }, 'No folders'),
                ready && h(StarredSection, { currentUri, onNavigate, starVersion }),
                tree && tree['/'] && h('div', { className: 'tree-root' },
                    h('div', {
                        className: 'tree-row' + (currentUri === '/' ? ' current' : ''),
                        onClick: () => onNavigate('/'),
                        title: '/',
                    },
                        h('span', { className: 'icon font-icon fa-home', 'aria-hidden': 'true' }),
                        h('span', { className: 'tree-name' }, tree['/'].name || 'Root'),
                    ),
                    h('div', { className: 'tree-children' },
                        (tree['/'].children || [])
                            .filter(c => !isHiddenFolder(c.name))
                            .map(c => h(TreeNode, {
                                key: c.uri, node: c, depth: 1,
                                currentUri, onNavigate,
                                inSelectedSubtree: currentUri === '/',
                                starVersion,
                            }))
                    )
                )
            ),
            h('div', {
                className: 'tree-resizer',
                role: 'separator',
                'aria-orientation': 'vertical',
                onPointerDown,
                onPointerMove,
                onPointerUp: endDrag,
                onPointerCancel: endDrag,
            },
                h('span', {
                    className: 'tree-resizer-grip',
                    'aria-hidden': 'true',
                    onPointerDown,
                    onPointerMove,
                    onPointerUp: endDrag,
                    onPointerCancel: endDrag,
                })
            )
        )
    }

    function ToggleButton({ onClick }) {
        const ref = React.useRef(null)
        const lineRef = React.useRef(null)

        React.useEffect(() => {
            injectHintKeyframes()

            const el = ref.current
            const line = lineRef.current
            if (!el || !line) return

            const isLandscape = window.matchMedia('(orientation: landscape)').matches

            let raf1 = 0, raf2 = 0, t = 0
            raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => {
                    if (!el.isConnected || !line.isConnected) return

                    el.style.animation = 'none'
                    void el.offsetWidth
                    el.style.animation = isLandscape
                        ? 'tree-nav-hint-btn-desk 1.6s ease-in-out 1 both'
                        : 'tree-nav-hint-btn-mob 1.6s ease-in-out 1 both'

                    line.style.animation = 'none'
                    void line.offsetWidth
                    line.style.animation = isLandscape
                        ? 'tree-nav-hint-line-desk 1.6s ease-in-out 1 both'
                        : 'tree-nav-hint-line-mob 1.6s ease-in-out 1 both'

                    t = setTimeout(() => {
                        if (!el.isConnected || !line.isConnected) return
                        el.style.animation = ''
                        line.style.animation = ''
                    }, 1700)
                })
            })

            return () => {
                cancelAnimationFrame(raf1)
                cancelAnimationFrame(raf2)
                clearTimeout(t)
                if (el) el.style.animation = ''
                if (line) line.style.animation = ''
            }
        }, [])

        return h('button', {
            ref,
            className: 'tree-fab collapsed',
            title: 'Open tree',
            onClick,
            'aria-label': 'Open tree',
        },
            h('span', { className: 'icon font-icon fa-menu', 'aria-hidden': 'true' }),
            h('span', { ref: lineRef, className: 'tree-fab-line', 'aria-hidden': 'true' })
        )
    }

    function TreeShell() {
        const [open, setOpen] = React.useState(() => loadOpenState())
        const [currentUri, setCurrentUri] = React.useState(() => readCurrentUri())
        const [sortSig, setSortSig] = React.useState(() => sortKey())
        const [tempDeskRatio, setTempDeskRatio] = React.useState(() => loadRatio(RATIO_DESK_KEY))
        const [tempMobRatio, setTempMobRatio] = React.useState(() => loadRatio(RATIO_MOB_KEY))

        React.useEffect(() => {
            document.body.classList.toggle('hfs-tree-open', open)
            document.body.classList.add('hfs-tree-layout')

            const vw = tempDeskRatio != null ? tempDeskRatio : DEFAULT_DESK_VW
            document.body.style.setProperty('--tree-width', vw + 'vw')
            document.body.style.setProperty('--tree-ratio', String(vw))

            const vh = tempMobRatio != null ? tempMobRatio : DEFAULT_MOB_VH
            document.body.style.setProperty('--tree-mobile-h', vh + 'vh')

            saveOpenState(open)
            return () => {
                document.body.classList.remove('hfs-tree-open', 'hfs-tree-layout')
            }
        }, [open, tempDeskRatio, tempMobRatio])

        React.useEffect(() => {
            let lastUri = readCurrentUri()
            let lastSort = sortKey()
            const sync = () => {
                const cur = readCurrentUri()
                if (cur !== lastUri) { lastUri = cur; setCurrentUri(cur) }
                const s = sortKey()
                if (s !== lastSort) { lastSort = s; setSortSig(s) }
                rebuildIconMap()
            }
            let offs = []
            try {
                if (typeof HFS.watchState === 'function') {
                    ;['uri', 'sort_by', 'invert_order', 'folders_first', 'sort_numerics'].forEach(k => {
                        try {
                            const off = HFS.watchState(k, () => sync(), false)
                            if (typeof off === 'function') offs.push(off)
                        } catch {}
                    })
                }
            } catch {}
            const mo = new MutationObserver(sync)
            const rootEl = document.getElementById('root')
            if (rootEl) mo.observe(rootEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['uri'] })
            const timer = setInterval(sync, 500)
            window.addEventListener('popstate', sync)
            return () => {
                offs.forEach(f => { try { f() } catch {} })
                mo.disconnect()
                clearInterval(timer)
                window.removeEventListener('popstate', sync)
            }
        }, [])

        React.useEffect(() => {
            initIconInjection()
            installGetFileListTap()
        }, [])

        const onNavigate = uri => {
            const target = canonicalUri(uri)
            if (target === readCurrentUri()) return
            setCurrentUri(target)
            if (typeof HFS.navigate === 'function') {
                try { HFS.navigate(target) } catch { location.href = target }
            } else {
                location.href = target
            }
        }

        const onResize = (kind, val) => {
            if (!isFinite(val) || val <= 0) return
            if (kind === 'desk') {
                setTempDeskRatio(val)
                saveRatio(RATIO_DESK_KEY, val)
            } else {
                setTempMobRatio(val)
                saveRatio(RATIO_MOB_KEY, val)
            }
        }

        return h('div', { className: 'hfs-tree-shell' + (open ? ' open' : '') },
            open && h(Sidebar, { key: 'sidebar', currentUri, onNavigate, onClose: () => setOpen(false), sortSig, onResize }),
            !open && h(ToggleButton, { key: 'toggle', onClick: () => setOpen(true) })
        )
    }

    HFS.onEvent('afterHeader', () => h(TreeShell))
}