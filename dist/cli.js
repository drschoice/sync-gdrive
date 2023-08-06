#! /usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const fs_1 = __importDefault(require("fs"));
const _1 = __importDefault(require("./"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let okay = true;
            const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
            if (!clientEmail) {
                console.log('No client email specified. Be sure to set GOOGLE_CLIENT_EMAIL env variable.');
                okay = false;
            }
            let privateKey = process.env.GOOGLE_PRIVATE_KEY;
            if (!privateKey) {
                console.log('No Google API private key specified. Be sure to set GOOGLE_PRIVATE_KEY env variable.');
                okay = false;
            }
            if (!okay) {
                process.exit(1);
            }
            // Unescape new lines
            privateKey = privateKey.replace(/\\n/g, '\n');
            console.log('>>', clientEmail);
            console.log('>>', privateKey);
            if (process.argv.length < 4) {
                console.log('usage: sync-gdrive <drive_file_folder_id> <dest_path>');
                process.exit(1);
            }
            const fileFolderId = process.argv[2];
            const destFolder = process.argv[3];
            try {
                fs_1.default.accessSync(destFolder, fs_1.default.constants.R_OK | fs_1.default.constants.W_OK);
            }
            catch (error) {
                console.log(`Destination folder '${destFolder}' does not exist or is not writable by current user`);
                process.exit(1);
            }
            const keyConfig = {
                clientEmail: clientEmail,
                privateKey: privateKey
            };
            console.log(`Syncing Google Drive file/folder of id '${fileFolderId}' to '${destFolder}'`);
            yield (0, _1.default)(fileFolderId, destFolder, keyConfig);
        }
        catch (error) {
            console.log(error);
        }
    });
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=cli.js.map