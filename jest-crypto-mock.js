// Mock crypto for Jest testing environment
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: function(array) {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 0xffffffff);
      }
      return array;
    }
  },
  writable: true
});
