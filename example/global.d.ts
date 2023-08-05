declare type Env = {
    DATABASE: D1Database;
    BUCKET: R2Bucket;

    ENVIRONMENT: "production" | "staging";
};
