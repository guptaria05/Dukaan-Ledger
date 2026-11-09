# Privacy and data handling

The application now supports an account-authenticated API and a PostgreSQL shop-data document scoped by the authenticated user. A browser-local legacy data document is offered for explicit import when an account has no cloud data. The browser also keeps an account-specific cache for the dashboard.

Anyone with access to the same browser profile may be able to access its saved shop data. Clearing browser data can remove the records. Users should not enter highly sensitive information and should not rely on this prototype as their only financial record until export, backup and recovery are implemented.

Before production use, configure HTTPS and a private managed database, establish tested backups and recovery, publish retention/deletion policies, add account recovery and complete security testing. Google sign-in must only be enabled with a correctly configured OAuth Web client.
