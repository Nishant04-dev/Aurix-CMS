module.exports = {
  apps: [
    {
      name: 'aurix-backend',
      script: 'src/index.js',
      cwd: '/path/to/backend',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--experimental-vm-modules',
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
        PORT: 25569,
        HOST: '0.0.0.0',
      },
      // Restart on crash, max 10 restarts in 1 minute
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 2000,
      // Logging
      out_file: '/path/to/logs/aurix-out.log',
      error_file: '/path/to/logs/aurix-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Memory limit — restart if over 512MB
      max_memory_restart: '512M',
    },
  ],
};
