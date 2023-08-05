import { CloudflarePlans } from "./CloudflarePlans";

export type CreateBackupOptions = {
    fileName?: string;

    maxBodySize?: number;
    cloudflarePlan?: CloudflarePlans;
};
