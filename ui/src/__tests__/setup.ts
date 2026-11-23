// Shared jsdom setup belongs here when a test needs browser polyfills.

// jsdom loads no images, so it has no decode(); every browser the App runs in does.
HTMLImageElement.prototype.decode = () => Promise.resolve();
