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

const demoTracks = [
  { title: "等待导入的歌曲", artist: "ZZmusic", time: "--:--" },
  { title: "本地音乐库", artist: "Windows x64", time: "--:--" },
  { title: "浅色播放器界面", artist: "Apple Music inspired", time: "--:--" }
];

function App() {
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
            <input placeholder="搜索本地歌曲" />
          </label>

          <button className="import-button" type="button">
            <Plus size={18} />
            <span>导入音乐</span>
          </button>
        </header>

        <section className="hero" aria-label="当前资料库">
          <div>
            <p>Windows 本地音乐播放器</p>
            <h1>ZZmusic</h1>
          </div>
          <button className="primary-action" type="button">
            <Play size={18} fill="currentColor" />
            <span>开始体验</span>
          </button>
        </section>

        <section className="library-panel">
          <div className="section-heading">
            <h2>歌曲</h2>
            <span>{demoTracks.length} 首</span>
          </div>

          <div className="track-list">
            {demoTracks.map((track, index) => (
              <button className="track-row" type="button" key={track.title}>
                <span className="track-index">{index + 1}</span>
                <span className="track-title">
                  <strong>{track.title}</strong>
                  <small>{track.artist}</small>
                </span>
                <span className="track-time">{track.time}</span>
                <span className="track-remove" aria-label="从播放列表移除">
                  <Trash2 size={16} />
                </span>
              </button>
            ))}
          </div>
        </section>
      </section>

      <footer className="player-bar">
        <div className="now-playing">
          <div className="cover-art">Z</div>
          <div>
            <strong>未播放</strong>
            <span>导入音乐后开始播放</span>
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
