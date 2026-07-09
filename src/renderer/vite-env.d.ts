/// <reference types="vite/client" />

type Track = {
  id: string;
  title: string;
  artist: string;
  filePath: string;
  audioUrl: string;
  importedAt: string;
};

type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
};

type Lyric = {
  trackId: string;
  fileName: string;
  content: string;
  importedAt: string;
};

interface Window {
  zzmusic: {
    appName: string;
    getLibrary: () => Promise<Track[]>;
    importTracks: () => Promise<Track[]>;
    importTrackFolder: () => Promise<Track[]>;
    removeTrack: (trackId: string) => Promise<Track[]>;
    getPlaylists: () => Promise<Playlist[]>;
    createPlaylist: (name: string) => Promise<Playlist[]>;
    renamePlaylist: (playlistId: string, name: string) => Promise<Playlist[]>;
    deletePlaylist: (playlistId: string) => Promise<Playlist[]>;
    addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<Playlist[]>;
    removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<Playlist[]>;
    getLyrics: (trackId: string) => Promise<Lyric | null>;
    importLyrics: (trackId: string) => Promise<Lyric | null>;
    getPlaybackMemory: () => Promise<Record<string, { time: number; duration: number; updatedAt: string }>>;
    savePlaybackMemory: (
      memory: Record<string, { time: number; duration: number; updatedAt: string }>
    ) => Promise<Record<string, { time: number; duration: number; updatedAt: string }>>;
    getPlayerState: () => Promise<{ currentTrackId: string | null; updatedAt: string }>;
    savePlayerState: (state: {
      currentTrackId: string | null;
      updatedAt?: string;
    }) => Promise<{ currentTrackId: string | null; updatedAt: string }>;
    windowControls: {
      minimize: () => Promise<void>;
      restore: () => Promise<void>;
      toggleFullscreen: () => Promise<boolean>;
      close: () => Promise<void>;
    };
    sendPlayerCommand: (command: "previous" | "toggle-play" | "next" | "volume-up" | "volume-down") => Promise<void>;
    onPlayerCommand: (
      handler: (command: "previous" | "toggle-play" | "next" | "volume-up" | "volume-down") => void
    ) => () => void;
  };
}
