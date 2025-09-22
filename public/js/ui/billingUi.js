import { fetchCheckoutUrl, fetchCustomerPortalUrl } from '../api.js'

export function initBillingUi() {
  $(document).on("click", ".billing", async function () {
    const customerId = (await window.cookieStore.get('user_cus'))?.value

    try {
      const result = await (customerId ? fetchCustomerPortalUrl() : fetchCheckoutUrl())

      if (!result.url) {
        throw new Error('Failed to get redirect url')
      }

      window.location.href = result.url
    } catch (error) {
      console.error('Error fetching billing url', error)
      alert('Error:', error.message || 'Error fetching billing information')
    }
  })
}