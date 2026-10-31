# Security policy

## Supported version

Security fixes are applied to the latest version on the default development branch.

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose provider tokens, database credentials, or stored searches. Use GitHub's private vulnerability reporting and include reproduction steps, the affected endpoint, and expected impact.

## Security boundaries

- Keep Apify, OpenAI, and database credentials in server-side environment variables.
- Prefer the configured server-side Apify token over browser entry.
- Keep request validation and body-size limits enabled.
- Add authentication and tenant isolation before storing searches for multiple users.
