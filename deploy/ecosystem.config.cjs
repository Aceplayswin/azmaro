/**
 * PM2 process list for production.
 * Every path goes through the `current` symlink, so `pm2 reload` starts the release
 * deploy.sh just switched to. Ports must match deploy/config.sh and the nginx sites.
 */
const APP_DIR = "/var/www/azmaro";
const CURRENT = `${APP_DIR}/current`;

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
  cwd: `${CURRENT}/${dir}`,
  script: `${CURRENT}/${dir}/node_modules/next/dist/bin/next`,
  args: `start -p ${port} -H 127.0.0.1`,
  max_memory_restart: memory,
  env: { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
});

module.exports = {
  apps: [
    {
      ...common,
      name: "azmaro-api",
      cwd: `${CURRENT}/API`, // API/.env is loaded from the working directory
      script: `${CURRENT}/API/dist/src/server.js`,
      max_memory_restart: "350M",
      env: {
        NODE_ENV: "production",
        // Admin photo uploads land outside the release so they survive deploys.
        WEB_PUBLIC_DIR: `${APP_DIR}/shared/public`,
      },
    },
    nextApp("azmaro-web", "web", 3000, "500M"),
    nextApp("azmaro-admin", "Admin", 3001, "350M"),
  ],
};
