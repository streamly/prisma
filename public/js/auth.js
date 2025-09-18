/// <reference types="@clerk/types" />


export async function ensureAuth() {
  await Clerk.load()

  if (!Clerk.user) {
    Clerk.redirectToSignIn({ redirectUrl: '/dev/auth/' })
    return false
  }

  return true
}


export async function getClerkToken() {
  await Clerk.load()

  if (!Clerk.user) {
    throw new Error('User is not authenticated')
  }

  return Clerk.session.getToken()
}


export async function logout() {
  await Clerk.load()

  if (!Clerk.user) {
    throw new Error('User is not authenticated')
  }

  await cookieStore.delete('uid', { path: '/' })
  await cookieStore.delete('apiKey', { path: '/' })
  await cookieStore.delete('cus', { path: '/' })

  await Clerk.signOut({ redirectUrl: '/dev' })
}