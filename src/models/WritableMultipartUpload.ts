export default class WritableMultipartUpload {
    private commands = "";
    
    public uploadedParts: R2UploadedPart[] = [];

    constructor(private readonly multipartUpload: R2MultipartUpload, private readonly maxBodySize: number) {
        this.multipartUpload = multipartUpload;
        this.maxBodySize = maxBodySize;
    };

    async append(command: string) {
        this.commands += command;
        this.commands += '\n';

        if(this.commands.length > this.maxBodySize) {
            const encodedCommands = new TextEncoder().encode(this.commands);

            const firstSegment = encodedCommands.slice(0, this.maxBodySize);
            const secondSegment = new TextDecoder().decode(encodedCommands.slice(this.maxBodySize));

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

            return await this.upload(new TextEncoder().encode(this.commands));
        }
        else {
            console.debug(`No remaining part to upload (size ${commandLength})`);
        }
    }

    async upload(command: Uint8Array) {
        if(!command.length)
            return;

        const uploadPart = this.uploadedParts.length + 1;

        console.debug(`Uploading part ${uploadPart} (size ${command.byteLength})`);

        this.uploadedParts.push(await this.multipartUpload.uploadPart(uploadPart, command));
    };
};
