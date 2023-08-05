import { createBackup } from "@nora-soderlund/cloudflare-d1-backups";

export default {
    // ideally you'd have it in a CRON, but for the sake of debugging:
    async fetch(request: Request, env: Env, context: ExecutionContext) {
        const result = await createBackup(env.DATABASE, env.BUCKET);

        return Response.json(result);
    }
};
