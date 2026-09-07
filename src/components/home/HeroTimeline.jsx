import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, ZoomIn, LayoutGrid, Settings } from 'lucide-react';
import './HeroTimeline.css';

const videoClips = [
  { id: 1, track: 'V3', start: 15, width: 20, label: 'Motion Preset', color: 'var(--cat-motion-graphics)' },
  { id: 2, track: 'V3', start: 40, width: 15, label: 'Overlay', color: 'var(--cat-overlays)' },
  
  { id: 3, track: 'V2', start: 5, width: 35, label: 'LUT Pack', color: 'var(--cat-luts)' },
  { id: 4, track: 'V2', start: 45, width: 25, label: 'Color Grade', color: 'var(--cat-presets)' },
  
  { id: 5, track: 'V1', start: 0, width: 50, label: 'YouTube Pack', color: 'var(--cat-templates)' },
  { id: 6, track: 'V1', start: 50, width: 10, label: 'Transition', color: 'var(--cat-transitions)' },
  { id: 7, track: 'V1', start: 60, width: 40, label: 'Typography Pack', color: 'var(--cat-editing-packs)' }
];

const audioClips = [
  { id: 8, track: 'A1', start: 0, width: 100, label: 'Main Audio', color: 'var(--cat-project-files)' },
  { id: 9, track: 'A2', start: 10, width: 20, label: 'Sound FX', color: 'var(--cat-sfx)' },
  { id: 10, track: 'A2', start: 60, width: 15, label: 'Sound FX', color: 'var(--cat-sfx)' },
];

const rulerMarks = ["00:00", "00:01", "00:02", "00:03", "00:04", "00:05", "00:06", "00:07", "00:08", "00:09", "00:10"];

function Waveform({ width }) {
  // Generate random waveform paths
  const bars = Array.from({ length: Math.floor(width / 3) }, (_, i) => {
    const height = 20 + Math.random() * 60; // 20% to 80% height
    return (
      <rect 
        key={i} 
        x={i * 4} 
        y={50 - height / 2} 
        width="2" 
        height={height} 
        rx="1" 
        fill="currentColor" 
        opacity="0.6" 
      />
    );
  });

  return (
    <svg className="waveform-svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      {bars}
    </svg>
  );
}

export default function HeroTimeline() {
  const [isPlaying, setIsPlaying] = useState(true);
  const allClips = [...videoClips, ...audioClips];

  return (
    <div className="hero-timeline">
      {/* Toolbar */}
      <div className="timeline-toolbar">
        <div className="toolbar-left">
          <button 
            className={`toolbar-btn ${isPlaying ? 'active' : ''}`}
            onClick={() => setIsPlaying(true)}
          >
            <Play size={14} />
          </button>
          <button 
            className={`toolbar-btn ${!isPlaying ? 'active' : ''}`}
            onClick={() => setIsPlaying(false)}
          >
            <Pause size={14} />
          </button>
        </div>
        <div className="toolbar-center">
          <span className="timecode">00:02:14:08</span>
        </div>
        <div className="toolbar-right">
          <button className="toolbar-btn"><ZoomIn size={14} /></button>
          <button className="toolbar-btn"><LayoutGrid size={14} /></button>
          <button className="toolbar-btn"><Settings size={14} /></button>
        </div>
      </div>

      <div className="timeline-body">
        {/* Track Headers */}
        <div className="timeline-headers">
          <div className="header-spacer" /> {/* For Ruler */}
          <div className="track-header">V3</div>
          <div className="track-header">V2</div>
          <div className="track-header">V1</div>
          <div className="track-divider" />
          <div className="track-header">A1</div>
          <div className="track-header">A2</div>
        </div>

        {/* Timeline Tracks Area */}
        <div className="timeline-tracks-area">
          {/* Ruler */}
          <div className="timeline-ruler">
            {rulerMarks.map((mark, i) => (
              <div key={i} className="ruler-mark" style={{ left: `${(i / (rulerMarks.length - 1)) * 100}%` }}>
                <span className="ruler-text">{mark}</span>
                <div className="ruler-tick" />
              </div>
            ))}
          </div>

          {/* Grid Lines */}
          <div className="timeline-grid">
            {rulerMarks.map((_, i) => (
              <div key={i} className="grid-line" style={{ left: `${(i / (rulerMarks.length - 1)) * 100}%` }} />
            ))}
          </div>

          {/* Playhead (GPU Accelerated Transform) */}
          <div className="timeline-playhead-track">
            <div className={`playhead-scale-container ${isPlaying ? 'playing' : 'paused'}`}>
              <div className="timeline-playhead">
                <div className="playhead-head" />
                <div className="playhead-line" />
              </div>
            </div>
          </div>

          {/* Tracks */}
          <div className="timeline-tracks">
            {['V3', 'V2', 'V1'].map(trackId => (
              <div key={trackId} className="timeline-track">
                {videoClips.filter(c => c.track === trackId).map((clip, i) => (
                  <motion.div
                    key={clip.id}
                    className="timeline-clip video-clip"
                    style={{ 
                      left: `${clip.start}%`, 
                      width: `calc(${clip.width}% - 2px)`,
                      '--clip-color': clip.color
                    }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 + i * 0.1 }}
                    whileHover={{ translateY: -6, scale: 1.02 }}
                  >
                    <span className="clip-label">{clip.label}</span>
                  </motion.div>
                ))}
              </div>
            ))}

            <div className="track-divider-line" />

            {['A1', 'A2'].map(trackId => (
              <div key={trackId} className="timeline-track audio-track">
                {audioClips.filter(c => c.track === trackId).map((clip, i) => (
                  <motion.div
                    key={clip.id}
                    className="timeline-clip audio-clip"
                    style={{ 
                      left: `${clip.start}%`, 
                      width: `calc(${clip.width}% - 2px)`,
                      '--clip-color': clip.color
                    }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
                    whileHover={{ translateY: -6, scale: 1.02 }}
                  >
                    <Waveform width={clip.width * 10} />
                    <span className="clip-label audio-label">{clip.label}</span>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
