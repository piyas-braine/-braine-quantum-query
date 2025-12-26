# createHttpClient

Creates a fully-typed HTTP client with built-in deduplication, retries, and auth handling.

```tsx
const client = createHttpClient(config)
```

## Config Options

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **`baseURL`** | \`string\` | - | Root URL for requests. |
| **`timeout`** | \`number\` | \`10000\` | Timeout in ms. |
| **`headers`** | \`object\` | - | Default headers. |
| **`retry`** | \`number \| object\` | - | Retry logic configuration. |
| **`auth`** | \`AuthConfig\` | - | Token management logic. |

### AuthConfig
| Property | Type | Description |
| :--- | :--- | :--- |
| **`getToken`** | \`() => string \| Promise&lt;string&gt;\` | Function to retrieve the token (e.g., from localStorage). |
| **`onTokenExpired`** | \`() => Promise&lt;string&gt;\` | Function called on 401. Should refresh token and return new one. |
| **`onAuthFailed`** | \`() => void\` | Called if refresh fails. |

## Methods

- **`get&lt;T&gt;(url, config)`**
- **`post&lt;T&gt;(url, data, config)`**
- **`put&lt;T&gt;(url, data, config)`**
- **`delete&lt;T&gt;(url, config)`**
- **`patch&lt;T&gt;(url, data, config)`**

## Deduplication
GET requests to the same URL with the same parameters are automatically deduplicated if they happen simultaneously.
