import { cloudflarePlanLimits } from "../models/CloudflarePlanLimits";
import { CreateBackupOptions } from "../models/CreateBackupOptions";
import WritableMultipartUpload from "../models/WritableMultipartUpload";

type SqliteTableRow = {
    name: string;
    type: string;
    sql: string;
};

type SqliteTableInfoRow = {
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value?: string;
    pk: number;
};

/**
 * Returns a formatted date string based on the current time.
 * @param option - A boolean value indicating whether to use local time AM/PM (true) or UTC time (false).
 * @returns A formatted date string.
 */
export function timeFormat(option: boolean){
    if(option === true){
        return new Date().toLocaleString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZoneName: 'short' }).replace(/,\s(\w+)\s(\d{2}),\s(\d{4}),\s/, ', $2 $1 $3 ').replace(/:\s/g, ':').replace(/\s(AM|PM)/, '$1');
    } else {
        return (new Date()).toUTCString();
    }
}
export async function createBackup(originDatabase: D1Database, destinationBucket: R2Bucket, options: CreateBackupOptions = {}) {
    const defaultOptions = { hourFormat: false };
    const mergedOptions = { ...defaultOptions, ...options };

    let date = timeFormat(false);
    if(mergedOptions.hourFormat){
        date = timeFormat(true);
    }

    const name = options.fileName ?? `backups/${date}.sql`;
    const maxBodySize = (options.maxBodySize ?? cloudflarePlanLimits[options.cloudflarePlan ?? "Free"]) * 131072;

    const multipartUpload = await destinationBucket.createMultipartUpload(name);

    try {
        const writableMultipartUpload = new WritableMultipartUpload(multipartUpload, maxBodySize);

        let writableSchema: boolean = false;

        {
            const tables = await originDatabase.prepare("SELECT name, type, sql FROM sqlite_master WHERE sql IS NOT NULL AND type = 'table' ORDER BY name").all<SqliteTableRow>();

            for(let table of tables.results) {
                if(table.name.startsWith("_cf_"))
                    continue; // we're not allowed access to these
                else if(table.name === "sqlite_sequence")
                    await writableMultipartUpload.append("DELETE FROM sqlite_sequence;");
                else if(table.name === "sqlite_stat1")
                    await writableMultipartUpload.append("ANALYZE sqlite_master;");
                else if(table.name.startsWith("sqlite_"))
                    continue;
                else if(table.sql.startsWith("CREATE VIRTUAL TABLE")) {
                    if(!writableSchema) {
                        await writableMultipartUpload.append("PRAGMA writable_schema=ON;");

                        writableSchema = true;
                    }

                    const tableName = table.name.replace("'", "''");

                    await writableMultipartUpload.append(`INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('table', '${tableName}', '${tableName}', 0, '${table.sql}');`);

                    continue;
                }
                else if(table.sql.toUpperCase().startsWith("CREATE TABLE "))
                    await writableMultipartUpload.append(`CREATE TABLE IF NOT EXISTS ${table.sql.substring("CREATE TABLE".length)};`);
                else
                    await writableMultipartUpload.append(`${table.sql};`);

                const tableNameIndent = table.name.replace('"', '""');

                // PRAGMA table_info is returning unauthorized on experimental D1 backend

                //const tableInfo = await originDatabase.prepare(`PRAGMA table_info("${tableNameIndent}")`).all<SqliteTableInfoRow>();
                //const columnNames = tableInfo.results.map((row) => row.name);

                const tableRow = await originDatabase.prepare(`SELECT * FROM "${tableNameIndent}" LIMIT 1`).first();

                if(tableRow) {
                    const columnNames = Object.keys(tableRow);
                    
                    const queries = [];

                    // D1 said maximum depth is 20, but the limit is seemingly at 9.
                    for(let index = 0; index < columnNames.length; index += 9) {
                        const currentColumnNames = columnNames.slice(index, Math.min(index + 9, columnNames.length));

                        queries.push(`SELECT '${currentColumnNames.map((columnName) => `'||quote("${columnName.replace('"', '""')}")||'`).join(', ')}' AS partialCommand FROM "${tableNameIndent}"`);
                    }

                    const results = await originDatabase.batch<{ partialCommand: string; }>(queries.map((query) => originDatabase.prepare(query)));

                    if(results.length && results[0].results.length) {
                        for(let result = 1; result < results.length; result++) {
                            if(results[result].results.length !== results[0].results.length)
                                throw new Error("Failed to split expression tree into several queries properly.")
                        }

                        for(let row = 0; row < results[0].results.length; row++) {
                            let columns = [];
                            
                            for(let result = 0; result < results.length; result++)
                                columns.push(results[result].results[row].partialCommand);

                            await writableMultipartUpload.append(`INSERT INTO "${tableNameIndent}" (${columnNames.map((columnName) => `"${columnName}"`).join(', ')}) VALUES (${columns.join(', ')});`);
                        }
                    }
                }
            }
        }
        
        {
            const schemas = await originDatabase.prepare("SELECT name, type, sql FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('index', 'trigger', 'view')").all<SqliteTableRow>();

            if(schemas.results.length) {
                for(let schema of schemas.results)
                    await writableMultipartUpload.append(`${schema.sql};`);
            }
        }

        if(writableSchema)
            await writableMultipartUpload.append("PRAGMA writable_schema=OFF;");

        await writableMultipartUpload.upload();

        await multipartUpload.complete(writableMultipartUpload.uploadedParts);

        return {
            name,

            uploadId: multipartUpload.uploadId,
            uploadedParts: writableMultipartUpload.uploadedParts
        };
    }
    catch(error) {
        await multipartUpload.abort();

        throw error;
    }
};
