import { app, BrowserWindow, Menu, dialog, globalShortcut, ipcMain, screen, shell, type OpenDialogOptions } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { pathToFileURL } from "node:url";

let mainWindow: BrowserWindow | null = null;
let miniWindow: BrowserWindow | null = null;
const appIconPath = join(__dirname, "../../图标素材/app.png");
const allowedExtensions = new Set([".mp3", ".wav", ".flac", ".m4a"]);
type PlayerCommand = "previous" | "toggle-play" | "next" | "volume-up" | "volume-down";
const playerCommands = new Set<PlayerCommand>(["previous", "toggle-play", "next", "volume-up", "volume-down"]);
const heldShortcutTimers = new Map<PlayerCommand, ReturnType<typeof setTimeout>>();

function sendPlayerCommand(command: PlayerCommand): void {
  mainWindow?.webContents.send("player:command", command);
}

function sendGlobalShortcutCommand(command: PlayerCommand): void {
  if (command === "previous" || command === "next") {
    const existingTimer = heldShortcutTimers.get(command);
    if (existingTimer) {
      clearTimeout(existingTimer);
      heldShortcutTimers.set(command, setTimeout(() => heldShortcutTimers.delete(command), 360));
      return;
    }

    heldShortcutTimers.set(command, setTimeout(() => heldShortcutTimers.delete(command), 360));
  }

  sendPlayerCommand(command);
}

function registerGlobalShortcuts(): void {
  const shortcuts: Array<[string, PlayerCommand]> = [
    ["Control+Left", "previous"],
    ["Control+Right", "next"],
    ["Control+Up", "volume-up"],
    ["Control+Down", "volume-down"]
  ];

  for (const [accelerator, command] of shortcuts) {
    globalShortcut.register(accelerator, () => sendGlobalShortcutCommand(command));
  }
}

type Track = {
  id: string;
  title: string;
  artist: string;
  filePath: string;
  importedAt: string;
};

type TrackView = Track & {
  audioUrl: string;
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

type PlaybackMemoryEntry = {
  time: number;
  duration: number;
  updatedAt: string;
};

type PlaybackMemory = Record<string, PlaybackMemoryEntry>;

type PlayerState = {
  currentTrackId: string | null;
  updatedAt: string;
};

function libraryPath(): string {
  return join(app.getPath("userData"), "library.json");
}

function playlistsPath(): string {
  return join(app.getPath("userData"), "playlists.json");
}

function lyricsPath(): string {
  return join(app.getPath("userData"), "lyrics.json");
}

function playbackMemoryPath(): string {
  return join(app.getPath("userData"), "playback-memory.json");
}

function playerStatePath(): string {
  return join(app.getPath("userData"), "player-state.json");
}

function createTrack(filePath: string): Track {
  const extension = extname(filePath);
  return {
    id: createHash("sha1").update(filePath).digest("hex"),
    title: basename(filePath, extension),
    artist: basename(dirname(filePath)) || "本地音乐",
    filePath,
    importedAt: new Date().toISOString()
  };
}

function isAllowedAudio(filePath: string): boolean {
  return allowedExtensions.has(extname(filePath).toLowerCase());
}

async function scanAudioFiles(folderPath: string): Promise<string[]> {
  try {
    const entries = await readdir(folderPath, { withFileTypes: true });
    const filePaths = await Promise.all(
      entries.map((entry) => {
        const entryPath = join(folderPath, entry.name);
        if (entry.isDirectory()) {
          return scanAudioFiles(entryPath);
        }
        return Promise.resolve(isAllowedAudio(entryPath) ? [entryPath] : []);
      })
    );
    return filePaths.flat();
  } catch {
    return [];
  }
}

async function readLibrary(): Promise<Track[]> {
  try {
    const content = await readFile(libraryPath(), "utf-8");
    const data = JSON.parse(content) as Track[];
    return Array.isArray(data) ? data.filter((track) => track.filePath && track.id) : [];
  } catch {
    return [];
  }
}

function toTrackView(track: Track): TrackView {
  return {
    ...track,
    audioUrl: pathToFileURL(track.filePath).toString()
  };
}

async function writeLibrary(tracks: Track[]): Promise<void> {
  const path = libraryPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(tracks, null, 2), "utf-8");
}

async function importLibraryTracks(filePaths: string[]): Promise<TrackView[]> {
  const library = await readLibrary();
  const existingPaths = new Set(library.map((track) => track.filePath));
  const importedTracks = filePaths
    .filter(isAllowedAudio)
    .filter((filePath) => !existingPaths.has(filePath))
    .map(createTrack);
  const nextLibrary = [...library, ...importedTracks];

  await writeLibrary(nextLibrary);
  return nextLibrary.map(toTrackView);
}

async function readPlaylists(): Promise<Playlist[]> {
  try {
    const content = await readFile(playlistsPath(), "utf-8");
    const data = JSON.parse(content) as Playlist[];
    return Array.isArray(data)
      ? data.filter((playlist) => playlist.id && playlist.name && Array.isArray(playlist.trackIds))
      : [];
  } catch {
    return [];
  }
}

async function writePlaylists(playlists: Playlist[]): Promise<void> {
  const path = playlistsPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(playlists, null, 2), "utf-8");
}

async function readLyrics(): Promise<Record<string, Lyric>> {
  try {
    const content = await readFile(lyricsPath(), "utf-8");
    const data = JSON.parse(content) as Record<string, Lyric>;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

async function writeLyrics(lyrics: Record<string, Lyric>): Promise<void> {
  const path = lyricsPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(lyrics, null, 2), "utf-8");
}

function normalizePlaybackMemoryEntry(entry: unknown): PlaybackMemoryEntry | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const source = entry as Partial<PlaybackMemoryEntry>;
  const time = Number(source.time);
  const duration = Number(source.duration);
  if (!Number.isFinite(time) || !Number.isFinite(duration) || time < 10 || duration - time < 8) {
    return null;
  }

  return {
    time,
    duration,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString()
  };
}

async function readPlaybackMemory(): Promise<PlaybackMemory> {
  try {
    const content = await readFile(playbackMemoryPath(), "utf-8");
    const data = JSON.parse(content) as Record<string, unknown>;
    if (!data || typeof data !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(data)
        .map(([trackId, entry]) => [trackId, normalizePlaybackMemoryEntry(entry)] as const)
        .filter((entry): entry is [string, PlaybackMemoryEntry] => Boolean(entry[1]))
    );
  } catch {
    return {};
  }
}

async function writePlaybackMemory(memory: PlaybackMemory): Promise<void> {
  const path = playbackMemoryPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(memory, null, 2), "utf-8");
}

async function readPlayerState(): Promise<PlayerState> {
  try {
    const content = await readFile(playerStatePath(), "utf-8");
    const data = JSON.parse(content) as Partial<PlayerState>;
    return {
      currentTrackId: typeof data.currentTrackId === "string" ? data.currentTrackId : null,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString()
    };
  } catch {
    return { currentTrackId: null, updatedAt: new Date().toISOString() };
  }
}

async function writePlayerState(state: PlayerState): Promise<void> {
  const path = playerStatePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2), "utf-8");
}

function registerIpc(): void {
  ipcMain.handle("library:get", async () => (await readLibrary()).map(toTrackView));

  ipcMain.handle("library:import", async () => {
    const dialogOptions: OpenDialogOptions = {
      title: "导入音乐",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "音频文件", extensions: ["mp3", "wav", "flac", "m4a"] }]
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled) {
      return (await readLibrary()).map(toTrackView);
    }

    return importLibraryTracks(result.filePaths);
  });

  ipcMain.handle("library:import-folder", async () => {
    const dialogOptions: OpenDialogOptions = {
      title: "扫描音乐文件夹",
      properties: ["openDirectory"]
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return (await readLibrary()).map(toTrackView);
    }

    return importLibraryTracks(await scanAudioFiles(result.filePaths[0]));
  });

  ipcMain.handle("library:remove", async (_event, trackId: string) => {
    const library = await readLibrary();
    const nextLibrary = library.filter((track) => track.id !== trackId);
    const playlists = await readPlaylists();
    const playbackMemory = await readPlaybackMemory();
    const playerState = await readPlayerState();
    const nextPlaylists = playlists.map((playlist) => ({
      ...playlist,
      trackIds: playlist.trackIds.filter((id) => id !== trackId)
    }));
    delete playbackMemory[trackId];
    if (playerState.currentTrackId === trackId) {
      playerState.currentTrackId = null;
      playerState.updatedAt = new Date().toISOString();
    }
    await writeLibrary(nextLibrary);
    await writePlaylists(nextPlaylists);
    await writePlaybackMemory(playbackMemory);
    await writePlayerState(playerState);
    return nextLibrary.map(toTrackView);
  });

  ipcMain.handle("playlists:get", () => readPlaylists());

  ipcMain.handle("playlists:create", async (_event, name: string) => {
    const playlistName = name.trim();
    if (!playlistName) {
      return readPlaylists();
    }

    const playlists = await readPlaylists();
    if (playlists.some((playlist) => playlist.name === playlistName)) {
      return playlists;
    }

    const nextPlaylists = [
      ...playlists,
      { id: randomUUID(), name: playlistName, trackIds: [], createdAt: new Date().toISOString() }
    ];
    await writePlaylists(nextPlaylists);
    return nextPlaylists;
  });

  ipcMain.handle("playlists:rename", async (_event, playlistId: string, name: string) => {
    const playlistName = name.trim();
    const playlists = await readPlaylists();
    if (!playlistName || playlists.some((playlist) => playlist.id !== playlistId && playlist.name === playlistName)) {
      return playlists;
    }

    const nextPlaylists = playlists.map((playlist) =>
      playlist.id === playlistId ? { ...playlist, name: playlistName } : playlist
    );
    await writePlaylists(nextPlaylists);
    return nextPlaylists;
  });

  ipcMain.handle("playlists:delete", async (_event, playlistId: string) => {
    const playlists = await readPlaylists();
    const nextPlaylists = playlists.filter((playlist) => playlist.id !== playlistId);
    await writePlaylists(nextPlaylists);
    return nextPlaylists;
  });

  ipcMain.handle("playlists:add-track", async (_event, playlistId: string, trackId: string) => {
    const playlists = await readPlaylists();
    const nextPlaylists = playlists.map((playlist) => {
      if (playlist.id !== playlistId || playlist.trackIds.includes(trackId)) {
        return playlist;
      }

      return { ...playlist, trackIds: [...playlist.trackIds, trackId] };
    });
    await writePlaylists(nextPlaylists);
    return nextPlaylists;
  });

  ipcMain.handle("playlists:remove-track", async (_event, playlistId: string, trackId: string) => {
    const playlists = await readPlaylists();
    const nextPlaylists = playlists.map((playlist) =>
      playlist.id === playlistId
        ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) }
        : playlist
    );
    await writePlaylists(nextPlaylists);
    return nextPlaylists;
  });

  ipcMain.handle("lyrics:get", async (_event, trackId: string) => {
    const lyrics = await readLyrics();
    return lyrics[trackId] ?? null;
  });

  ipcMain.handle("lyrics:import", async (_event, trackId: string) => {
    const dialogOptions: OpenDialogOptions = {
      title: "导入歌词",
      properties: ["openFile"],
      filters: [{ name: "歌词文件", extensions: ["lrc", "txt"] }]
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      const lyrics = await readLyrics();
      return lyrics[trackId] ?? null;
    }

    const filePath = result.filePaths[0];
    const content = await readFile(filePath, "utf-8");
    const lyrics = await readLyrics();
    const lyric: Lyric = {
      trackId,
      fileName: basename(filePath),
      content,
      importedAt: new Date().toISOString()
    };
    lyrics[trackId] = lyric;
    await writeLyrics(lyrics);
    return lyric;
  });

  ipcMain.handle("playback-memory:get", readPlaybackMemory);

  ipcMain.handle("playback-memory:save", async (_event, memory: PlaybackMemory) => {
    const normalized = Object.fromEntries(
      Object.entries(memory ?? {})
        .map(([trackId, entry]) => [trackId, normalizePlaybackMemoryEntry(entry)] as const)
        .filter((entry): entry is [string, PlaybackMemoryEntry] => Boolean(entry[1]))
    );
    await writePlaybackMemory(normalized);
    return normalized;
  });

  ipcMain.handle("player-state:get", readPlayerState);

  ipcMain.handle("player-state:save", async (_event, state: Partial<PlayerState>) => {
    const nextState: PlayerState = {
      currentTrackId: typeof state?.currentTrackId === "string" ? state.currentTrackId : null,
      updatedAt: new Date().toISOString()
    };
    await writePlayerState(nextState);
    return nextState;
  });
}

function miniUrl(): string {
  return process.env.ELECTRON_RENDERER_URL
    ? `${process.env.ELECTRON_RENDERER_URL}?mini=1`
    : join(__dirname, "../renderer/index.html");
}

async function loadMiniWindow(): Promise<void> {
  if (!miniWindow) {
    return;
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    await miniWindow.loadURL(miniUrl());
  } else {
    await miniWindow.loadFile(miniUrl(), { query: { mini: "1" } });
  }
}

function positionMiniWindow(): void {
  if (!miniWindow) {
    return;
  }

  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const [width, height] = miniWindow.getSize();
  miniWindow.setPosition(workArea.x + workArea.width - width - 24, workArea.y + workArea.height - height - 28);
}

async function showMiniWindow(): Promise<void> {
  if (!miniWindow) {
    miniWindow = new BrowserWindow({
      width: 184,
      height: 58,
      resizable: false,
      maximizable: false,
      minimizable: false,
      frame: false,
      transparent: true,
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      icon: appIconPath,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: join(__dirname, "../preload/preload.mjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    miniWindow.on("closed", () => {
      miniWindow = null;
    });
    await loadMiniWindow();
  }

  positionMiniWindow();
  miniWindow.showInactive();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    title: "ZZmusic",
    icon: appIconPath,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#000000",
    backgroundMaterial: "none",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("minimize", () => {
    showMiniWindow().catch(console.error);
  });
  mainWindow.on("restore", () => {
    miniWindow?.hide();
  });
  mainWindow.on("focus", () => {
    if (!mainWindow?.isMinimized()) {
      miniWindow?.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    miniWindow?.close();
    miniWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function registerWindowControls(): void {
  ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("window:restore", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    miniWindow?.hide();
  });
  ipcMain.handle("window:toggle-fullscreen", () => {
    if (!mainWindow) {
      return false;
    }

    const shouldFullscreen = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(shouldFullscreen);
    return shouldFullscreen;
  });
  ipcMain.handle("window:close", () => mainWindow?.close());
  ipcMain.handle("player:command", (_event, command: string) => {
    if (playerCommands.has(command as PlayerCommand)) {
      sendPlayerCommand(command as PlayerCommand);
    }
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerGlobalShortcuts();
  registerWindowControls();
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
