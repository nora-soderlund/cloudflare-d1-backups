import { CloudflarePlans } from "./CloudflarePlans";

export type CreateBackupOptions = {
    fileName?: string | (() => string);

    maxBodySize?: number;
    cloudflarePlan?: CloudflarePlans;
};
