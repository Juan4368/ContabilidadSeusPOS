const UTC_MINUS_5_MS = 5 * 60 * 60000

export const toUTCMinus5Iso = (date: Date) => new Date(date.getTime() - UTC_MINUS_5_MS).toISOString()

export const nowUTCMinus5Iso = () => toUTCMinus5Iso(new Date())

export const toLocalInputUTCMinus5 = (date: Date) => {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000
  const utcMinus5 = new Date(utcMs - UTC_MINUS_5_MS)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${utcMinus5.getFullYear()}-${pad(utcMinus5.getMonth() + 1)}-${pad(utcMinus5.getDate())}T${pad(
    utcMinus5.getHours()
  )}:${pad(utcMinus5.getMinutes())}`
}

export const fromLocalInputToUTCMinus5Iso = (value: string) => {
  if (!value) return nowUTCMinus5Iso()
  const normalizada = value.length === 16 ? `${value}:00` : value
  const dt = new Date(normalizada)
  if (Number.isNaN(dt.getTime())) return nowUTCMinus5Iso()
  return toUTCMinus5Iso(dt)
}
