// Manual Jest mock for @anthropic-ai/sdk.
//
// Tests must never call the real Claude API: it costs money, is slow, and
// would make test outcomes depend on model behavior instead of our own
// code. This mock stands in for the `Anthropic` class.
//
// index.js does `const client = new Anthropic()` exactly once, at module
// load time. To let tests control that specific instance's behavior (e.g.
// simulate a malformed response), the mock always returns the SAME
// underlying `messages.create` jest.fn(), regardless of how many times
// `new Anthropic()` is called — a singleton, not a fresh mock per call.

const sharedCreateMock = jest.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'This is a mocked Urvija reply.' }],
});

class Anthropic {
  constructor() {
    this.messages = { create: sharedCreateMock };
  }
}

module.exports = Anthropic;
module.exports.__mockCreate = sharedCreateMock; // exposed so tests can reconfigure it
