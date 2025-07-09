require("dotenv").config(); // Load .env

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
// Add this 👇
const { webcrypto } = require("crypto");
const crypto = webcrypto;

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
async function decryptApiToken(encrypted, base64Key) {
  const [ivB64, cipherB64, tagB64] = encrypted.split(":");
  const iv = base64ToArrayBuffer(ivB64);
  const cipherText = base64ToArrayBuffer(cipherB64);
  const tag = base64ToArrayBuffer(tagB64);

  const keyRaw = base64ToArrayBuffer(base64Key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const combined = new Uint8Array(cipherText.byteLength + tag.byteLength);
  combined.set(new Uint8Array(cipherText), 0);
  combined.set(new Uint8Array(tag), cipherText.byteLength);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    cryptoKey,
    combined
  );

  return new TextDecoder().decode(decrypted);
}

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

  console.warn("[WARN] Request Object", req);

  const parsedUrl = new URL(req.url, `ws://${req.headers.host}`);

  // Extract token from the pathname
  const tokenPath = parsedUrl.pathname.replace(/^\/vnc-proxy\//, "");
  const token = decodeURIComponent(tokenPath);

  // Extract password from query string
  const password = parsedUrl.searchParams.get("password");

  console.log(`[DEBUG] Received token: ${token}`);
  console.log(`[DEBUG] Received password: ${password}`);

  if (!token) {
    console.warn("[WARN] No token provided in URL");
    clientSocket.close(4001, "Missing token");
    return;
  }

  console.log(`[DEBUG] Received token: ${token}`);

  try {
    const response = await axios.post(
      LARAVEL_VERIFY_URL,
      { token }, // only token in body
      {
        headers: {
          Authorization: `Bearer ${password}`,
        },
      }
    );

    const { namespace, vm, api_token } = response.data;

    const sharedKey = process.env.VNC_API_ENCRYPTION_KEY.replaceAll("", "");
    const apiToken = await decryptApiToken(api_token, sharedKey);

    console.log(`[INFO] decrypted token:${apiToken}`);

    const openshiftUrl = `wss://${OPENSHIFT_VM_CONSOLE_WS_ENDPOINT}/apis/subresources.kubevirt.io/v1/namespaces/${namespace}/virtualmachineinstances/${vm}/vnc`;
    console.log(`[DEBUG] Connecting to OpenShift WebSocket: ${openshiftUrl}`);

    const targetSocket = new WebSocket(openshiftUrl, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
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
