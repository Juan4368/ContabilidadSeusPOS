const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const renderMarkdown = (markdown: string): string => {
  const limpio = escapeHtml(markdown)

  const conEnlaces = limpio.replace(
    /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  )

  const conNegritas = conEnlaces
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')

  const conCursivas = conNegritas
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')

  const conCodigo = conCursivas.replace(/`([^`]+)`/g, '<code>$1</code>')

  return conCodigo.replace(/\r?\n/g, '<br />')
}
