export function initAuthUi() {
  $(document).on('click', '.logout', async function (e) {
    e.preventDefault()

    try {
      await cookieStore.delete('uid', { path: '/' })
      await cookieStore.delete('apiKey', { path: '/' })
      await cookieStore.delete('user_cus', { path: '/' })
    } catch (error) {
      console.error('Error removing cookies', error)
    }

    await Clerk.signOut({ redirectUrl: '/dev' })
  })
}