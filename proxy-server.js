require("dotenv").config(); // Load .env

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const WebSocket = require("ws");
const axios = require("axios");
const { URL } = require("url");

// Load required env variables
const PORT = process.env.REVERSE_PROXY_PORT || 8888;
const LARAVEL_VERIFY_URL = process.env.LARAVEL_VERIFY_URL;
const OPENSHIFT_VM_CONSOLE_WS_ENDPOINT =
  process.env.OPENSHIFT_VM_CONSOLE_WS_ENDPOINT;

if (!LARAVEL_VERIFY_URL || !OPENSHIFT_VM_CONSOLE_WS_ENDPOINT) {
  console.error("[FATAL] Missing required environment variables.");
  process.exit(1);
}

const wss = new WebSocket.Server({ port: PORT });

console.log(`[INFO] VNC Proxy listening on ws://localhost:${PORT}`);

wss.on("connection", async (clientSocket, req) => {
  const clientIP = req.socket.remoteAddress;
  console.log(`[INFO] New connection from ${clientIP}`);

  const tokenPath = req.url.replace(/^\/vnc-proxy\//, "");
  const token = decodeURIComponent(tokenPath);

  if (!token) {
    console.warn("[WARN] No token provided in URL");
    clientSocket.close(4001, "Missing token");
    return;
  }

  console.log(`[DEBUG] Received token: ${token}`);

  try {
    const response = await axios.post(LARAVEL_VERIFY_URL, { token });
    const { namespace, vm, api_token } = response.data;

    console.log(
      `[INFO] Token validated for VM: ${vm} in namespace: ${namespace}`
    );

    const openshiftUrl = `wss://${OPENSHIFT_VM_CONSOLE_WS_ENDPOINT}/apis/subresources.kubevirt.io/v1/namespaces/${namespace}/virtualmachineinstances/${vm}/vnc`;
    console.log(`[DEBUG] Connecting to OpenShift WebSocket: ${openshiftUrl}`);

    const targetSocket = new WebSocket(openshiftUrl, {
      headers: {
        Authorization: `Bearer ${api_token}`,
      },
    });

    targetSocket.on("open", () => {
      console.log("[INFO] OpenShift WebSocket connection established");

      clientSocket.on("message", (data) => {
        targetSocket.send(data);
      });

      targetSocket.on("message", (data) => {
        clientSocket.send(data);
      });
    });

    targetSocket.on("close", (code, reason) => {
      console.warn(
        `[WARN] OpenShift WebSocket closed. Code: ${code}, Reason: ${reason}`
      );
      clientSocket.close();
    });

    targetSocket.on("error", (error) => {
      console.error("[ERROR] OpenShift WebSocket error:", error.message);
      clientSocket.close();
    });
  } catch (err) {
    if (err.response) {
      console.error(
        "[ERROR] Laravel token verification failed:",
        err.response.data
      );
    } else {
      console.error(
        "[ERROR] Token verification or WebSocket connection failed:",
        err.message
      );
    }
    clientSocket.close(4003, "Unauthorized");
  }
});
