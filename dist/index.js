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
exports.syncGDrive = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const googleapis_1 = require("googleapis");
const mime_1 = __importDefault(require("mime"));
function sleep(timeout = 1000, value) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve(value);
        }, timeout);
    });
}
function sanitiseFilename(filename) {
    return filename.replace(/[/\\\r\n\t]/g, '_');
}
// Provide a default log function
function log(level, ...message) {
    // eslint-disable-next-line no-console
    console.log(`[${level}] ${message.join(' ')}`);
}
/**
 * Initialise default options and validate user provided option
 * values are valid.
 *
 * @param options
 */
function initIOptions(options = {}) {
    const defaultIOptions = {
        verbose: false,
        callback: undefined,
        docsFileType: 'docx',
        sheetsFileType: 'xlsx',
        slidesFileType: 'pdf',
        mapsFileType: 'kml',
        fallbackGSuiteFileType: 'pdf',
        abortOnError: true,
        logger: {
            debug: log.bind(this, 'debug'),
            warn: log.bind(this, 'warn'),
            error: log.bind(this, 'error')
        },
        sleepTime: 1000
    };
    const mergedIOptions = Object.assign({}, defaultIOptions, options);
    // remove the leading fullstop, if provided
    if (mergedIOptions.docsFileType.startsWith('.')) {
        mergedIOptions.docsFileType = mergedIOptions.docsFileType.substring(1);
    }
    // remove the leading fullstop, if provided
    if (mergedIOptions.sheetsFileType.startsWith('.')) {
        mergedIOptions.sheetsFileType = mergedIOptions.sheetsFileType.substring(1);
    }
    // remove the leading fullstop, if provided
    if (mergedIOptions.slidesFileType.startsWith('.')) {
        mergedIOptions.slidesFileType = mergedIOptions.slidesFileType.substring(1);
    }
    if (!mime_1.default.getType(mergedIOptions.docsFileType)) {
        throw new Error(`Unable to resolve mime type for Google Docs export: ${mergedIOptions.docsFileType}`);
    }
    if (!mime_1.default.getType(mergedIOptions.sheetsFileType)) {
        throw new Error(`Unable to resolve mime type for Google Sheets export: ${mergedIOptions.sheetsFileType}`);
    }
    if (!mime_1.default.getType(mergedIOptions.slidesFileType)) {
        throw new Error(`Unable to resolve mime type for Google Sheets export: ${mergedIOptions.slidesFileType}`);
    }
    if (mergedIOptions.verbose && mergedIOptions.logger && !mergedIOptions.logger.debug) {
        throw new Error('Unable to use provided logger for verbose output');
    }
    return mergedIOptions;
}
/**
 * Converts time to seconds. If the input is
 * a number, then it is assumed to be in milliseconds.
 *
 * @param datetime
 */
function timeAsSeconds(datetime) {
    let timeInMilliseconds = 0;
    if (typeof datetime === 'string') {
        timeInMilliseconds = Date.parse(datetime);
    }
    else if (datetime instanceof Date) {
        timeInMilliseconds = datetime.getTime();
    }
    else {
        timeInMilliseconds = datetime;
    }
    return timeInMilliseconds / 1000;
}
/**
 * Checkes to see if the GDrive file is newer than the local file
 *
 * @param file
 * @param path
 */
function isGDriveFileNewer(gDriveFile, filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const stats = yield fs_1.promises.stat(filePath);
            const fsModifiedTime = timeAsSeconds(stats.mtime);
            const driveModifiedTime = timeAsSeconds(gDriveFile.modifiedTime);
            return { stats, newer: (driveModifiedTime > fsModifiedTime) };
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                return { newer: true };
            }
            else {
                throw err;
            }
        }
    });
}
function addTimestampToFilePath(filePath, timestamp) {
    const parsed = path_1.default.parse(filePath);
    const ext = parsed.ext || '';
    const filename = parsed.name;
    const newFilename = `${filename}__syncgdriveadded--${timestamp}${ext}`;
    return path_1.default.format(Object.assign(Object.assign({}, parsed), { base: newFilename }));
}
function downloadFile(drive, file, destFolder, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        let filePath = path_1.default.join(destFolder, sanitiseFilename(file.name));
        let oldFilePath = filePath;
        const newerResults = yield isGDriveFileNewer(file, filePath);
        if (newerResults === null || newerResults === void 0 ? void 0 : newerResults.newer) {
            if (options.timestampReplacingFiles && (newerResults === null || newerResults === void 0 ? void 0 : newerResults.stats) && !/__syncgdriveadded--/.test(filePath)) {
                filePath = addTimestampToFilePath(filePath, file.createdTime.replace(/\./g, '_'));
            }
            if (options.verbose) {
                options.logger.debug('downloading newer: ', oldFilePath);
                options.logger.debug('creating file: ', filePath);
            }
            const dest = (0, fs_1.createWriteStream)(filePath);
            let fileId = file.id;
            if (file.shortcutDetails) {
                fileId = file.shortcutDetails.targetId;
            }
            const response = yield drive.files.get({
                fileId: fileId,
                alt: 'media'
            }, {
                responseType: 'stream'
            });
            return new Promise((resolve, reject) => {
                response.data
                    .on('error', reject)
                    .pipe(dest)
                    .on('error', reject)
                    .on('finish', () => {
                    // apply time stamp from the drive
                    (0, fs_1.utimesSync)(filePath, timeAsSeconds(file.createdTime), timeAsSeconds(file.modifiedTime));
                    resolve({
                        file: filePath,
                        updated: true
                    });
                });
            });
        }
        return {
            file: filePath,
            updated: false
        };
    });
}
function exportFile(drive, file, destFolder, mimeType, suffix, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const name = sanitiseFilename(file.name) + suffix;
        const filePath = path_1.default.join(destFolder, name);
        const newerResults = yield isGDriveFileNewer(file, filePath);
        if (newerResults === null || newerResults === void 0 ? void 0 : newerResults.newer) {
            if (options.verbose) {
                options.logger.debug('downloading newer: ', filePath);
                options.logger.debug('exporting to file: ', filePath);
            }
            const dest = (0, fs_1.createWriteStream)(filePath);
            let fileId = file.id;
            if (file.shortcutDetails) {
                fileId = file.shortcutDetails.targetId;
            }
            // For Google Docs files only
            const response = yield drive.files.export({
                fileId, mimeType
            }, {
                responseType: 'stream'
            });
            return new Promise((resolve, reject) => {
                response.data
                    .on('error', reject)
                    .pipe(dest)
                    .on('error', reject)
                    .on('finish', () => {
                    // apply time stamp from the drive
                    (0, fs_1.utimesSync)(filePath, timeAsSeconds(file.createdTime), timeAsSeconds(file.modifiedTime));
                    resolve({
                        file: filePath,
                        updated: true
                    });
                });
            });
        }
        return {
            file: filePath,
            updated: false
        };
    });
}
function downloadContent(drive, file, path, options) {
    return __awaiter(this, void 0, void 0, function* () {
        let result;
        let fileMimeType = file.mimeType;
        if (file.shortcutDetails) {
            fileMimeType = file.shortcutDetails.targetMimeType;
        }
        if (file.mimeType === 'application/vnd.google-apps.document') {
            const exportimeType = mime_1.default.getType(options.docsFileType);
            result = yield exportFile(drive, file, path, exportimeType, `.${options.docsFileType}`, options);
        }
        else if (fileMimeType === 'application/vnd.google-apps.spreadsheet') {
            const exportimeType = mime_1.default.getType(options.sheetsFileType);
            result = yield exportFile(drive, file, path, exportimeType, `.${options.sheetsFileType}`, options);
        }
        else if (fileMimeType === 'application/vnd.google-apps.presentation') {
            const exportimeType = mime_1.default.getType(options.slidesFileType);
            result = yield exportFile(drive, file, path, exportimeType, `.${options.slidesFileType}`, options);
        }
        else if (fileMimeType === 'application/vnd.google-apps.map') {
            const exportimeType = mime_1.default.getType(options.mapsFileType);
            result = yield exportFile(drive, file, path, exportimeType, `.${options.mapsFileType}`, options);
        }
        else if (fileMimeType && fileMimeType.startsWith('application/vnd.google-apps')) {
            // eslint-disable-next-line no-console
            const exportimeType = mime_1.default.getType(options.fallbackGSuiteFileType);
            result = yield exportFile(drive, file, path, exportimeType, `.${options.fallbackGSuiteFileType}`, options);
        }
        else {
            // eslint-disable-next-line no-console
            result = yield downloadFile(drive, file, path, options);
        }
        return result;
    });
}
function visitDirectory(drive, fileId, folderPath, options, callback) {
    return __awaiter(this, void 0, void 0, function* () {
        let nextPageToken;
        let allSyncStates = [];
        do {
            const response = yield drive.files.list({
                supportsAllDrives: options.supportsAllDrives,
                includeItemsFromAllDrives: options.includeItemsFromAllDrives,
                pageToken: nextPageToken,
                spaces: 'drive',
                fields: 'nextPageToken, files(id, name, parents, mimeType, createdTime, modifiedTime, shortcutDetails)',
                q: `'${fileId}' in parents`,
                orderBy: `createdTime ${options.timestampReplacingFiles ? "asc" : "desc"}`,
                pageSize: 200
            });
            // Needed to get further results
            nextPageToken = response.data.nextPageToken;
            const files = response.data.files;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.mimeType === 'application/vnd.google-apps.folder') {
                    const childFolderPath = path_1.default.join(folderPath, file.name);
                    if (options.verbose) {
                        options.logger.debug('DIR', file.id, childFolderPath, file.name);
                    }
                    yield fs_1.promises.mkdir(childFolderPath, { recursive: true });
                    if (options.sleepTime) {
                        yield sleep(options.sleepTime);
                    }
                    const syncState = yield visitDirectory(drive, file.id, childFolderPath, options);
                    allSyncStates = allSyncStates.concat(syncState);
                }
                else {
                    if (options.verbose) {
                        options.logger.debug('DIR', file.id, folderPath, file.name);
                    }
                    const syncState = yield downloadContent(drive, file, folderPath, options);
                    allSyncStates.push(syncState);
                }
            }
            // continue until there is no next page
        } while (nextPageToken);
        return allSyncStates;
    });
}
function fetchContents(drive, fileId, destFolder, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield drive.files.get({
            fileId: fileId,
            fields: 'id, name, parents, mimeType, createdTime, modifiedTime',
            supportsAllDrives: options.supportsAllDrives
        });
        const { data } = response;
        if (data.mimeType === 'application/vnd.google-apps.folder') {
            return yield visitDirectory(drive, fileId, destFolder, options);
        }
        else {
            return yield downloadContent(drive, data, destFolder, options);
        }
    });
}
function syncGDrive(fileFolderId, destFolder, keyConfig, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const auth = new googleapis_1.google.auth.JWT(keyConfig.clientEmail, null, keyConfig.privateKey, [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.appdata',
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.metadata',
                'https://www.googleapis.com/auth/drive.metadata.readonly',
                'https://www.googleapis.com/auth/drive.photos.readonly',
                'https://www.googleapis.com/auth/drive.readonly'
            ], null);
            googleapis_1.google.options({ auth });
            const drive = googleapis_1.google.drive('v3');
            return fetchContents(drive, fileFolderId, destFolder, initIOptions(options));
        }
        catch (error) {
            log(error);
        }
    });
}
exports.syncGDrive = syncGDrive;
exports.default = syncGDrive;
// ref: https://developers.google.com/drive/v3/web/folder
// ref: https://www.npmjs.com/package/googleapis
// ref: https://developers.google.com/drive/v3/web/search-parameters
// ref: https://developers.google.com/drive/v3/web/manage-downloads
// ref: https://developers.google.com/drive/v3/reference/files#resource
//# sourceMappingURL=index.js.map