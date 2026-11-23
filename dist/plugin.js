exports.repo = "hugo529100/hfs-Tree-nav"
exports.version = 3.2
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