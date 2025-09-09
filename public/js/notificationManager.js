// Notification management functionality
export class NotificationManager {
  constructor() {
    this.container = null;
  }

  // Create notification container if it doesn't exist
  createContainer() {
    let container = document.getElementById('notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      container.style.position = 'fixed';
      container.style.top = '20px';
      container.style.right = '20px';
      container.style.zIndex = '1000';
      document.body.appendChild(container);
    }
    this.container = container;
    return container;
  }

  // Show notification
  showNotification(message, type = 'info') {
    // Create notification container if it doesn't exist
    this.createContainer();
    
    // Create notification element
    const notification = document.createElement('div');
    notification.style.backgroundColor = type === 'error' ? '#f8d7da' : 
                                       type === 'success' ? '#d4edda' : 
                                       '#cce5ff';
    notification.style.color = type === 'error' ? '#721c24' : 
                             type === 'success' ? '#155724' : 
                             '#004085';
    notification.style.padding = '10px 15px';
    notification.style.marginBottom = '10px';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    notification.style.transition = 'all 0.3s ease';
    notification.textContent = message;
    
    // Add to container
    this.container.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

