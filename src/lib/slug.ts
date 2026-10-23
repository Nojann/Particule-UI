/** "Énergie cinétique !" → "energie-cinetique" */
export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 255)
}

export const PERMALINK_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Plain-text preview of Markdown content, for lists */
export function excerpt(markdown: string, length = 120) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) → text
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^[ \t]{0,3}(#{1,6}|>|[-*+]|\d+\.)[ \t]+/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text
}
