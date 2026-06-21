import fs from "fs"
import { v4 as uuidv4 } from "uuid";
import { uploadFileToS3 } from "./utils/uploadFileToS3.js"
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const main = async () => {
    // read video/tmp.mp4 file with fs
    const videoBuffer = fs.readFileSync('./tmp/video/tmp.mp4');
    const filename = `${uuidv4()}.mp4`;
    await uploadFileToS3(videoBuffer, filename)
}

main()