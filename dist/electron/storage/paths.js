"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAppPaths = exports.getServersRoot = exports.getDocumentsPath = exports.getAppDataPath = exports.getAppName = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const getAppName = () => electron_1.app.getName();
exports.getAppName = getAppName;
const getAppDataPath = () => electron_1.app.getPath('userData');
exports.getAppDataPath = getAppDataPath;
const getDocumentsPath = () => path_1.default.join(electron_1.app.getPath('documents'), (0, exports.getAppName)());
exports.getDocumentsPath = getDocumentsPath;
const getServersRoot = () => path_1.default.join((0, exports.getDocumentsPath)(), 'Servers');
exports.getServersRoot = getServersRoot;
const ensureAppPaths = async () => {
    await promises_1.default.mkdir((0, exports.getAppDataPath)(), { recursive: true });
    await promises_1.default.mkdir((0, exports.getServersRoot)(), { recursive: true });
};
exports.ensureAppPaths = ensureAppPaths;
//# sourceMappingURL=paths.js.map