import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("zzmusic", {
  appName: "ZZmusic",
  getLibrary: () => ipcRenderer.invoke("library:get"),
  importTracks: () => ipcRenderer.invoke("library:import"),
  importTrackFolder: () => ipcRenderer.invoke("library:import-folder"),
  removeTrack: (trackId: string) => ipcRenderer.invoke("library:remove", trackId),
  getPlaylists: () => ipcRenderer.invoke("playlists:get"),
  createPlaylist: (name: string) => ipcRenderer.invoke("playlists:create", name),
  renamePlaylist: (playlistId: string, name: string) =>
    ipcRenderer.invoke("playlists:rename", playlistId, name),
  deletePlaylist: (playlistId: string) => ipcRenderer.invoke("playlists:delete", playlistId),
  addTrackToPlaylist: (playlistId: string, trackId: string) =>
    ipcRenderer.invoke("playlists:add-track", playlistId, trackId),
  removeTrackFromPlaylist: (playlistId: string, trackId: string) =>
    ipcRenderer.invoke("playlists:remove-track", playlistId, trackId),
  getLyrics: (trackId: string) => ipcRenderer.invoke("lyrics:get", trackId),
  importLyrics: (trackId: string) => ipcRenderer.invoke("lyrics:import", trackId),
  getPlaybackMemory: () => ipcRenderer.invoke("playback-memory:get"),
  savePlaybackMemory: (memory: unknown) => ipcRenderer.invoke("playback-memory:save", memory),
  getPlayerState: () => ipcRenderer.invoke("player-state:get"),
  savePlayerState: (state: unknown) => ipcRenderer.invoke("player-state:save", state),
  windowControls: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    restore: () => ipcRenderer.invoke("window:restore"),
    toggleFullscreen: () => ipcRenderer.invoke("window:toggle-fullscreen"),
    close: () => ipcRenderer.invoke("window:close")
  },
  sendPlayerCommand: (command: string) => ipcRenderer.invoke("player:command", command),
  onPlayerCommand: (handler: (command: string) => void) => {
    const listener = (_event: IpcRendererEvent, command: string) => handler(command);
    ipcRenderer.on("player:command", listener);
    return () => ipcRenderer.removeListener("player:command", listener);
  }
});
