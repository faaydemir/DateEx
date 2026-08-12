const fs = require('node:fs')
const path = require('node:path')

const distDir = path.resolve(__dirname, '..', 'dist')
const indexPath = path.join(distDir, 'index.html')

if (!fs.existsSync(indexPath)) {
  throw new Error(`Missing build output: ${indexPath}`)
}

const indexHtml = fs.readFileSync(indexPath)
const extendedDir = path.join(distDir, 'extended')

fs.mkdirSync(extendedDir, { recursive: true })
fs.writeFileSync(path.join(extendedDir, 'index.html'), indexHtml)
fs.writeFileSync(path.join(distDir, '404.html'), indexHtml)
