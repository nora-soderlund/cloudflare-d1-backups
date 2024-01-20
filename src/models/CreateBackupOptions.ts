export type CreateBackupOptions = {
    fileName?: string | (() => string);

    maxBodySize?: number;

    queryLimit?: number;

    excludeTablesData?: Array<string>;
};
