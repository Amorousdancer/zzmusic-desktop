import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Library,
  ListMusic,
  Pause,
  Play,
  Plus,
  Search,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  X
} from "lucide-react";

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

function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [query, setQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const filteredTracks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return tracks;
    }

    return tracks.filter((track) =>
      `${track.title} ${track.artist}`.toLowerCase().includes(keyword)
    );
  }, [query, tracks]);
  const currentTrack = tracks.find((track) => track.id === currentTrackId) ?? null;
  const currentIndex = currentTrack
    ? tracks.findIndex((track) => track.id === currentTrack.id)
    : -1;

  useEffect(() => {
    window.zzmusic.getLibrary().then(setTracks).catch(console.error);
  }, []);

  useEffect(() => {
    if (currentTrackId && !tracks.some((track) => track.id === currentTrackId)) {
      setCurrentTrackId(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [currentTrackId, tracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = volume / 100;
  }, [volume]);

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

  async function handleImportTracks() {
    setIsImporting(true);
    try {
      setTracks(await window.zzmusic.importTracks());
    } finally {
      setIsImporting(false);
    }
  }

  async function handleRemoveTrack(trackId: string) {
    setTracks(await window.zzmusic.removeTrack(trackId));
  }

  function playTrack(trackId: string) {
    setPlaybackError(null);
    setCurrentTrackId(trackId);
    setIsPlaying(true);
  }

  function togglePlay() {
    if (!currentTrack && tracks[0]) {
      playTrack(tracks[0].id);
      return;
    }

    setIsPlaying((playing) => !playing);
  }

  function playPrevious() {
    if (tracks.length === 0) {
      return;
    }

    const previousIndex = currentIndex > 0 ? currentIndex - 1 : tracks.length - 1;
    playTrack(tracks[previousIndex].id);
  }

  function playNext() {
    if (tracks.length === 0) {
      return;
    }

    const nextIndex = currentIndex >= 0 && currentIndex < tracks.length - 1 ? currentIndex + 1 : 0;
    playTrack(tracks[nextIndex].id);
  }

  function handleEnded() {
    if (tracks.length > 1) {
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Z</div>
          <div>
            <strong>ZZmusic</strong>
            <span>Local Player</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          <button className="nav-item active" type="button">
            <Library size={18} />
            <span>资料库</span>
          </button>
          <button className="nav-item" type="button">
            <ListMusic size={18} />
            <span>歌曲</span>
          </button>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="window-actions">
            <button type="button" aria-label="后退">
              <ChevronLeft size={18} />
            </button>
            <button type="button" aria-label="前进">
              <ChevronRight size={18} />
            </button>
          </div>

          <label className="search">
            <Search size={16} />
            <input
              placeholder="搜索本地歌曲"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <button
            className="import-button"
            type="button"
            onClick={handleImportTracks}
            disabled={isImporting}
          >
            <Plus size={18} />
            <span>{isImporting ? "导入中" : "导入音乐"}</span>
          </button>
        </header>

        <section className="hero" aria-label="当前资料库">
          <div>
            <p>Windows 本地音乐播放器</p>
            <h1>ZZmusic</h1>
          </div>
          <button className="primary-action" type="button" onClick={handleImportTracks}>
            <Play size={18} fill="currentColor" />
            <span>{tracks.length > 0 ? "继续导入" : "开始体验"}</span>
          </button>
        </section>

        <section className="library-panel">
          <div className="section-heading">
            <h2>歌曲</h2>
            <span>{tracks.length} 首</span>
          </div>

          {filteredTracks.length > 0 ? (
            <div className="track-list">
              {filteredTracks.map((track, index) => (
                <div
                  className={`track-row ${track.id === currentTrackId ? "active" : ""}`}
                  key={track.id}
                >
                  <span className="track-index">{index + 1}</span>
                  <button
                    className="track-title"
                    type="button"
                    title={track.filePath}
                    onClick={() => playTrack(track.id)}
                  >
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                  </button>
                  <span className="track-time">
                    {track.id === currentTrackId ? formatTime(duration) : "--:--"}
                  </span>
                  <button
                    className="track-remove"
                    type="button"
                    aria-label={`从播放列表移除 ${track.title}`}
                    onClick={() => handleRemoveTrack(track.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>{tracks.length === 0 ? "还没有本地音乐" : "没有匹配的歌曲"}</strong>
              <span>
                {tracks.length === 0
                  ? "导入 mp3、wav、flac 或 m4a 文件后会显示在这里。"
                  : "换个关键词试试。"}
              </span>
              {tracks.length === 0 && (
                <button type="button" onClick={handleImportTracks}>
                  <Plus size={16} />
                  <span>导入音乐</span>
                </button>
              )}
            </div>
          )}
        </section>
      </section>

      {playbackError && (
        <div className="playback-alert" role="alert">
          <AlertCircle size={18} />
          <span>{playbackError}</span>
          <button type="button" aria-label="关闭播放失败提示" onClick={() => setPlaybackError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      <footer className="player-bar">
        <div className="now-playing">
          <div className="cover-art">Z</div>
          <div>
            <strong>{currentTrack?.title ?? "未播放"}</strong>
            <span>
              {currentTrack?.artist ??
                (tracks.length > 0 ? `${tracks.length} 首歌曲已就绪` : "导入音乐后开始播放")}
            </span>
          </div>
        </div>

        <div className="transport">
          <div className="transport-buttons">
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
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button type="button" aria-label="下一首" onClick={playNext} disabled={tracks.length === 0}>
              <SkipForward size={18} fill="currentColor" />
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
              aria-label="播放进度"
              disabled={!currentTrack || duration === 0}
              onChange={(event) => handleSeek(event.target.value)}
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="volume">
          <Volume2 size={18} />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
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
