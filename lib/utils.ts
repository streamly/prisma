import md5 from 'md5'

export function formatUserId(userId: string) {
  return md5(userId) as string
}


export function formatCustomerId(customerId: string) {
  return md5(customerId) as string
}


export function getTodayYYMMDD(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  
  return `${yy}${mm}${dd}`
}