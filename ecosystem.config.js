module.exports = {
  apps: [
    {
      name: 'sindhuja-fin-backend',
      script: 'index.js',
      cwd: './backend',
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 5007
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true
    }
  ]
};
