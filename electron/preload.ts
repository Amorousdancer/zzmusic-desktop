import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("zzmusic", {
  appName: "ZZmusic",
  getLibrary: () => ipcRenderer.invoke("library:get"),
  importTracks: () => ipcRenderer.invoke("library:import"),
  removeTrack: (trackId: string) => ipcRenderer.invoke("library:remove", trackId),
  getPlaylists: () => ipcRenderer.invoke("playlists:get"),
  createPlaylist: (name: string) => ipcRenderer.invoke("playlists:create", name),
  addTrackToPlaylist: (playlistId: string, trackId: string) =>
    ipcRenderer.invoke("playlists:add-track", playlistId, trackId),
  removeTrackFromPlaylist: (playlistId: string, trackId: string) =>
    ipcRenderer.invoke("playlists:remove-track", playlistId, trackId)
});
