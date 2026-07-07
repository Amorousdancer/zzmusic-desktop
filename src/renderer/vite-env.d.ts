/// <reference types="vite/client" />

type Track = {
  id: string;
  title: string;
  artist: string;
  filePath: string;
  importedAt: string;
};

interface Window {
  zzmusic: {
    appName: string;
    getLibrary: () => Promise<Track[]>;
    importTracks: () => Promise<Track[]>;
    removeTrack: (trackId: string) => Promise<Track[]>;
  };
}
