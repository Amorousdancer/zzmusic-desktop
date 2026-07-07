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

interface Window {
  zzmusic: {
    appName: string;
    getLibrary: () => Promise<Track[]>;
    importTracks: () => Promise<Track[]>;
    removeTrack: (trackId: string) => Promise<Track[]>;
    getPlaylists: () => Promise<Playlist[]>;
    createPlaylist: (name: string) => Promise<Playlist[]>;
    renamePlaylist: (playlistId: string, name: string) => Promise<Playlist[]>;
    deletePlaylist: (playlistId: string) => Promise<Playlist[]>;
    addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<Playlist[]>;
    removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<Playlist[]>;
  };
}
