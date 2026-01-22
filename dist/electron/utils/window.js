"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMainWindow = void 0;
const electron_1 = require("electron");
const getMainWindow = () => electron_1.BrowserWindow.getAllWindows().find((win) => !win.isDestroyed());
exports.getMainWindow = getMainWindow;
//# sourceMappingURL=window.js.map