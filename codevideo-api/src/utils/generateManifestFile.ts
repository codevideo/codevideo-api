import { IAction, ICodeVideoManifest } from "@fullstackcraftllc/codevideo-types";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { generateAudioItems } from "./generateAudioItems.js";
  
export const generateManifestFile = async (dirname: string, actions: Array<IAction>, userId: string) => {
    const uuid = uuidv4();

    // generate mp3s for each action
    const audioItems = await generateAudioItems(actions);

    // create manifest. We write an actions-based manifest (the render path the
    // CLI + example v3 page already consume): a course/lesson payload is
    // flattened to actions upstream in resolveProjectActions. currentLessonIndex
    // is required by the type but inert for an actions stream (the component
    // only uses it to pick a lesson out of a course), so 0 is a safe default.
    const manifest: ICodeVideoManifest = {
        environment: process.env.ENVIRONMENT || "production",
        userId,
        uuid,
        actions,
        currentLessonIndex: 0,
        audioItems
    }

    // write the manifest to the tmp/v3/new folder using the uuid as the filename
    fs.writeFileSync(path.join(dirname, "..", "tmp", "v3", "new", `${uuid}.json`), JSON.stringify(manifest));
}