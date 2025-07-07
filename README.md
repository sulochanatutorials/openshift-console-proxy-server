# VNC WebSocket Reverse Proxy

A lightweight Node.js-based WebSocket proxy that authenticates VNC access to OpenShift virtual machines via Laravel API token verification.

---

## 🚀 Features

- Secure token-based access to VM VNC consoles
- Laravel API integration for token verification
- Bi-directional WebSocket relay to OpenShift noVNC endpoint
- Environment-based configuration
- Simple and minimal — no heavy dependencies

---

## 📦 Requirements

- Node.js v18+
- Laravel backend with `/api/verify-vnc-token` endpoint
- KubeVirt / OpenShift environment with VM console enabled

---

## ⚙️ Setup

### 1. Clone the Repository

```bash
git clone https://github.com/sulochanatutorials/openshift-console-proxy-server.git
cd openshift-console-proxy-server
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a .env file from the provided example:

```bash
cp .env.example .env
```

Edit the .env and set the following variables:

```env
REVERSE_PROXY_PORT=8888
LARAVEL_VERIFY_URL=http://your-api-host/api/verify-vnc-token
OPENSHIFT_VM_CONSOLE_WS_ENDPOINT=api.openshift.domain:6443
```

### 4. ▶️ Run the Proxy Server

```bash
node proxy-server.js
```

---

## 🔐 Token Authentication Flow

1.  The client connects to:  
    `ws://<your-proxy-host>:8888/vnc-proxy/<vnc-access-token>`
2.  The proxy validates the token via:

    ```
    POST <LARAVEL_VERIFY_URL>
    {
      "token": "<vnc-access-token>"
    }

    ```

3.  Laravel responds with:

    ```json
    {
      "namespace": "your-namespace",
      "vm": "your-vm-name",
      "api_token": "k8s-api-access-token"
    }
    ```

4.  The proxy opens a WebSocket connection to OpenShift's VNC console and relays traffic.

---

## 🛡️ Security Notes

- TLS certificate validation is **disabled** by default (`NODE_TLS_REJECT_UNAUTHORIZED=0`) for internal cluster access. **Use with caution in production.**
- Protect this proxy behind a secure reverse proxy like NGINX with HTTPS and rate limiting.

---

## 📁 File Structure

```
.
├── .env.example
├── proxy-server.js
├── package.json
└── README.md

```

---

## 📄 License

MIT License — feel free to use, modify, and distribute.

---
