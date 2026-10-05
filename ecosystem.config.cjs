module.exports = {
  apps: [
    {
      name: 'azkahps-api',
      script: 'src/server.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '250M',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        HOST: '0.0.0.0'
      }
    }
  ]
};
