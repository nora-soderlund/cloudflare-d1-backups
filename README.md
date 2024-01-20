# cloudflare-d1-backups
This is a package based heavily on [sqlite-dump for Python by simonw](https://github.com/simonw/sqlite-dump/blob/main/sqlite_dump/__init__.py) but modified to be suitable for the current state of the open alpha, experimental backend (beta), databases.

See [Cretezy's fork](https://github.com/Cretezy/cloudflare-d1-backup) for a direct D1 HTTP API version.

This script has been tested on a 27mb+ database.

```cmd
npm i @nora-soderlund/cloudflare-d1-backups
```

## Create a backup
Creating a backup creates a SQL file in the destination R2 bucket.

- Install the package: `npm install @nora-soderlund/cloudflare-d1-backups`.
- Call `createBackup(D1Database, R2Bucket, CreateBackupOptions | undefined)` from an execution context.

### CreateBackupOptions
- `fileName`: the file name, or a function that returns a string, for the SQL file in the R2 bucket, default is `backups/${(new Date()).toUTCString()}.sql`.
- `cloudflarePlan`: any of `"Free" | "Pro" | "Business" | "Enterprise"`, this sets the respective `maxBodySize`, defaults to `"Free"` (100 MB).
- `maxBodySize`: the maximum body size for R2 bucket uploads in MB, this depends on your plan, unless you're using Enterprise with a custom size, leave this unset.
- `queryLimit`: the row offset limit for each SELECT query, defaults to 1000. Alter depending on your row size.
- `excludeTablesData`: name of the tables from which you do not want to include data, ['example1'] (Array)

## Restoring a backup
Assuming you've downloaded the backed up SQL file from your R2 bucket: `npx wrangler d1 execute <database> --file=<backup.sql>`

## Example
See /example for an example worker.
