module.exports = {
  apps: [
    {
      name: "vnc-proxy",
      script: "proxy.js",
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
