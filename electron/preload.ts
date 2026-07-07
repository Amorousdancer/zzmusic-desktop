import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("zzmusic", {
  appName: "ZZmusic",
  getLibrary: () => ipcRenderer.invoke("library:get"),
  importTracks: () => ipcRenderer.invoke("library:import"),
  removeTrack: (trackId: string) => ipcRenderer.invoke("library:remove", trackId),
  getPlaylists: () => ipcRenderer.invoke("playlists:get"),
  createPlaylist: (name: string) => ipcRenderer.invoke("playlists:create", name),
  renamePlaylist: (playlistId: string, name: string) =>
    ipcRenderer.invoke("playlists:rename", playlistId, name),
  deletePlaylist: (playlistId: string) => ipcRenderer.invoke("playlists:delete", playlistId),
  addTrackToPlaylist: (playlistId: string, trackId: string) =>
    ipcRenderer.invoke("playlists:add-track", playlistId, trackId),
  removeTrackFromPlaylist: (playlistId: string, trackId: string) =>
    ipcRenderer.invoke("playlists:remove-track", playlistId, trackId)
});
