import { IAction, ICodeVideoManifest } from "@fullstackcraftllc/codevideo-types";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { generateAudioItems } from "./generateAudioItems.js";
  
export const generateManifestFile = async (dirname: string, actions: Array<IAction>, userId: string) => {
    const uuid = uuidv4();

    // generate mp3s for each action
    const audioItems = await generateAudioItems(actions);

    // create manifest
    const manifest: ICodeVideoManifest = {
        environment: process.env.ENVIRONMENT || "production",
        userId,
        uuid,
        actions,
        audioItems
    }

    // write the manifest to the tmp/v3/new folder using the uuid as the filename
    fs.writeFileSync(path.join(dirname, "..", "tmp", "v3", "new", `${uuid}.json`), JSON.stringify(manifest));
}