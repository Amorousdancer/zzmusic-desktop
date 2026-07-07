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
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  X
} from "lucide-react";

type ActiveView = "library" | "playlist";
type PlaybackMode = "loop" | "shuffle";

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
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [query, setQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("library");
  const [queueTrackIds, setQueueTrackIds] = useState<string[]>([]);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("loop");
  const [repeatOne, setRepeatOne] = useState(false);

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

    return viewTracks.filter((track) =>
      `${track.title} ${track.artist}`.toLowerCase().includes(keyword)
    );
  }, [query, viewTracks]);
  const currentTrack = tracks.find((track) => track.id === currentTrackId) ?? null;
  const queueTracks = queueTrackIds
    .map((trackId) => tracks.find((track) => track.id === trackId))
    .filter((track): track is Track => Boolean(track));
  const playbackTracks = queueTracks.length > 0 ? queueTracks : viewTracks.length > 0 ? viewTracks : tracks;
  const currentIndex = currentTrack
    ? playbackTracks.findIndex((track) => track.id === currentTrack.id)
    : -1;
  const pageTitle = activeView === "library" ? "ZZmusic" : selectedPlaylist?.name ?? "歌单";
  const pageEyebrow = activeView === "library" ? "Windows 本地音乐播放器" : "本地音乐歌单";
  const sectionTitle = activeView === "library" ? "歌曲" : selectedPlaylist?.name ?? "歌单";

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
    if (selectedPlaylistId && !playlists.some((playlist) => playlist.id === selectedPlaylistId)) {
      setSelectedPlaylistId(playlists[0]?.id ?? null);
    }
  }, [playlists, selectedPlaylistId]);

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
    setPlaylists(await window.zzmusic.getPlaylists());
  }

  async function handleCreatePlaylist() {
    const playlistName = newPlaylistName.trim();
    if (!playlistName) {
      return;
    }

    const nextPlaylists = await window.zzmusic.createPlaylist(playlistName);
    setPlaylists(nextPlaylists);
    setSelectedPlaylistId(nextPlaylists.at(-1)?.id ?? null);
    setActiveView("playlist");
    setNewPlaylistName("");
  }

  async function handleAddTrackToPlaylist(trackId: string, playlistId: string) {
    if (!playlistId) {
      return;
    }

    setPlaylists(await window.zzmusic.addTrackToPlaylist(playlistId, trackId));
  }

  async function handleRemoveFromSelectedPlaylist(trackId: string) {
    if (!selectedPlaylistId) {
      return;
    }

    setPlaylists(await window.zzmusic.removeTrackFromPlaylist(selectedPlaylistId, trackId));
  }

  function playTrack(trackId: string, sourceTracks = viewTracks) {
    setPlaybackError(null);
    setQueueTrackIds(sourceTracks.map((track) => track.id));
    setCurrentTrackId(trackId);
    setIsPlaying(true);
  }

  function togglePlay() {
    if (!currentTrack && tracks[0]) {
      playTrack(viewTracks[0]?.id ?? tracks[0].id, viewTracks.length > 0 ? viewTracks : tracks);
      return;
    }

    setIsPlaying((playing) => !playing);
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
          <button
            className={`nav-item ${activeView === "library" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveView("library")}
          >
            <Library size={18} />
            <span>资料库</span>
          </button>
          <button
            className={`nav-item ${activeView === "playlist" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveView("playlist")}
          >
            <ListMusic size={18} />
            <span>歌单</span>
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
            <p>{pageEyebrow}</p>
            <h1>{pageTitle}</h1>
          </div>
          <button className="primary-action" type="button" onClick={handleImportTracks}>
            <Play size={18} fill="currentColor" />
            <span>{tracks.length > 0 ? "继续导入" : "开始体验"}</span>
          </button>
        </section>

        <section className="library-panel">
          <div className="section-heading">
            <h2>{sectionTitle}</h2>
            <span>{viewTracks.length} 首</span>
          </div>

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
                <button type="submit">
                  <Plus size={16} />
                  <span>创建</span>
                </button>
              </form>

              {playlists.length > 0 ? (
                <div className="playlist-tabs" aria-label="歌单列表">
                  {playlists.map((playlist) => (
                    <button
                      className={playlist.id === selectedPlaylistId ? "active" : ""}
                      type="button"
                      key={playlist.id}
                      onClick={() => setSelectedPlaylistId(playlist.id)}
                    >
                      {playlist.name}
                      <span>{playlist.trackIds.length}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="playlist-summary">
                  <div className="playlist-cover">Z</div>
                  <div>
                    <strong>还没有歌单</strong>
                    <span>创建歌单后，可以从资料库把歌曲添加进来。</span>
                  </div>
                </div>
              )}

              {selectedPlaylist && (
                <div className="playlist-summary">
                  <div className="playlist-cover">Z</div>
                  <div>
                    <strong>{selectedPlaylist.name}</strong>
                    <span>从资料库选择歌曲右侧的歌单，即可添加到这里。</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === "library" && playlists.length === 0 && (
            <div className="playlist-hint">
              <span>想给歌曲分组？先到“歌单”里创建一个自定义歌单。</span>
            </div>
          )}

          {filteredTracks.length > 0 ? (
            <div className="track-list">
              {filteredTracks.map((track, index) => (
                <div
                  className={`track-row ${activeView === "library" ? "with-playlist" : ""} ${
                    track.id === currentTrackId ? "active" : ""
                  }`}
                  key={track.id}
                >
                  <span className="track-index">{index + 1}</span>
                  <button
                    className="track-title"
                    type="button"
                    title={track.filePath}
                    onClick={() => playTrack(track.id, filteredTracks)}
                  >
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                  </button>
                  <span className="track-time">
                    {track.id === currentTrackId ? formatTime(duration) : "--:--"}
                  </span>
                  {activeView === "library" && (
                    <select
                      className="playlist-select"
                      value=""
                      aria-label={`添加 ${track.title} 到歌单`}
                      disabled={playlists.length === 0}
                      onChange={(event) => handleAddTrackToPlaylist(track.id, event.target.value)}
                    >
                      <option value="">添加到歌单</option>
                      {playlists.map((playlist) => (
                        <option value={playlist.id} key={playlist.id}>
                          {playlist.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    className="track-remove"
                    type="button"
                    aria-label={
                      activeView === "playlist"
                        ? `从当前歌单移除 ${track.title}`
                        : `从资料库移除 ${track.title}`
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
                    ? "先创建一个歌单，再从资料库添加歌曲。"
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
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
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
