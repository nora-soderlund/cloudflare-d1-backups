export default class WritableMultipartUpload {
    private commands: string = "";
    
    public uploadedParts: R2UploadedPart[] = [];

    constructor(private readonly multipartUpload: R2MultipartUpload, private readonly maxBodySize: number) {
        this.multipartUpload = multipartUpload;
        this.maxBodySize = maxBodySize;
    };

    async append(command: string) {
        command += '\n';

        this.commands += command;

        if(this.commands.length > this.maxBodySize) {
            const firstSegment = this.commands.substring(0, this.maxBodySize);
            const secondSegment = this.commands.substring(this.maxBodySize);

            await this.upload(firstSegment);

            this.commands = secondSegment;

            return;
        }
    };

    async uploadRemainingPart() {
        const uploadPart = this.uploadedParts.length + 1;
        const commandLength = this.commands.length;
        
        if(commandLength) {
            console.debug(`Uploading remaining part ${uploadPart} (size ${commandLength})`);

            return await this.upload(this.commands);
        }
        else {
            console.debug(`No remaining part to upload (size ${commandLength})`);
        }
    }

    async upload(command: string) {
        if(!command.length)
            return;

        const uploadPart = this.uploadedParts.length + 1;
        const commandLength = command.length;

        console.debug(`Uploading part ${uploadPart} (size ${commandLength})`);

        this.uploadedParts.push(await this.multipartUpload.uploadPart(uploadPart, command));
    };
};
