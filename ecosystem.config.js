module.exports = {
  apps: [
    {
      name: "principal-report",
      script: "server.js",
      cwd: "/home/akbgroups/public_html/principal-report.akbgroups.com",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3022,
        DB_HOST: "localhost",
        DB_PORT: 3306,
        DB_USER: "akbgroups_user",
        DB_PASSWORD: "bka@6202#db",
        DB_NAME: "akbgroups_principal_report",
        SECURE_COOKIE: "1",
      },
    },
  ],
};
