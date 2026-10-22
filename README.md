# THM Vault
Study vault for TryHackMe lessons. Cloudflare Worker + KV, protected by a password.

- `worker.js`: the whole app.
- `wrangler.jsonc`: replace `PUT_YOUR_KV_NAMESPACE_ID_HERE` with your KV namespace ID.
- Secret `PASSWORD`: set it in Cloudflare (Worker > Settings > Variables and Secrets). Never commit it.
