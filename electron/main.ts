import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from "electron";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { pathToFileURL } from "node:url";

let mainWindow: BrowserWindow | null = null;
const allowedExtensions = new Set([".mp3", ".wav", ".flac", ".m4a"]);

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

function libraryPath(): string {
  return join(app.getPath("userData"), "library.json");
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

    const library = await readLibrary();
    const existingPaths = new Set(library.map((track) => track.filePath));
    const importedTracks = result.filePaths
      .filter(isAllowedAudio)
      .filter((filePath) => !existingPaths.has(filePath))
      .map(createTrack);
    const nextLibrary = [...library, ...importedTracks];

    await writeLibrary(nextLibrary);
    return nextLibrary.map(toTrackView);
  });

  ipcMain.handle("library:remove", async (_event, trackId: string) => {
    const library = await readLibrary();
    const nextLibrary = library.filter((track) => track.id !== trackId);
    await writeLibrary(nextLibrary);
    return nextLibrary.map(toTrackView);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    title: "ZZmusic",
    backgroundColor: "#f5f5f7",
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

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
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
