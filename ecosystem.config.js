module.exports = {
  apps: [
    {
      name: "vnc-proxy",
      script: "proxy-server.js",
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
