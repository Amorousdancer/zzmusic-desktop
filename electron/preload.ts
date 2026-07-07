import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("zzmusic", {
  appName: "ZZmusic",
  getLibrary: () => ipcRenderer.invoke("library:get"),
  importTracks: () => ipcRenderer.invoke("library:import"),
  removeTrack: (trackId: string) => ipcRenderer.invoke("library:remove", trackId)
});
