import { v4 as uuidv4 } from 'uuid'

export function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return ''  // SSR 保护
  let id = localStorage.getItem('playerId')
  if (!id) {
    id = uuidv4()
    localStorage.setItem('playerId', id)
  }
  return id
}
