import { CloudflarePlans } from "./CloudflarePlans";

export type CreateBackupOptions = {
    hourFormat?: boolean;
    fileName?: string;

    maxBodySize?: number;
    cloudflarePlan?: CloudflarePlans;
};
