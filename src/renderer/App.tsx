import { useEffect, useMemo, useState } from "react";
import {
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
  Volume2
} from "lucide-react";

function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [query, setQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const filteredTracks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return tracks;
    }

    return tracks.filter((track) =>
      `${track.title} ${track.artist}`.toLowerCase().includes(keyword)
    );
  }, [query, tracks]);

  useEffect(() => {
    window.zzmusic.getLibrary().then(setTracks).catch(console.error);
  }, []);

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
                <div className="track-row" key={track.id}>
                  <span className="track-index">{index + 1}</span>
                  <button className="track-title" type="button" title={track.filePath}>
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                  </button>
                  <span className="track-time">--:--</span>
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

      <footer className="player-bar">
        <div className="now-playing">
          <div className="cover-art">Z</div>
          <div>
            <strong>未播放</strong>
            <span>{tracks.length > 0 ? `${tracks.length} 首歌曲已就绪` : "导入音乐后开始播放"}</span>
          </div>
        </div>

        <div className="transport">
          <div className="transport-buttons">
            <button type="button" aria-label="上一首">
              <SkipBack size={18} fill="currentColor" />
            </button>
            <button className="play-button" type="button" aria-label="播放或暂停">
              <Pause size={20} fill="currentColor" />
            </button>
            <button type="button" aria-label="下一首">
              <SkipForward size={18} fill="currentColor" />
            </button>
          </div>
          <div className="timeline">
            <span>0:00</span>
            <input type="range" min="0" max="100" defaultValue="0" aria-label="播放进度" />
            <span>0:00</span>
          </div>
        </div>

        <div className="volume">
          <Volume2 size={18} />
          <input type="range" min="0" max="100" defaultValue="70" aria-label="音量" />
        </div>
      </footer>
    </main>
  );
}

export default App;
