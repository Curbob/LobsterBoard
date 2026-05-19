const {
  fetchWithCache,
  fetchClaudeUsage
} = require('../../server/ai-providers.cjs');

module.exports = function() {
  return {
    routes: {
      'GET /usage': async () => {
        const usage = await fetchWithCache('claude', fetchClaudeUsage);
        return {
          status: usage.error ? 'error' : 'ok',
          ...usage
        };
      }
    }
  };
};
