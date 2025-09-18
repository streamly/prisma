import md5 from 'md5'

export function formatUserId(userId) {
  return md5(userId)
}


export function formatCustomerId(customerId) {
  return md5(customerId)
}

