import { createBackup, CreateBackupOptions } from "@nora-soderlund/cloudflare-d1-backups";

export default {
    async fetch(request: Request, env: Env) {
        const options: CreateBackupOptions = {
            fileName: `backups/${(new Date()).toUTCString()}.sql`,
            queryLimit: 1250
        };

        const result = await createBackup(env.DATABASE, env.BUCKET, options);

        const item = await env.BUCKET.get(result.name);

        if(!item) {
            throw new Error("No bucket item found.");
        }

        return new Response(await item.arrayBuffer());
    },

    // or preferably, use a cron trigger defined in your wrangler config or the dashboard
    async scheduled(request: Request, env: Env) {
        const result = await createBackup(env.DATABASE, env.BUCKET);
        
        return Response.json(result);
    }
};
