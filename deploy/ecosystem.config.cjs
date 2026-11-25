/**
 * PM2 process list for production (/var/www/azmaro).
 * Ports must match deploy/config.sh and deploy/nginx/azmaro.conf.
 */
const APP_DIR = "/var/www/azmaro";

const common = {
  exec_mode: "fork",
  instances: 1,
  autorestart: true,
  time: true, // timestamps in `pm2 logs`
  kill_timeout: 12000,
};

const nextApp = (name, dir, port, memory) => ({
  ...common,
  name,
  cwd: `${APP_DIR}/${dir}`,
  script: `${APP_DIR}/${dir}/node_modules/next/dist/bin/next`,
  args: `start -p ${port} -H 127.0.0.1`,
  max_memory_restart: memory,
  env: { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
});

module.exports = {
  apps: [
    {
      ...common,
      name: "azmaro-api",
      cwd: `${APP_DIR}/API`, // API/.env is loaded from the working directory
      script: `${APP_DIR}/API/dist/src/server.js`,
      max_memory_restart: "350M",
      env: {
        NODE_ENV: "production",
        // Admin photo uploads are written to web/public/images/products.
        WEB_PUBLIC_DIR: `${APP_DIR}/web/public`,
      },
    },
    nextApp("azmaro-web", "web", 3000, "500M"),
    nextApp("azmaro-admin", "Admin", 3001, "350M"),
  ],
};
