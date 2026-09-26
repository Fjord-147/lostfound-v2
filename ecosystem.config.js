module.exports = {
  apps: [
    {
      name: "lostfound-api",
      cwd: "/opt/lostfound-v2/apps/api",
      script: "dist/index.js",
      env: { NODE_ENV: "production" },
      out_file: "/opt/lostfound-v2/logs/api.log",
      error_file: "/opt/lostfound-v2/logs/api.log",
      time: true,
    },
    {
      name: "lostfound-web",
      cwd: "/opt/lostfound-v2/apps/web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3002",
      env: { NODE_ENV: "production" },
      out_file: "/opt/lostfound-v2/logs/web.log",
      error_file: "/opt/lostfound-v2/logs/web.log",
      time: true,
    },
  ],
};
