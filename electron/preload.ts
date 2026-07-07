import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("zzmusic", {
  appName: "ZZmusic"
});
