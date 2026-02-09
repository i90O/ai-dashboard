// PM2 Ecosystem Config - All Workers
// Usage: pm2 start workers/ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'mission-worker',
      script: 'workers/mission-worker.mjs',
      cwd: process.env.PWD || '.',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        AGENT_ID: 'xiaobei'
      },
      error_file: 'logs/mission-worker-error.log',
      out_file: 'logs/mission-worker-out.log',
      time: true
    },
    {
      name: 'roundtable-worker',
      script: 'workers/roundtable-worker.mjs',
      cwd: process.env.PWD || '.',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      },
      error_file: 'logs/roundtable-worker-error.log',
      out_file: 'logs/roundtable-worker-out.log',
      time: true
    },
    {
      name: 'initiative-worker',
      script: 'workers/initiative-worker.mjs',
      cwd: process.env.PWD || '.',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      },
      error_file: 'logs/initiative-worker-error.log',
      out_file: 'logs/initiative-worker-out.log',
      time: true
    }
  ]
};
