/* eslint-disable no-undef */
// Fallback to native DOMException available in Node 18+ and browsers
module.exports = globalThis.DOMException || class DOMException extends Error {
  constructor(message, name) {
    super(message);
    this.name = name || 'DOMException';
  }
};
