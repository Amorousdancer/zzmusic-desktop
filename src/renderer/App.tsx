import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Disc3,
  FileText,
  FolderSearch,
  Library,
  ListMusic,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  RotateCcw,
  Search,
  Shuffle,
  SlidersHorizontal,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  X
} from "lucide-react";
import libraryVideoUrl from "../../视频素材/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4";
import playlistVideoUrl from "../../视频素材/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4";
import lyricsVideoUrl from "../../视频素材/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4";
import appIconUrl from "../../图标素材/app.png";

type ActiveView = "library" | "playlist" | "lyrics" | "equalizer";
type PlaybackMode = "loop" | "shuffle";
type EqualizerPresetName = "flat" | "bass" | "vocal" | "pop" | "rock" | "classical" | "custom";
type EqualizerNamedPreset = Exclude<EqualizerPresetName, "custom">;

type EqualizerSettings = {
  enabled: boolean;
  preset: EqualizerPresetName;
  gains: number[];
};

type LyricLine = {
  time: number | null;
  text: string;
};

const coverPalettes = [
  ["#8edfd1", "#7fb6e8", "#edf7f5"],
  ["#a7d8cf", "#8fb9dc", "#f3f8fb"],
  ["#95d5c4", "#b8cce8", "#f6f8fb"],
  ["#b6ddd5", "#91c7bc", "#f2f7f4"],
  ["#9fcbdc", "#8fd6c6", "#f4f8fb"]
];

const sectionVideos: Record<ActiveView, string> = {
  library: libraryVideoUrl,
  playlist: playlistVideoUrl,
  lyrics: lyricsVideoUrl,
  equalizer: lyricsVideoUrl
};

const equalizerBands = [
  { frequency: 32, label: "32" },
  { frequency: 64, label: "64" },
  { frequency: 125, label: "125" },
  { frequency: 250, label: "250" },
  { frequency: 500, label: "500" },
  { frequency: 1000, label: "1k" },
  { frequency: 2000, label: "2k" },
  { frequency: 4000, label: "4k" },
  { frequency: 8000, label: "8k" },
  { frequency: 16000, label: "16k" }
];

const equalizerPresets: Record<EqualizerNamedPreset, { label: string; gains: number[] }> = {
  flat: { label: "默认", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  bass: { label: "低音增强", gains: [5, 4, 3, 1.5, 0, 0, -0.5, -1, -1.5, -2] },
  vocal: { label: "人声", gains: [-2, -1, 0, 1.5, 3, 3, 2, 1, 0, -1] },
  pop: { label: "流行", gains: [1.5, 2, 1, 0, -1, 1, 2, 2, 1, 1] },
  rock: { label: "摇滚", gains: [3, 2, 1, -1, -0.5, 1, 2.5, 3, 2, 1] },
  classical: { label: "古典", gains: [0, 0, 0, 1, 2, 2, 1, 0, 0, 0] }
};

const equalizerStorageKey = "zzmusic.equalizer";
const defaultEqualizerSettings: EqualizerSettings = {
  enabled: false,
  preset: "flat",
  gains: equalizerPresets.flat.gains
};

const idleBarLevels = Array.from({ length: 18 }, (_, index) => 0.32 + (index % 5) * 0.1);

function normalizeEqualizerGains(gains: unknown): number[] {
  const source = Array.isArray(gains) ? gains : [];
  return equalizerBands.map((_, index) => {
    const value = Number(source[index]);
    return Number.isFinite(value) ? Math.min(12, Math.max(-12, value)) : 0;
  });
}

function readEqualizerSettings(): EqualizerSettings {
  try {
    const raw = window.localStorage.getItem(equalizerStorageKey);
    const parsed = raw ? (JSON.parse(raw) as Partial<EqualizerSettings>) : null;
    const preset =
      parsed?.preset === "custom" || (parsed?.preset && parsed.preset in equalizerPresets)
        ? parsed.preset
        : defaultEqualizerSettings.preset;

    return {
      enabled: Boolean(parsed?.enabled),
      preset,
      gains: normalizeEqualizerGains(parsed?.gains)
    };
  } catch {
    return defaultEqualizerSettings;
  }
}

function formatGain(gain: number): string {
  const fixed = Number.isInteger(gain) ? gain.toFixed(0) : gain.toFixed(1);
  return `${gain > 0 ? "+" : ""}${fixed} dB`;
}

function buildBarLevels(data: Uint8Array): number[] {
  return Array.from({ length: 18 }, (_, index) => {
    const start = Math.floor((index / 18) * data.length);
    const end = Math.floor(((index + 1) / 18) * data.length);
    let total = 0;

    for (let dataIndex = start; dataIndex < end; dataIndex += 1) {
      total += Math.abs(data[dataIndex] - 128) / 128;
    }

    const average = total / Math.max(1, end - start);
    return Math.min(1, 0.24 + average * 2.8);
  });
}

function fadeVideo(video: HTMLVideoElement, to: number, duration = 500): void {
  const from = Number.parseFloat(video.style.opacity || "0");
  const start = performance.now();

  function frame(now: number) {
    const progress = Math.min((now - start) / duration, 1);
    video.style.opacity = String(from + (to - from) * progress);
    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${rest}`;
}

function parseLyricLines(content: string): LyricLine[] {
  const lines: LyricLine[] = [];

  for (const line of content.split(/\r?\n/)) {
    const timestamps = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    const text = line.replace(/\[[^\]]+\]/g, "").trim();
    if (!text) {
      continue;
    }

    if (timestamps.length === 0) {
      lines.push({ time: null, text });
      continue;
    }

    for (const match of timestamps) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = Number((match[3] ?? "0").padEnd(3, "0"));
      lines.push({ time: minutes * 60 + seconds + fraction / 1000, text });
    }
  }

  return lines.sort((a, b) => (a.time ?? Number.MAX_SAFE_INTEGER) - (b.time ?? Number.MAX_SAFE_INTEGER));
}

function hashText(text: string): number {
  return [...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function visualStyle(seed: string): CSSProperties {
  const [a, b, c] = coverPalettes[hashText(seed) % coverPalettes.length];
  return {
    "--cover-a": a,
    "--cover-b": b,
    "--cover-c": c,
    "--cover-glow": `${a}44`
  } as CSSProperties;
}

function initials(title: string): string {
  const trimmed = title.trim();
  return (trimmed[0] ?? "Z").toUpperCase();
}

function isTextInputTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function MiniFloatingPlayer() {
  const [isMiniPlaying, setIsMiniPlaying] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("mini-window-root");
    document.body.classList.add("mini-window-body");

    return () => {
      document.documentElement.classList.remove("mini-window-root");
      document.body.classList.remove("mini-window-body");
    };
  }, []);

  return (
    <main className="mini-shell">
      <div className="mini-drag-region" aria-hidden="true" />
      <div className="mini-controls" aria-label="悬浮播放控制">
        <button
          type="button"
          aria-label="上一首"
          onClick={() => {
            setIsMiniPlaying(false);
            void window.zzmusic.sendPlayerCommand("previous");
          }}
        >
          <SkipBack size={16} fill="currentColor" />
        </button>
        <button
          type="button"
          aria-label={isMiniPlaying ? "暂停" : "播放"}
          onClick={() => {
            setIsMiniPlaying((playing) => !playing);
            void window.zzmusic.sendPlayerCommand("toggle-play");
          }}
        >
          {isMiniPlaying ? <Play size={17} fill="currentColor" /> : <Pause size={17} fill="currentColor" />}
        </button>
        <button
          type="button"
          aria-label="下一首"
          onClick={() => {
            setIsMiniPlaying(false);
            void window.zzmusic.sendPlayerCommand("next");
          }}
        >
          <SkipForward size={16} fill="currentColor" />
        </button>
        <button type="button" aria-label="恢复主窗口" onClick={() => void window.zzmusic.windowControls.restore()}>
          <Maximize2 size={15} />
        </button>
      </div>
    </main>
  );
}

function App() {
  const isMiniWindow = new URLSearchParams(window.location.search).get("mini") === "1";

  if (isMiniWindow) {
    return <MiniFloatingPlayer />;
  }

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const equalizerFiltersRef = useRef<BiquadFilterNode[]>([]);
  const visualizerFrameRef = useRef<number | null>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const fadingOutRef = useRef(false);
  const restartRef = useRef<number | null>(null);
  const pressedKeysRef = useRef(new Set<string>());
  const queueHoverStartedRef = useRef(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [query, setQuery] = useState("");
  const [importMode, setImportMode] = useState<"files" | "folder" | null>(null);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [renamePlaylistName, setRenamePlaylistName] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playlistMessage, setPlaylistMessage] = useState<string | null>(null);
  const [currentLyric, setCurrentLyric] = useState<Lyric | null>(null);
  const [lyricMessage, setLyricMessage] = useState<string | null>(null);
  const [isImportingLyric, setIsImportingLyric] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("library");
  const [queueTrackIds, setQueueTrackIds] = useState<string[]>([]);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("loop");
  const [repeatOne, setRepeatOne] = useState(false);
  const [barLevels, setBarLevels] = useState(idleBarLevels);
  const [pendingDeletePlaylist, setPendingDeletePlaylist] = useState<Playlist | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [equalizerSettings, setEqualizerSettings] = useState<EqualizerSettings>(() => readEqualizerSettings());

  const isImporting = importMode !== null;
  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null;
  const playlistTracks = selectedPlaylist
    ? tracks.filter((track) => selectedPlaylist.trackIds.includes(track.id))
    : [];
  const viewTracks = activeView === "playlist" ? playlistTracks : tracks;
  const filteredTracks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return viewTracks;
    }

    return viewTracks.filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(keyword));
  }, [query, viewTracks]);
  const currentTrack = tracks.find((track) => track.id === currentTrackId) ?? null;
  const queueTracks = queueTrackIds
    .map((trackId) => tracks.find((track) => track.id === trackId))
    .filter((track): track is Track => Boolean(track));
  const playbackTracks = queueTracks.length > 0 ? queueTracks : viewTracks.length > 0 ? viewTracks : tracks;
  const selectedTrackCount = selectedTrackIds.length;
  const allVisibleTracksSelected =
    filteredTracks.length > 0 && filteredTracks.every((track) => selectedTrackIds.includes(track.id));
  const currentIndex = currentTrack
    ? playbackTracks.findIndex((track) => track.id === currentTrack.id)
    : -1;
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const lyricLines = useMemo(() => parseLyricLines(currentLyric?.content ?? ""), [currentLyric]);
  const activeLyricIndex = lyricLines.reduce(
    (activeIndex, line, index) => (line.time !== null && line.time <= currentTime ? index : activeIndex),
    -1
  );
  const pageTitle =
    activeView === "library"
      ? "乐库"
      : activeView === "lyrics"
        ? "正在播放"
        : activeView === "equalizer"
          ? "均衡器"
          : selectedPlaylist?.name ?? "歌单";
  const sectionTitle = activeView === "playlist" ? selectedPlaylist?.name ?? "歌单" : "本地专辑流";
  const appVisualStyle = visualStyle(`${currentTrack?.title ?? "ZZmusic"}${currentTrack?.artist ?? ""}`);
  const sectionVideo = sectionVideos[activeView];
  const showLibraryTools = activeView === "library" || activeView === "playlist";

  useEffect(() => {
    Promise.all([window.zzmusic.getLibrary(), window.zzmusic.getPlaylists()])
      .then(([libraryTracks, savedPlaylists]) => {
        setTracks(libraryTracks);
        setPlaylists(savedPlaylists);
        setSelectedPlaylistId(savedPlaylists[0]?.id ?? null);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const video = backgroundVideoRef.current;
    if (!video) {
      return;
    }

    video.style.opacity = "0";
    fadingOutRef.current = false;
    if (restartRef.current) {
      window.clearTimeout(restartRef.current);
    }

    const handleCanPlay = () => {
      video.play().catch(() => undefined);
      fadingOutRef.current = false;
      fadeVideo(video, 1);
    };

    const handleTimeUpdate = () => {
      if (!video.duration || fadingOutRef.current) {
        return;
      }

      if (video.duration - video.currentTime <= 0.55) {
        fadingOutRef.current = true;
        fadeVideo(video, 0);
      }
    };

    const handleEnded = () => {
      video.style.opacity = "0";
      restartRef.current = window.setTimeout(() => {
        video.currentTime = 0;
        fadingOutRef.current = false;
        video.play().catch(() => undefined);
        fadeVideo(video, 1);
      }, 100);
    };

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      if (restartRef.current) {
        window.clearTimeout(restartRef.current);
      }
    };
  }, [activeView]);

  useEffect(() => {
    if (selectedPlaylistId && !playlists.some((playlist) => playlist.id === selectedPlaylistId)) {
      setSelectedPlaylistId(playlists[0]?.id ?? null);
    }
  }, [playlists, selectedPlaylistId]);

  useEffect(() => {
    setRenamePlaylistName(selectedPlaylist?.name ?? "");
  }, [selectedPlaylist?.id, selectedPlaylist?.name]);

  useEffect(() => {
    if (!currentTrackId) {
      setCurrentLyric(null);
      return;
    }

    window.zzmusic.getLyrics(currentTrackId).then(setCurrentLyric).catch(() => setCurrentLyric(null));
  }, [currentTrackId]);

  useEffect(() => {
    if (currentTrackId && !tracks.some((track) => track.id === currentTrackId)) {
      setCurrentTrackId(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [currentTrackId, tracks]);

  useEffect(() => {
    setSelectedTrackIds((ids) => ids.filter((trackId) => tracks.some((track) => track.id === trackId)));
  }, [tracks]);

  useEffect(() => {
    if (activeView !== "library") {
      setIsBatchMode(false);
      setSelectedTrackIds([]);
    }
  }, [activeView]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    try {
      window.localStorage.setItem(equalizerStorageKey, JSON.stringify(equalizerSettings));
    } catch {
      // localStorage can fail in restricted profiles; audio should keep working.
    }

    updateEqualizerFilters(equalizerSettings);
  }, [equalizerSettings]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!currentTrack) {
      audio.pause();
      audio.removeAttribute("src");
      return;
    }

    if (audio.src !== currentTrack.audioUrl) {
      audio.src = currentTrack.audioUrl;
      audio.load();
    }

    if (isPlaying) {
      audio.play().catch(() => {
        setIsPlaying(false);
        setPlaybackError("播放失败：文件可能已移动、被删除，或当前格式暂不支持。");
      });
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (visualizerFrameRef.current) {
      cancelAnimationFrame(visualizerFrameRef.current);
      visualizerFrameRef.current = null;
    }

    if (!isPlaying || !currentTrackId) {
      setBarLevels(idleBarLevels);
      return;
    }

    let isCancelled = false;
    const data = new Uint8Array(64);

    ensureAudioAnalyser()
      .then((analyser) => {
        if (!analyser || isCancelled) {
          return;
        }

        const render = () => {
          analyser.getByteTimeDomainData(data);
          setBarLevels(buildBarLevels(data));
          visualizerFrameRef.current = requestAnimationFrame(render);
        };

        render();
      })
      .catch(() => setBarLevels(idleBarLevels));

    return () => {
      isCancelled = true;
      if (visualizerFrameRef.current) {
        cancelAnimationFrame(visualizerFrameRef.current);
        visualizerFrameRef.current = null;
      }
    };
  }, [currentTrackId, isPlaying]);

  async function handleImportTracks() {
    setImportMode("files");
    try {
      setTracks(await window.zzmusic.importTracks());
    } finally {
      setImportMode(null);
    }
  }

  async function handleImportTrackFolder() {
    setImportMode("folder");
    try {
      setTracks(await window.zzmusic.importTrackFolder());
    } finally {
      setImportMode(null);
    }
  }

  async function handleRemoveTrack(trackId: string) {
    setTracks(await window.zzmusic.removeTrack(trackId));
    setPlaylists(await window.zzmusic.getPlaylists());
  }

  async function handleCreatePlaylist() {
    const playlistName = newPlaylistName.trim();
    if (!playlistName) {
      setPlaylistMessage("请输入歌单名称。");
      return;
    }

    if (playlists.some((playlist) => playlist.name === playlistName)) {
      setPlaylistMessage(`“${playlistName}”已经存在。`);
      return;
    }

    setIsCreatingPlaylist(true);
    setPlaylistMessage(null);
    try {
      const nextPlaylists = await window.zzmusic.createPlaylist(playlistName);
      setPlaylists(nextPlaylists);
      setSelectedPlaylistId(nextPlaylists.at(-1)?.id ?? null);
      setActiveView("playlist");
      setNewPlaylistName("");
      setPlaylistMessage(`已创建歌单“${playlistName}”。`);
    } catch {
      setPlaylistMessage("创建失败，请稍后重试。");
    } finally {
      setIsCreatingPlaylist(false);
    }
  }

  async function handleAddTrackToPlaylist(trackId: string, playlistId: string) {
    const currentPlaylist = playlists.find((playlist) => playlist.id === playlistId);
    if (currentPlaylist?.trackIds.includes(trackId)) {
      setPlaylistMessage(`这首歌已在“${currentPlaylist.name}”中。`);
      return;
    }

    try {
      const nextPlaylists = await window.zzmusic.addTrackToPlaylist(playlistId, trackId);
      const targetPlaylist = nextPlaylists.find((playlist) => playlist.id === playlistId);
      setPlaylists(nextPlaylists);
      setPlaylistMessage(targetPlaylist ? `已添加到“${targetPlaylist.name}”。` : "已添加到歌单。");
    } catch {
      setPlaylistMessage("添加失败，请稍后重试。");
    }
  }

  async function handleAddSelectedTracksToPlaylist(playlistId: string) {
    const currentPlaylist = playlists.find((playlist) => playlist.id === playlistId);
    const pendingTrackIds = selectedTrackIds.filter((trackId) => !currentPlaylist?.trackIds.includes(trackId));
    if (pendingTrackIds.length === 0) {
      setPlaylistMessage("已在歌单中。");
      return;
    }

    try {
      let nextPlaylists = playlists;
      for (const trackId of pendingTrackIds) {
        nextPlaylists = await window.zzmusic.addTrackToPlaylist(playlistId, trackId);
      }
      const targetPlaylist = nextPlaylists.find((playlist) => playlist.id === playlistId);
      setPlaylists(nextPlaylists);
      setSelectedTrackIds([]);
      setPlaylistMessage(
        targetPlaylist ? `已添加 ${pendingTrackIds.length} 首到“${targetPlaylist.name}”。` : "已添加到歌单。"
      );
    } catch {
      setPlaylistMessage("添加失败，请稍后重试。");
    }
  }

  function toggleTrackSelection(trackId: string) {
    setSelectedTrackIds((ids) =>
      ids.includes(trackId) ? ids.filter((id) => id !== trackId) : [...ids, trackId]
    );
  }

  function toggleVisibleTrackSelection() {
    const visibleTrackIds = filteredTracks.map((track) => track.id);
    setSelectedTrackIds((ids) =>
      allVisibleTracksSelected
        ? ids.filter((trackId) => !visibleTrackIds.includes(trackId))
        : Array.from(new Set([...ids, ...visibleTrackIds]))
    );
  }

  function toggleBatchMode() {
    setIsBatchMode((enabled) => {
      if (enabled) {
        setSelectedTrackIds([]);
      }
      return !enabled;
    });
  }

  async function handleRemoveSelectedTracks() {
    if (selectedTrackIds.length === 0) {
      return;
    }

    const trackIdsToRemove = selectedTrackIds;
    try {
      let nextTracks = tracks;
      for (const trackId of trackIdsToRemove) {
        nextTracks = await window.zzmusic.removeTrack(trackId);
      }
      setTracks(nextTracks);
      setPlaylists(await window.zzmusic.getPlaylists());
      setQueueTrackIds((ids) => ids.filter((trackId) => !trackIdsToRemove.includes(trackId)));
      setSelectedTrackIds([]);
      setIsBatchMode(false);
      setPlaylistMessage("已删除所选歌曲。");
    } catch {
      setPlaylistMessage("删除失败，请稍后重试。");
    }
  }

  async function handleRenameSelectedPlaylist() {
    if (!selectedPlaylist) {
      return;
    }

    const playlistName = renamePlaylistName.trim();
    if (!playlistName) {
      setPlaylistMessage("请输入新的歌单名称。");
      return;
    }

    if (playlistName === selectedPlaylist.name) {
      setPlaylistMessage("歌单名称没有变化。");
      return;
    }

    if (playlists.some((playlist) => playlist.id !== selectedPlaylist.id && playlist.name === playlistName)) {
      setPlaylistMessage(`“${playlistName}”已经存在。`);
      return;
    }

    try {
      const nextPlaylists = await window.zzmusic.renamePlaylist(selectedPlaylist.id, playlistName);
      setPlaylists(nextPlaylists);
      setSelectedPlaylistId(selectedPlaylist.id);
      setPlaylistMessage(`已重命名为“${playlistName}”。`);
    } catch {
      setPlaylistMessage("重命名失败，请稍后重试。");
    }
  }

  async function handleDeleteSelectedPlaylist() {
    if (!selectedPlaylist) {
      return;
    }

    setPendingDeletePlaylist(selectedPlaylist);
  }

  async function confirmDeletePlaylist() {
    const playlist = pendingDeletePlaylist;
    if (!playlist) {
      return;
    }

    try {
      const nextPlaylists = await window.zzmusic.deletePlaylist(playlist.id);
      setPlaylists(nextPlaylists);
      setSelectedPlaylistId(nextPlaylists[0]?.id ?? null);
      setQueueTrackIds((ids) =>
        ids.some((trackId) => playlist.trackIds.includes(trackId)) ? [] : ids
      );
      setPendingDeletePlaylist(null);
      setPlaylistMessage(null);
    } catch {
      setPlaylistMessage("删除失败，请稍后重试。");
    }
  }

  async function handleRemoveFromSelectedPlaylist(trackId: string) {
    if (selectedPlaylistId) {
      setPlaylists(await window.zzmusic.removeTrackFromPlaylist(selectedPlaylistId, trackId));
    }
  }

  async function handleImportLyrics() {
    if (!currentTrack) {
      setLyricMessage("请先播放或选择一首歌曲。");
      return;
    }

    setIsImportingLyric(true);
    setLyricMessage(null);
    try {
      const lyric = await window.zzmusic.importLyrics(currentTrack.id);
      setCurrentLyric(lyric);
      setLyricMessage(lyric ? `已导入歌词：${lyric.fileName}` : "未选择歌词文件。");
      if (lyric) {
        setActiveView("lyrics");
      }
    } catch {
      setLyricMessage("歌词导入失败，请确认文件编码或格式。");
    } finally {
      setIsImportingLyric(false);
    }
  }

  function openLyricsView() {
    if (!currentTrack) {
      setLyricMessage("请先播放或选择一首歌曲。");
      return;
    }

    setActiveView("lyrics");
  }

  function updateEqualizerFilters(settings: EqualizerSettings) {
    const context = audioContextRef.current;
    if (!context) {
      return;
    }

    equalizerFiltersRef.current.forEach((filter, index) => {
      const gain = settings.enabled ? settings.gains[index] ?? 0 : 0;
      filter.gain.setTargetAtTime(gain, context.currentTime, 0.015);
    });
  }

  function createEqualizerFilters(context: AudioContext, settings: EqualizerSettings): BiquadFilterNode[] {
    return equalizerBands.map((band, index) => {
      const filter = context.createBiquadFilter();
      filter.type = index === 0 ? "lowshelf" : index === equalizerBands.length - 1 ? "highshelf" : "peaking";
      filter.frequency.value = band.frequency;
      filter.Q.value = 1;
      filter.gain.value = settings.enabled ? settings.gains[index] ?? 0 : 0;
      return filter;
    });
  }

  function setEqualizerEnabled(enabled: boolean) {
    setEqualizerSettings((settings) => ({ ...settings, enabled }));
  }

  function applyEqualizerPreset(preset: EqualizerNamedPreset) {
    setEqualizerSettings((settings) => ({
      enabled: true,
      preset,
      gains: [...equalizerPresets[preset].gains]
    }));
  }

  function handleEqualizerBandChange(index: number, value: string) {
    const gain = Number(value);
    setEqualizerSettings((settings) => {
      const gains = [...settings.gains];
      gains[index] = Number.isFinite(gain) ? gain : 0;
      return { ...settings, preset: "custom", gains };
    });
  }

  function resetEqualizer() {
    setEqualizerSettings({
      enabled: false,
      preset: "flat",
      gains: [...equalizerPresets.flat.gains]
    });
  }

  async function ensureAudioAnalyser(): Promise<AnalyserNode | null> {
    const audio = audioRef.current;
    if (!audio) {
      return null;
    }

    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;

    if (!analyserRef.current || !audioSourceRef.current) {
      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      const source = context.createMediaElementSource(audio);
      const filters = createEqualizerFilters(context, equalizerSettings);
      source.connect(filters[0]);
      filters.forEach((filter, index) => {
        filter.connect(filters[index + 1] ?? analyser);
      });
      analyser.connect(context.destination);
      audioSourceRef.current = source;
      analyserRef.current = analyser;
      equalizerFiltersRef.current = filters;
    }

    if (context.state === "suspended") {
      await context.resume();
    }

    return analyserRef.current;
  }

  function playTrack(trackId: string, sourceTracks = viewTracks) {
    setPlaybackError(null);
    setQueueTrackIds(sourceTracks.map((track) => track.id));
    setCurrentTrackId(trackId);
    setIsPlaying(true);
    ensureAudioAnalyser().catch(() => undefined);
  }

  function togglePlay() {
    if (!currentTrack && tracks[0]) {
      playTrack(viewTracks[0]?.id ?? tracks[0].id, viewTracks.length > 0 ? viewTracks : tracks);
      return;
    }

    if (!isPlaying) {
      ensureAudioAnalyser().catch(() => undefined);
    }

    setIsPlaying((playing) => !playing);
  }

  function playTrackNext(trackId: string) {
    if (!currentTrackId) {
      playTrack(trackId, playbackTracks);
      return;
    }

    setQueueTrackIds((ids) => {
      const baseIds = ids.length > 0 ? ids : playbackTracks.map((track) => track.id);
      const nextIds = baseIds.filter((id) => id !== trackId);
      const currentQueueIndex = nextIds.indexOf(currentTrackId);
      const insertAt = currentQueueIndex >= 0 ? currentQueueIndex + 1 : 0;
      return [...nextIds.slice(0, insertAt), trackId, ...nextIds.slice(insertAt)];
    });
    setPlaylistMessage("已加入下一首播放。");
  }

  function playPrevious() {
    if (playbackTracks.length === 0) {
      return;
    }

    if (playbackMode === "shuffle") {
      playRandom();
      return;
    }

    const previousIndex = currentIndex > 0 ? currentIndex - 1 : playbackTracks.length - 1;
    playTrack(playbackTracks[previousIndex].id, playbackTracks);
  }

  function playNext() {
    if (playbackTracks.length === 0) {
      return;
    }

    if (playbackMode === "shuffle") {
      playRandom();
      return;
    }

    const nextIndex = currentIndex >= 0 && currentIndex < playbackTracks.length - 1 ? currentIndex + 1 : 0;
    playTrack(playbackTracks[nextIndex].id, playbackTracks);
  }

  function playRandom() {
    if (playbackTracks.length === 0) {
      return;
    }

    const candidates =
      playbackTracks.length > 1
        ? playbackTracks.filter((track) => track.id !== currentTrackId)
        : playbackTracks;
    const randomTrack = candidates[Math.floor(Math.random() * candidates.length)];
    playTrack(randomTrack.id, playbackTracks);
  }

  function handleEnded() {
    if (repeatOne && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(handlePlaybackError);
      return;
    }

    if (playbackTracks.length > 1) {
      playNext();
      return;
    }

    setIsPlaying(false);
    setCurrentTime(0);
  }

  function handlePlaybackError() {
    setIsPlaying(false);
    setPlaybackError("播放失败：文件可能已移动、被删除，或当前格式暂不支持。");
  }

  function handleSeek(value: string) {
    const seconds = Number(value);
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) {
      return;
    }

    audio.currentTime = seconds;
    setCurrentTime(seconds);
  }

  async function handleToggleFullscreen() {
    setIsFullscreen(await window.zzmusic.windowControls.toggleFullscreen());
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTextInputTarget(event.target)) {
        return;
      }

      pressedKeysRef.current.add(event.key);

      if (!event.ctrlKey && event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) {
          togglePlay();
        }
        return;
      }

      if (event.ctrlKey && event.key === "ArrowLeft") {
        event.preventDefault();
        if (!event.repeat) {
          playPrevious();
        }
        return;
      }

      if (event.ctrlKey && event.key === "ArrowRight") {
        event.preventDefault();
        if (!event.repeat) {
          playNext();
        }
        return;
      }

      if (event.ctrlKey && event.key === "ArrowUp") {
        event.preventDefault();
        setVolume((value) => Math.min(100, value + 5));
        return;
      }

      if (event.ctrlKey && event.key === "ArrowDown") {
        event.preventDefault();
        setVolume((value) => Math.max(0, value - 5));
        return;
      }

      if (
        !event.ctrlKey &&
        pressedKeysRef.current.has("ArrowDown") &&
        pressedKeysRef.current.has("ArrowRight")
      ) {
        event.preventDefault();
        setIsPlaying(false);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      pressedKeysRef.current.delete(event.key);
    }

    function handleBlur() {
      pressedKeysRef.current.clear();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  });

  useEffect(() => {
    return window.zzmusic.onPlayerCommand((command) => {
      if (command === "previous") {
        playPrevious();
      } else if (command === "toggle-play") {
        togglePlay();
      } else if (command === "volume-up") {
        setVolume((value) => Math.min(100, value + 5));
      } else if (command === "volume-down") {
        setVolume((value) => Math.max(0, value - 5));
      } else {
        playNext();
      }
    });
  });

  return (
    <main
      className={`app-shell section-${activeView} ${activeView === "lyrics" ? "immersive-mode" : ""}`}
      style={appVisualStyle}
    >
      <video
        ref={backgroundVideoRef}
        className="scene-video"
        src={sectionVideo}
        muted
        autoPlay
        playsInline
        preload="auto"
        style={{ opacity: 0 }}
        aria-hidden="true"
      />
      <div className="scene-scrim" />
      <div className="window-drag-region" aria-hidden="true" />
      <div className="window-controls" aria-label="窗口控制">
        <button type="button" aria-label="最小化" onClick={() => void window.zzmusic.windowControls.minimize()}>
          <Minus size={15} />
        </button>
        <button
          type="button"
          aria-label={isFullscreen ? "退出全屏" : "全屏"}
          onClick={() => void handleToggleFullscreen()}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        <button className="close" type="button" aria-label="关闭" onClick={() => void window.zzmusic.windowControls.close()}>
          <X size={15} />
        </button>
      </div>

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <img src={appIconUrl} alt="" />
          </div>
          <strong>music</strong>
        </div>

        <nav className="nav-list" aria-label="主导航">
          <button
            className={`nav-item ${activeView === "library" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveView("library")}
          >
            <Library size={18} />
            <span>乐库</span>
          </button>
          <button
            className={`nav-item ${activeView === "playlist" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveView("playlist")}
          >
            <ListMusic size={18} />
            <span>歌单</span>
          </button>
          <button
            className={`nav-item ${activeView === "lyrics" ? "active" : ""}`}
            type="button"
            onClick={openLyricsView}
            disabled={!currentTrack}
          >
            <Disc3 size={18} />
            <span>正在播放</span>
          </button>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            {activeView !== "lyrics" && <h1>{pageTitle}</h1>}
          </div>

          {showLibraryTools && (
            <div className="library-tools">
              <label className="search">
                <Search size={16} />
                <input
                  placeholder="搜索本地歌曲"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>

              <div className="import-actions">
                <button
                  className="import-button"
                  type="button"
                  onClick={handleImportTracks}
                  disabled={isImporting}
                >
                  <Plus size={18} />
                  <span>{importMode === "files" ? "导入中" : "导入音乐"}</span>
                </button>
                <button
                  className="import-button"
                  type="button"
                  onClick={handleImportTrackFolder}
                  disabled={isImporting}
                >
                  <FolderSearch size={18} />
                  <span>{importMode === "folder" ? "扫描中" : "扫描文件夹"}</span>
                </button>
              </div>
            </div>
          )}
        </header>

        {activeView === "lyrics" ? (
          <section
            className={`now-playing-page view-panel ${isPlaying ? "is-playing" : ""}`}
            aria-label="正在播放沉浸页"
            key="lyrics"
          >
            <div className="blur-backdrop" />
            <div className="now-playing-visual">
              <h2>正在播放</h2>
              <div className="immersive-cover" style={visualStyle(`${currentTrack?.title ?? ""}${currentTrack?.artist ?? ""}`)}>
                <div className={`audio-response ${isPlaying ? "is-active" : ""}`} aria-hidden="true">
                  {barLevels.map((level, index) => (
                    <i
                      key={index}
                      style={
                        {
                          "--bar-index": index,
                          "--bar-level": level
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="lyrics-card">
              <div className="vinyl-orbit">
                <div className="vinyl-disc">
                  <span />
                </div>
                <div>
                  <p className="eyebrow">{currentTrack?.artist ?? "Local Music"}</p>
                  <h2>{currentTrack?.title ?? "未播放"}</h2>
                  <span>{currentLyric?.fileName ?? "未导入歌词"}</span>
                </div>
              </div>

              {lyricMessage && <div className="playlist-message">{lyricMessage}</div>}

              {currentLyric && lyricLines.length > 0 ? (
                <div className="lyrics-scroll" aria-label="歌词滚动页面">
                  {lyricLines.map((line, index) => (
                    <p
                      className={index === activeLyricIndex ? "active" : ""}
                      key={`${line.time ?? "plain"}-${index}`}
                    >
                      {line.text}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>{currentTrack ? "还没有歌词" : "还没有正在播放的歌曲"}</strong>
                  <span>
                    {currentTrack
                      ? "导入 .lrc 或 .txt 歌词后，会在这里显示。"
                      : "先播放一首歌曲，再进入正在播放页。"}
                  </span>
                  {currentTrack && (
                    <button type="button" onClick={handleImportLyrics} disabled={isImportingLyric}>
                      <FileText size={16} />
                      <span>{isImportingLyric ? "导入中" : "导入歌词"}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        ) : activeView === "equalizer" ? (
          <section className="equalizer-page view-panel" key="equalizer" aria-label="10 段均衡器">
            <div className="equalizer-head">
              <div>
                <p className="eyebrow">Equalizer</p>
                <h2>10 段声音均衡器</h2>
                <span>调节从 32Hz 到 16kHz 的频率响应，设置会自动保存。</span>
              </div>
              <label className="equalizer-switch">
                <input
                  type="checkbox"
                  checked={equalizerSettings.enabled}
                  onChange={(event) => setEqualizerEnabled(event.target.checked)}
                />
                <span>{equalizerSettings.enabled ? "已启用" : "已关闭"}</span>
              </label>
            </div>

            <div className="equalizer-presets" aria-label="均衡器预设">
              {(Object.keys(equalizerPresets) as EqualizerNamedPreset[]).map((preset) => (
                <button
                  className={equalizerSettings.preset === preset ? "active" : ""}
                  type="button"
                  key={preset}
                  onClick={() => applyEqualizerPreset(preset)}
                >
                  {equalizerPresets[preset].label}
                </button>
              ))}
              <button className="equalizer-reset" type="button" onClick={resetEqualizer}>
                <RotateCcw size={15} />
                <span>重置</span>
              </button>
            </div>

            <div className="equalizer-bands" aria-label="频段增益">
              {equalizerBands.map((band, index) => {
                const gain = equalizerSettings.gains[index] ?? 0;
                return (
                  <label className="equalizer-band" key={band.frequency}>
                    <span>{formatGain(gain)}</span>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={gain}
                      aria-label={`${band.label}Hz`}
                      onChange={(event) => handleEqualizerBandChange(index, event.target.value)}
                    />
                    <strong>{band.label}</strong>
                  </label>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="library-panel view-panel" key={activeView}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{activeView === "library" ? "Library" : "Playlist"}</p>
                <h2>{sectionTitle}</h2>
              </div>
              <span>{viewTracks.length} 首</span>
            </div>

            {activeView === "library" && filteredTracks.length > 0 && (
              <div className="bulk-actions">
                <button type="button" onClick={toggleBatchMode}>
                  {isBatchMode ? "完成" : "批量"}
                </button>
                {isBatchMode && (
                  <>
                    <button
                      className="bulk-select"
                      type="button"
                      title={allVisibleTracksSelected ? "取消全选" : "全选当前列表"}
                      onClick={toggleVisibleTrackSelection}
                    >
                      {allVisibleTracksSelected ? "取消全选" : "全选"}
                    </button>
                    <span>{selectedTrackCount} 首</span>
                    {selectedTrackCount > 0 && playlists.length > 0 && (
                      <details className="playlist-menu bulk-menu">
                        <summary className="icon-button" title="加入歌单" aria-label="加入歌单">
                          <Plus size={16} />
                        </summary>
                        <div className="playlist-menu-list">
                          {playlists.map((playlist) => (
                            <button
                              type="button"
                              key={playlist.id}
                              onClick={(event) => {
                                void handleAddSelectedTracksToPlaylist(playlist.id);
                                event.currentTarget.closest("details")?.removeAttribute("open");
                              }}
                            >
                              {playlist.name}
                            </button>
                          ))}
                        </div>
                      </details>
                    )}
                    <button
                      className="icon-button danger"
                      type="button"
                      title="删除所选歌曲"
                      aria-label="删除所选歌曲"
                      disabled={selectedTrackCount === 0}
                      onClick={handleRemoveSelectedTracks}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            )}


            {activeView === "playlist" && (
              <div className="playlist-area">
                <form
                  className="playlist-create"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleCreatePlaylist();
                  }}
                >
                  <input
                    value={newPlaylistName}
                    placeholder="新建歌单名称"
                    onChange={(event) => setNewPlaylistName(event.target.value)}
                  />
                  <button type="submit" disabled={isCreatingPlaylist}>
                    <Plus size={16} />
                    <span>{isCreatingPlaylist ? "创建中" : "创建"}</span>
                  </button>
                </form>
                {playlistMessage && <div className="playlist-message">{playlistMessage}</div>}

                {playlists.length > 0 ? (
                  <div className="playlist-grid" aria-label="歌单列表">
                    {playlists.map((playlist) => (
                      <button
                        className={`playlist-tile ${playlist.id === selectedPlaylistId ? "active" : ""}`}
                        type="button"
                        key={playlist.id}
                        onClick={() => setSelectedPlaylistId(playlist.id)}
                        style={visualStyle(playlist.name)}
                      >
                        <span className="mini-cover">{initials(playlist.name)}</span>
                        <strong>{playlist.name}</strong>
                        <small>{playlist.trackIds.length} 首</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="playlist-summary">
                    <div className="mini-cover">Z</div>
                    <div>
                      <strong>还没有歌单</strong>
                      <span>创建歌单后，可以从乐库把歌曲添加进来。</span>
                    </div>
                  </div>
                )}

                {selectedPlaylist && (
                  <div className="playlist-editor">
                    <input
                      value={renamePlaylistName}
                      aria-label="歌单新名称"
                      onChange={(event) => setRenamePlaylistName(event.target.value)}
                    />
                    <button type="button" onClick={handleRenameSelectedPlaylist}>
                      保存
                    </button>
                    <button className="danger" type="button" onClick={handleDeleteSelectedPlaylist}>
                      删除
                    </button>
                  </div>
                )}
              </div>
            )}

            {filteredTracks.length > 0 ? (
              <div className="media-grid">
                {filteredTracks.map((track, index) => (
                  <article
                    className={`media-card ${track.id === currentTrackId ? "active" : ""} ${
                      selectedTrackIds.includes(track.id) ? "selected" : ""
                    }`}
                    style={{ ...visualStyle(`${track.title}${track.artist}`), "--row-index": index } as CSSProperties}
                    key={track.id}
                  >
                    {activeView === "library" && isBatchMode && (
                      <label className="track-check" title="选择">
                        <input
                          type="checkbox"
                          checked={selectedTrackIds.includes(track.id)}
                          onChange={() => toggleTrackSelection(track.id)}
                        />
                        <span />
                      </label>
                    )}
                    <button
                      className="media-cover"
                      type="button"
                      title={track.filePath}
                      onClick={() => playTrack(track.id, filteredTracks)}
                    >
                      <span>{initials(track.title)}</span>
                      <Play size={22} fill="currentColor" />
                    </button>
                    <div className="media-meta">
                      <button type="button" onClick={() => playTrack(track.id, filteredTracks)}>
                        <strong>{track.title}</strong>
                        <small>{track.artist}</small>
                      </button>
                      <span>{track.id === currentTrackId ? formatTime(duration) : "本地音频"}</span>
                    </div>
                    <div className="card-actions">
                      <button
                        className="icon-button"
                        type="button"
                        title="下一首播放"
                        aria-label={`下一首播放 ${track.title}`}
                        onClick={() => playTrackNext(track.id)}
                      >
                        <SkipForward size={15} />
                      </button>
                      {activeView === "library" && playlists.length > 0 && (
                        <details className="playlist-menu">
                          <summary title="添加到歌单" aria-label={`添加 ${track.title} 到歌单`}>
                            <Plus size={16} />
                          </summary>
                          <div className="playlist-menu-list">
                            {playlists.map((playlist) => (
                              <button
                                type="button"
                                key={playlist.id}
                                onClick={(event) => {
                                  handleAddTrackToPlaylist(track.id, playlist.id);
                                  event.currentTarget.closest("details")?.removeAttribute("open");
                                }}
                              >
                                {playlist.name}
                              </button>
                            ))}
                          </div>
                        </details>
                      )}
                      <button
                        className="icon-button danger"
                        type="button"
                        aria-label={
                          activeView === "playlist"
                            ? `从当前歌单移除 ${track.title}`
                            : `从乐库移除 ${track.title}`
                        }
                        onClick={() =>
                          activeView === "playlist"
                            ? handleRemoveFromSelectedPlaylist(track.id)
                            : handleRemoveTrack(track.id)
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>
                  {tracks.length === 0
                    ? "还没有本地音乐"
                    : activeView === "playlist" && playlists.length === 0
                      ? "还没有歌单"
                      : "没有匹配的歌曲"}
                </strong>
                <span>
                  {tracks.length === 0
                    ? "导入 mp3、wav、flac 或 m4a 文件后会显示在这里。"
                    : activeView === "playlist" && playlists.length === 0
                      ? "先创建一个歌单，再从乐库添加歌曲。"
                      : "换个关键词试试。"}
                </span>
                {tracks.length === 0 && (
                  <div className="import-actions">
                    <button type="button" onClick={handleImportTracks} disabled={isImporting}>
                      <Plus size={16} />
                      <span>{importMode === "files" ? "导入中" : "导入音乐"}</span>
                    </button>
                    <button type="button" onClick={handleImportTrackFolder} disabled={isImporting}>
                      <FolderSearch size={16} />
                      <span>{importMode === "folder" ? "扫描中" : "扫描文件夹"}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </section>

      {pendingDeletePlaylist && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setPendingDeletePlaylist(null)}>
          <section
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-playlist-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-icon danger">
              <Trash2 size={19} />
            </div>
            <div>
              <p className="eyebrow">删除歌单</p>
              <h2 id="delete-playlist-title">删除“{pendingDeletePlaylist.name}”？</h2>
              <p>歌曲仍会保留在乐库里，只会移除这个歌单。</p>
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={() => setPendingDeletePlaylist(null)}>
                取消
              </button>
              <button className="danger" type="button" onClick={confirmDeletePlaylist}>
                删除
              </button>
            </div>
          </section>
        </div>
      )}

      {playbackError && (
        <div className="playback-alert" role="alert">
          <AlertCircle size={18} />
          <span>{playbackError}</span>
          <button type="button" aria-label="关闭播放失败提示" onClick={() => setPlaybackError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      <footer className={`player-bar ${isPlaying ? "is-playing" : ""}`}>
        <button
          className="now-playing"
          type="button"
          onClick={openLyricsView}
          disabled={!currentTrack}
          title={currentTrack ? "打开正在播放页" : "先播放一首歌曲"}
        >
          <div className="cover-art" style={visualStyle(`${currentTrack?.title ?? ""}${currentTrack?.artist ?? ""}`)}>
            <span>{initials(currentTrack?.title ?? "Z")}</span>
          </div>
          <div>
            <strong>{currentTrack?.title ?? "未播放"}</strong>
            <span>
              {currentTrack?.artist ??
                (tracks.length > 0 ? `${tracks.length} 首歌曲已就绪` : "导入音乐后开始播放")}
            </span>
          </div>
        </button>

        <div className="transport">
          <div className="transport-buttons">
            <button
              className={repeatOne ? "mode-active" : ""}
              type="button"
              aria-label="单曲循环"
              onClick={() => setRepeatOne((enabled) => !enabled)}
              disabled={tracks.length === 0}
            >
              <Repeat1 size={17} />
            </button>
            <button type="button" aria-label="上一首" onClick={playPrevious} disabled={tracks.length === 0}>
              <SkipBack size={18} fill="currentColor" />
            </button>
            <button
              className="play-button"
              type="button"
              aria-label={isPlaying ? "暂停" : "播放"}
              onClick={togglePlay}
              disabled={tracks.length === 0}
            >
              <span className="play-button-icon" key={isPlaying ? "pause" : "play"}>
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </span>
            </button>
            <button type="button" aria-label="下一首" onClick={playNext} disabled={tracks.length === 0}>
              <SkipForward size={18} fill="currentColor" />
            </button>
            <button
              className={playbackMode === "shuffle" ? "mode-active" : ""}
              type="button"
              aria-label="随机播放"
              onClick={() => setPlaybackMode("shuffle")}
              disabled={tracks.length === 0}
            >
              <Shuffle size={17} />
            </button>
            <button
              className={playbackMode === "loop" ? "mode-active" : ""}
              type="button"
              aria-label="列表循环"
              onClick={() => setPlaybackMode("loop")}
              disabled={tracks.length === 0}
            >
              <Repeat size={17} />
            </button>
          </div>
          <div className="timeline">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              style={{ "--range-fill": `${progressPercent}%` } as CSSProperties}
              aria-label="播放进度"
              disabled={!currentTrack || duration === 0}
              onChange={(event) => handleSeek(event.target.value)}
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div
          className={`queue-menu ${isQueueOpen ? "is-open" : ""}`}
          onMouseLeave={() => {
            if (queueHoverStartedRef.current) {
              queueHoverStartedRef.current = false;
              setIsQueueOpen(false);
            }
          }}
        >
          <button
            className="queue-trigger"
            type="button"
            aria-label="播放队列"
            aria-expanded={isQueueOpen}
            onClick={() => {
              queueHoverStartedRef.current = false;
              setIsQueueOpen((open) => !open);
            }}
          >
            <ListMusic size={17} />
            <span>{playbackTracks.length}</span>
          </button>
          {isQueueOpen && (
            <div className="queue-popover" onMouseEnter={() => { queueHoverStartedRef.current = true; }}>
              <div className="queue-head">
                <strong>队列</strong>
                <span>{playbackTracks.length} 首</span>
              </div>
              <div className="queue-list">
                {playbackTracks.map((track, index) => (
                  <button
                    className={track.id === currentTrackId ? "active" : ""}
                    type="button"
                    key={`${track.id}-${index}`}
                    onClick={() => {
                      playTrack(track.id, playbackTracks);
                      queueHoverStartedRef.current = false;
                      setIsQueueOpen(false);
                    }}
                  >
                    <span>{index + 1}</span>
                    <strong>{track.title}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          className={`equalizer-trigger ${activeView === "equalizer" ? "mode-active" : ""}`}
          type="button"
          aria-label="打开均衡器"
          title="均衡器"
          onClick={() => setActiveView("equalizer")}
        >
          <SlidersHorizontal size={17} />
        </button>

        <div className="volume">
          <Volume2 size={18} />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            style={{ "--range-fill": `${volume}%` } as CSSProperties}
            aria-label="音量"
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>
      </footer>
      <audio
        ref={audioRef}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
          setPlaybackError(null);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={handleEnded}
        onError={handlePlaybackError}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
    </main>
  );
}

export default App;
