module.exports = {
  apps: [
    {
      name: 'sub-server-0',
      script: './server.js',
      watch: ['utils', 'routes', 'controllers', 'models', 'modules'],
      // Delay between restart
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'videos/', '\\.git', '*.log'],
    },
    {
      name: 'backend',
      script: './server.js',
      watch: ['utils', 'routes', 'controllers', 'models', 'modules'],
      // Delay between restart
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'videos/', '\\.git', '*.log'],
    },
  ],
};
