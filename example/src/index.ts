import { createBackup } from "@nora-soderlund/cloudflare-d1-backups";

export default {
    // only use fetch for debugging:
    async fetch(request: Request, env: Env, context: ExecutionContext) {
        const projectName = 'test'; //add your project name here for structure
        const result = await createBackup(env.DATABASE, env.BUCKET, {fileName :`backups/${porjectName}/${timeFormat()}.sql`});

        return Response.json(result);
    }
    async scheduled(request, env, ctx) {
        // add the CRON job in your workers dashboard panel under the "triggers" tab
        const projectName = 'test'; //add your project name here for structure
        const result = await createBackup(env.DATABASE, env.BUCKET, {fileName :`backups/${porjectName}/${timeFormat()}.sql`} );
        
        return Response.json(result);
  }
};
