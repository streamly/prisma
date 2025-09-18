export class EventHub {
  constructor() {
    this.events = {}
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  off(event, callback) {
    if (!this.events[event]) return
    this.events[event] = this.events[event].filter(cb => cb !== callback)
  }

  emit(event, data) {
    if (!this.events[event]) return
    this.events[event].forEach(callback => callback(data))
  }
}


export const eventHub = new EventHub()


export const EVENTS = {
  THUMBNAIL_UPLOADED: "thumbnail.uploaded"
}