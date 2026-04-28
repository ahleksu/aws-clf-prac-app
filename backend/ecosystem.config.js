module.exports = {
  apps: [
    {
      name: 'live-quiz-backend',
      script: './dist/index.js',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
