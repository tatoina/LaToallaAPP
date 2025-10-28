// sencillo registro del service worker ubicado en /service-worker.js
export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = '/service-worker.js';
      navigator.serviceWorker.register(swUrl)
        .then(reg => {
          console.log('Service worker registered:', reg);
        })
        .catch(err => {
          console.warn('Service worker registration failed:', err);
        });
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(r => r.unregister());
    });
  }
}