import { createBackup } from "@nora-soderlund/cloudflare-d1-backups";

export default {
    async fetch(request: Request, env: Env, context: ExecutionContext) {
        const result = await createBackup(env.DATABASE, env.BUCKET);

        return Response.json(result);
    }
};
