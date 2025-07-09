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

## 🔐 AES-GCM Token Encryption Support (Laravel + Node.js)

This proxy now supports **secure AES-256-GCM encryption** for API tokens, allowing `api_token` returned by Laravel to be safely decrypted and used in Node.js.

### ✅ Laravel Side

The Laravel API encrypts the `api_token` using AES-GCM format before returning:

```php
return response()->json([
    'namespace' => $namespace,
    'vm' => $vm->vm_id,
    'api_token' => encryptApiTokenGCM($kubeApiToken)  // Encrypted token
]);
```

This `encryptApiTokenGCM()` method generates output in the format:

```
base64(iv):base64(cipherText):base64(tag)
```

Make sure the encryption key is stored in Laravel’s `.env`:

```env
VNC_API_ENCRYPTION_KEY=3X1UluR5cyQ57RCZcmCbiTscm8DihRqpiO2LWMDeBNw=
```

And referenced in `config/app.php`:

```php
'VNC_API_ENCRYPTION_KEY' => env('VNC_API_ENCRYPTION_KEY'),
```

---

### ✅ Node.js Side

The proxy uses Web Crypto API to decrypt the token. To enable this, Node.js `crypto.webcrypto` is used.

Make sure your environment uses **Node.js v16+**.

In `proxy-server.js`, this is added:

```js
const { webcrypto } = require("crypto");
const crypto = webcrypto;
```

Also, include this in `.env`:

```env
VNC_API_ENCRYPTION_KEY=base64
```

---

### ⚠️ Compatibility Notes

- Laravel's built-in `Crypt::encryptString()` is **not** compatible with JavaScript Web Crypto API.
- Use **manual AES-GCM encryption** on the Laravel side to ensure token decryptability in the proxy.

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
