exports.repo = "Hug3O/Tree-nav"
exports.version = 1.8
exports.description = "Tree navigation sidebar: jump quickly between folders at any depth to cut/copy/move files easily, with starred shortcuts."
exports.apiRequired = 9.6
exports.frontend_css = 'style.css'
exports.frontend_js = ['main.js']

exports.config = {
    rootLabel: { frontend: true, type: 'string', defaultValue: 'Root', sm: 6 },
    startExpanded: {
        frontend: true, type: 'boolean',
        label: "Expand sidebar by default",
        defaultValue: false,
        sm: 6
    },
    sidebarRatio: {
        frontend: true, type: 'select',
        options: ['1/6', '1/5', '1/4', '1/3', '2/5', '1/2'],
        defaultValue: '1/5',
        label: "Desktop sidebar width ratio",
        sm: 6
    },
    mobileRatio: {
        frontend: true, type: 'select',
        options: ['1/5', '1/4', '1/3', '2/5', '1/2', '3/5'],
        defaultValue: '1/4',
        label: "Mobile sidebar height ratio",
        sm: 6
    },
    hideFolders: {
        frontend: true,
        type: 'string',
        label: "Hidden folder names (comma or newline separated, supports * ?)",
        placeholder: "cache, .*, private, node_modules, temp",
        defaultValue: "cache, .*, private, node_modules, temp",
        multiline: true,
        sm: 12,
    },
}