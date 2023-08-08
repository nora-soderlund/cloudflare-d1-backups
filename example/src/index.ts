import { createBackup, CreateBackupOptions } from "@nora-soderlund/cloudflare-d1-backups";

export default {
    async fetch(request: Request, env: Env) {
        const options: CreateBackupOptions = {
            fileName: `backups/${(new Date()).toUTCString()}.sql`
        };

        const result = await createBackup(env.DATABASE, env.BUCKET, options);

        return Response.json(result);
    },

    // or preferably, use a cron trigger defined in your wrangler config or the dashboard
    async scheduled(request: Request, env: Env) {
        const result = await createBackup(env.DATABASE, env.BUCKET);
        
        return Response.json(result);
    }
};
