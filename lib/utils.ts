import md5 from 'md5'

export function formatUserId(userId: string) {
  return md5(userId) as string
}


export function formatCustomerId(customerId: string) {
  return md5(customerId) as string
}

