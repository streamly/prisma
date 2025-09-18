/**
 * Show a loader in a container.
 * @param {HTMLElement} container - The element where loader will be injected.
 * @param {Object} options - Optional loader settings.
 * @param {string} options.text - Loading text (default: "Loading...").
 * @param {number} options.size - Spinner size in px (default: 50).
 * @param {string} options.color - Spinner color (default: "#3498db").
 */
export function showLoader(container, options = {}) {
  const { text = "Loading...", size = 50, color = "#3498db" } = options

  // Remove any existing loader
  hideLoader(container)

  const wrapper = document.createElement('div')
  wrapper.className = 'generic-loader-wrapper'
  wrapper.style.height = '100%' 
  wrapper.style.width = '100%'
  wrapper.style.display = 'flex'
  wrapper.style.flexDirection = 'column'
  wrapper.style.alignItems = 'center'
  wrapper.style.justifyContent = 'center'

  const spinner = document.createElement('div')
  spinner.className = 'generic-loader-spinner'
  spinner.style.border = `${Math.round(size / 10)}px solid #f3f3f3`
  spinner.style.borderTop = `${Math.round(size / 10)}px solid ${color}`
  spinner.style.borderRadius = '50%'
  spinner.style.width = `${size}px`
  spinner.style.height = `${size}px`
  spinner.style.animation = 'generic-spin 1s linear infinite'
  spinner.style.marginBottom = '10px'

  const textEl = document.createElement('div')
  textEl.className = 'generic-loader-text'
  textEl.textContent = text
  textEl.style.fontSize = '14px'
  textEl.style.color = '#333'

  wrapper.appendChild(spinner)
  wrapper.appendChild(textEl)
  container.appendChild(wrapper)
}

/**
 * Remove loader from container.
 * @param {HTMLElement} container 
 */
export function hideLoader(container) {
  const loader = container.querySelector('.generic-loader-wrapper')
  if (loader) container.removeChild(loader)
}