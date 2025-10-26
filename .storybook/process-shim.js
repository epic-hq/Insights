export const process = {
  env: {
    NODE_ENV: 'development',
    NODE_DEBUG: false,
  },
  version: 'v16.0.0',
  versions: { node: '16.0.0' },
  platform: 'browser',
  nextTick: (callback) => setTimeout(callback, 0),
};