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

export async function createBackup(originDatabase: D1Database, destinationBucket: R2Bucket, options: CreateBackupOptions = {}) {
    const name = (options.fileName)?((typeof options.fileName === "string")?(options.fileName):(options.fileName())):(`backups/${(new Date()).toUTCString()}.sql`);
    const maxBodySize = (options.maxBodySize ?? 64) * 1_000_000;
    const excludeTablesData = options.excludeTablesData ?? [];
    const multipartUpload = await destinationBucket.createMultipartUpload(name);

    try {
        const writableMultipartUpload = new WritableMultipartUpload(multipartUpload, maxBodySize);

        let writableSchema: boolean = false;

        {
            const tables = await originDatabase.prepare("SELECT name, type, sql FROM sqlite_master WHERE sql IS NOT NULL AND type = 'table' ORDER BY rootpage DESC").all<SqliteTableRow>();

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

                    await writableMultipartUpload.append(`INSERT INTO sqlite_master (type, name, tbl_name, rootpage, sql) VALUES ('table', '${tableName}', '${tableName}', 0, '${table.sql.replace(/'/g, "''")}');`);

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

                // Continue if table exists into excludeTablesData array
                if (excludeTablesData.includes(table.name))
                    continue;

                const tableRow = await originDatabase.prepare(`SELECT * FROM "${tableNameIndent}" LIMIT 1`).first();

                if(tableRow) {
                    const columnNames = Object.keys(tableRow);

                    const tableRowCount = await originDatabase.prepare(`SELECT COUNT(*) AS count FROM "${tableNameIndent}"`).first<number>("count");

                    if(tableRowCount === null)
                        throw new Error("Failed to get table row count from table.");

                    const limit = options.queryLimit ?? 1000;

                    for(let offset = 0; offset <= tableRowCount; offset += limit) {
                        const queries = [];

                        // D1 said maximum depth is 20, but the limit is seemingly at 9.
                        for(let index = 0; index < columnNames.length; index += 9) {
                            const currentColumnNames = columnNames.slice(index, Math.min(index + 9, columnNames.length));

                            queries.push(`SELECT '${currentColumnNames.map((columnName) => `'||quote("${columnName.replace('"', '""')}")||'`).join(', ')}' AS partialCommand FROM "${tableNameIndent}" LIMIT ${limit} OFFSET ${offset}`);
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

                                await writableMultipartUpload.append(`INSERT INTO "${tableNameIndent}" (${columnNames.map((columnName) => `"${columnName}"`).join(', ')}) VALUES (${columns.map((column) => column.replace('\n', '\\n')).join(', ')});`);
                            }
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

        await writableMultipartUpload.uploadRemainingPart();

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
