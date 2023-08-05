export default class WritableMultipartUpload {
    private commands: string = "";
    
    public uploadedParts: R2UploadedPart[] = [];

    constructor(private readonly multipartUpload: R2MultipartUpload, private readonly maxBodySize: number) {
        this.multipartUpload = multipartUpload;
        this.maxBodySize = maxBodySize;
    };

    async append(command: string) {
        if(this.commands.length + command.length >= this.maxBodySize)
            await this.upload();

        this.commands += `${command}\n`;
    };

    async upload() {
        if(!this.commands.length)
            return;

        this.uploadedParts.push(await this.multipartUpload.uploadPart(this.uploadedParts.length + 1, this.commands));

        this.commands = "";
    };
};
