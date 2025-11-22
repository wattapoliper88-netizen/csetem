import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { getMe, deleteUser, toggleBanUser, toggleAdmin } from '../api/auth';
import { getMessages, sendMessage, getMyConversation, listConversations, getFolders, closeFolder as apiFolderClose, deleteMessages as apiDeleteMessages } from '../api/chat';
import { getSocket } from '../socket';
import { useNavigate } from 'react-router-dom';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { updateAvatar } from '../api/client';

// Egységes backend URL
const API_URL = import.meta.env.VITE_API_URL || 'https://csetem.onrender.com';

// Custom Audio Player Component
// Global map to store audio seek and pause callbacks for position sync and single playback
interface AudioCallbacks {
  seekAndPlay: (position: number) => void; // Seek to position and start playing
  seekOnly: (position: number) => void; // Only seek without starting playback
  pause: () => void;
  isPlaying: () => boolean; // Check if audio is currently playing
}
const audioRefsMap = new Map<string, AudioCallbacks>();
(window as any).audioRefsMap = audioRefsMap;

// Format duration helper function
const formatDuration = (time: number) => {
  if (isNaN(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// YouTube video ID extractor supporting multiple share URL formats
const extractYouTubeVideoId = (url: string): string | null => {
  try {
    // Remove potential tracking params
    const cleaned = url.split('&list=')[0];
    const u = new URL(cleaned);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      return u.pathname.slice(1) || null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      // /watch?v=ID
      if (u.pathname === '/watch') {
        return u.searchParams.get('v');
      }
      // /shorts/ID
      if (u.pathname.startsWith('/shorts/')) {
        return u.pathname.split('/')[2] || null;
      }
      // /live/ID
      if (u.pathname.startsWith('/live/')) {
        return u.pathname.split('/')[2] || null;
      }
      // /embed/ID
      if (u.pathname.startsWith('/embed/')) {
        return u.pathname.split('/')[2] || null;
      }
    }
    return null;
  } catch {
    return null;
  }
};

const CustomAudioPlayer: React.FC<{ 
  src: string; 
  type: string; 
  thumbnail?: string;
  messageId?: string;
  conversationId?: string;
  otherUserPlaying?: { userId: string; position: number; username: string } | null;
  onDisconnectOtherUser?: () => void;
  isCollapsedFirstAudio?: boolean;
  fileName?: string;
  playlist?: Array<{ url: string; fileName: string }>;
}> = ({ src, type, thumbnail, messageId, conversationId, otherUserPlaying, onDisconnectOtherUser, isCollapsedFirstAudio, fileName, playlist }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
  const [playlistDurations, setPlaylistDurations] = useState<number[]>([]);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [shareLivePosition, setShareLivePosition] = useState(true);
  const livePositionIntervalRef = useRef<number | null>(null);
  const isMobileViewport = typeof window !== 'undefined' ? window.innerWidth < 640 : false;

  // Register this audio player in the global map with seek and pause callbacks
  useEffect(() => {
    if (messageId) {
      const seekAndPlay = (position: number) => {
        if (audioRef.current) {
          // Stop all other audio players before starting this one
          audioRefsMap.forEach((callbacks, id) => {
            if (id !== messageId && callbacks.pause) {
              callbacks.pause();
            }
          });
          
          audioRef.current.currentTime = position;
          setCurrentTime(position);
          audioRef.current.play();
          setIsPlaying(true);
          console.log(`✅ Successfully seeked to ${position}s and started playback for message ${messageId}`);
        }
      };

      const seekOnly = (position: number) => {
        if (audioRef.current) {
          audioRef.current.currentTime = position;
          setCurrentTime(position);
          console.log(`📍 Position updated to ${position}s for message ${messageId} (without playing)`);
        }
      };

      const pausePlayback = () => {
        if (audioRef.current && isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      };

      const getIsPlaying = () => {
        return isPlaying;
      };
      
      audioRefsMap.set(messageId, { seekAndPlay, seekOnly, pause: pausePlayback, isPlaying: getIsPlaying });
      console.log('📍 Registered audio player with seek callback:', messageId);
      
      return () => {
        audioRefsMap.delete(messageId);
        console.log('📍 Unregistered audio player:', messageId);
      };
    }
  }, [messageId, isPlaying]);

  // Load durations for all playlist items
  useEffect(() => {
    if (playlist && playlist.length > 0) {
      const loadDurations = async () => {
        const durations: number[] = [];
        for (const item of playlist) {
          const audio = new Audio(item.url);
          await new Promise<void>((resolve) => {
            audio.addEventListener('loadedmetadata', () => {
              durations.push(audio.duration);
              resolve();
            });
            audio.addEventListener('error', () => {
              durations.push(0);
              resolve();
            });
          });
        }
        setPlaylistDurations(durations);
      };
      loadDurations();
    }
  }, [playlist]);

  // Draw animated circular waveform
  const drawWaveform = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas with full transparency
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerY = canvas.height / 2;
    const time = Date.now() * 0.002;
    const points = 100;
    
    // Draw multiple wave layers
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      
      for (let i = 0; i <= points; i++) {
        const x = (i / points) * canvas.width;
        const frequency = 2 + layer * 0.5;
        const amplitude = 15 + layer * 8;
        const phase = time + layer * Math.PI / 3;
        
        const y = centerY + 
                  Math.sin((i / points) * Math.PI * frequency + phase) * amplitude +
                  Math.sin((i / points) * Math.PI * frequency * 2.5 + phase * 1.5) * (amplitude * 0.4);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      // Create gradient stroke
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, layer === 0 ? '#22d3ee' : layer === 1 ? '#06b6d4' : '#14b8a6');
      gradient.addColorStop(0.5, layer === 0 ? '#06b6d4' : layer === 1 ? '#14b8a6' : '#0891b2');
      gradient.addColorStop(1, layer === 0 ? '#14b8a6' : layer === 1 ? '#0891b2' : '#0e7490');
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3 - layer * 0.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      // Add glow effect
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#06b6d4';
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      drawWaveform();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Send live position to other users
  useEffect(() => {
    if (isPlaying && shareLivePosition && messageId && conversationId) {
      // Send position every 2 seconds while playing
      livePositionIntervalRef.current = window.setInterval(() => {
        const socket = (window as any).socket;
        if (socket && audioRef.current) {
          socket.emit('audio-position', {
            conversationId,
            messageId,
            position: audioRef.current.currentTime
          });
        }
      }, 2000);
    } else {
      if (livePositionIntervalRef.current) {
        clearInterval(livePositionIntervalRef.current);
        livePositionIntervalRef.current = null;
      }
    }
    
    return () => {
      if (livePositionIntervalRef.current) {
        clearInterval(livePositionIntervalRef.current);
      }
    };
  }, [isPlaying, shareLivePosition, messageId, conversationId]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        // Start closing animation
        setIsClosing(true);
        setTimeout(() => {
          audioRef.current?.pause();
          setIsPlaying(false);
          setIsClosing(false);
        }, 400); // Match slideUp animation duration
      } else {
        // Stop all other audio players before starting this one
        audioRefsMap.forEach((callbacks, id) => {
          if (id !== messageId && callbacks.pause) {
            callbacks.pause();
          }
        });
        
        setIsClosing(false);
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    
    // For playlist, calculate which track and position to seek to
    if (playlist && playlist.length > 0 && playlistDurations.length > 0) {
      let remainingTime = time;
      let targetTrackIndex = 0;
      
      // Find which track the seek time falls into
      for (let i = 0; i < playlistDurations.length; i++) {
        if (remainingTime <= playlistDurations[i]) {
          targetTrackIndex = i;
          break;
        }
        remainingTime -= playlistDurations[i];
      }
      
      // If seeking to a different track, change track
      if (targetTrackIndex !== currentPlaylistIndex) {
        const wasPlaying = isPlaying;
        setCurrentPlaylistIndex(targetTrackIndex);
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.currentTime = remainingTime;
            setCurrentTime(remainingTime);
            if (wasPlaying) {
              audioRef.current.play();
            }
          }
        }, 100);
      } else {
        // Same track, just seek
        if (audioRef.current) {
          audioRef.current.currentTime = remainingTime;
          setCurrentTime(remainingTime);
        }
      }
    } else {
      // Normal single track seek
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    if (vol > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className={`w-full ${isMobileViewport ? 'max-w-[280px]' : 'max-w-[360px]'} sm:max-w-full rounded-lg p-2 md:p-3 transition-all duration-300 overflow-hidden ${
      isCollapsedFirstAudio 
        ? 'bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-cyan-500/20' 
        : 'bg-transparent'
    }`}>
      <audio
        ref={audioRef}
        src={playlist && playlist.length > 0 ? playlist[currentPlaylistIndex].url : src}
        data-message-id={messageId}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          if (playlist && playlist.length > 0 && currentPlaylistIndex < playlist.length - 1) {
            // Play next track in playlist
            setCurrentPlaylistIndex(prev => prev + 1);
            setCurrentTime(0);
            if (audioRef.current) {
              audioRef.current.load();
              audioRef.current.play();
            }
          } else {
            setIsPlaying(false);
            if (playlist && playlist.length > 0) {
              setCurrentPlaylistIndex(0); // Reset to first track
            }
          }
        }}
      >
        <source src={playlist && playlist.length > 0 ? playlist[currentPlaylistIndex].url : src} type={type} />
      </audio>
      
      {/* Waveform Visualizer - Only shown when playing */}
      {(isPlaying || isClosing) && !isMobileViewport && (
        <div className={`mb-2 ${isClosing ? 'animate-slideUp' : 'animate-slideDown'}`}>
          <canvas
            ref={canvasRef}
            width={600}
            height={60}
            className={`w-full h-14 md:h-20 rounded-lg ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
            style={{ display: 'block' }}
          />
        </div>
      )}
      
      {/* Controls Container */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Audio Thumbnail */}
        {thumbnail ? (
          <img 
            src={thumbnail} 
            alt="Audio thumbnail"
            className={`w-12 h-12 sm:w-14 sm:h-14 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-lg object-cover flex-shrink-0 border-2 transition-all duration-500 ${
              isPlaying 
                ? `opacity-100 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.6),0_0_40px_rgba(6,182,212,0.4),0_0_60px_rgba(6,182,212,0.2)] scale-105 brightness-110 ${isCollapsedFirstAudio ? '' : 'animate-pulse'}` 
                : 'opacity-50 border-cyan-500/30 shadow-[0_8px_30px_rgba(6,182,212,0.4)]'
            }`}
          />
        ) : (
          <img 
            src="/assets/zene.gif" 
            alt="Audio"
            className={`w-12 h-12 sm:w-14 sm:h-14 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-lg object-cover flex-shrink-0 border-2 transition-all duration-500 ${
              isPlaying 
                ? `opacity-100 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.6),0_0_40px_rgba(6,182,212,0.4),0_0_60px_rgba(6,182,212,0.2)] scale-105 brightness-110 ${isCollapsedFirstAudio ? '' : 'animate-pulse'}` 
                : 'opacity-50 border-cyan-500/30 shadow-[0_8px_30px_rgba(6,182,212,0.4)]'
            }`}
          />
        )}
        
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900 rounded-full hover:from-gray-600 hover:to-gray-800 transition-all shadow-lg flex-shrink-0 border border-cyan-500/30 hover:border-cyan-400/50"
        >
        {isPlaying ? (
          <svg className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 ml-0.5 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* File name and Progress Bar */}
      <div className="flex-1 flex flex-col gap-1">
        {fileName && (
          <p className="text-[10px] sm:text-[11px] md:text-sm text-cyan-300 font-medium truncate px-1 max-w-[160px] sm:max-w-none">
            🎵 {(playlist && playlist.length > 0 ? playlist[currentPlaylistIndex].fileName : fileName).split(' ').slice(0, 5).join(' ')}{(playlist && playlist.length > 0 ? playlist[currentPlaylistIndex].fileName : fileName).split(' ').length > 5 ? '...' : ''}
            {playlist && playlist.length > 1 && <span className="text-[9px] sm:text-xs text-gray-400 ml-2">({currentPlaylistIndex + 1}/{playlist.length})</span>}
          </p>
        )}
        
        <div className="flex items-center gap-1 sm:gap-2">
          {(() => {
            // Calculate total duration and current position for playlist
            if (playlist && playlist.length > 0 && playlistDurations.length > 0) {
              const totalDuration = playlistDurations.reduce((sum, d) => sum + d, 0);
              const elapsedFromPrevious = playlistDurations.slice(0, currentPlaylistIndex).reduce((sum, d) => sum + d, 0);
              const totalCurrentTime = elapsedFromPrevious + currentTime;
              const progressPercent = (totalCurrentTime / totalDuration) * 100;
              
              return (
                <>
                  <span className="text-[9px] sm:text-xs text-gray-400">{formatDuration(totalCurrentTime)}</span>
                  <input
                    type="range"
                    min="0"
                    max={totalDuration || 0}
                    value={totalCurrentTime}
                    onChange={handleSeek}
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="flex-1 h-2 bg-transparent appearance-none cursor-pointer audio-slider"
                    style={{
                      background: `linear-gradient(to right, rgba(6, 182, 212, 0.6) 0%, rgba(6, 182, 212, 0.6) ${progressPercent}%, rgba(255, 255, 255, 0.2) ${progressPercent}%, rgba(255, 255, 255, 0.2) 100%)`,
                      boxShadow: otherUserPlaying && !isPlaying ? '0 0 12px 2px rgba(239, 68, 68, 0.6), 0 0 24px 4px rgba(239, 68, 68, 0.3)' : undefined
                    }}
                  />
                  <span className="text-[9px] sm:text-xs text-gray-400">{formatDuration(totalDuration)}</span>
                </>
              );
            }
            
            // Normal single track display
            return (
              <>
                <span className="text-[9px] sm:text-xs text-gray-400">{formatDuration(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex-1 h-2 bg-transparent appearance-none cursor-pointer audio-slider"
                  style={{
                    background: `linear-gradient(to right, rgba(6, 182, 212, 0.6) 0%, rgba(6, 182, 212, 0.6) ${(currentTime / duration) * 100}%, rgba(255, 255, 255, 0.2) ${(currentTime / duration) * 100}%, rgba(255, 255, 255, 0.2) 100%)`,
                    boxShadow: otherUserPlaying && !isPlaying ? '0 0 12px 2px rgba(239, 68, 68, 0.6), 0 0 24px 4px rgba(239, 68, 68, 0.3)' : undefined
                  }}
                />
                <span className="text-[9px] sm:text-xs text-gray-400">{formatDuration(duration)}</span>
              </>
            );
          })()}
        </div>
      </div>

      {/* Volume Controls */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="w-8 h-8 flex items-center justify-center text-cyan-500 hover:text-cyan-400 transition-colors"
          >
            {isMuted || volume === 0 ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
              </svg>
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-12 sm:w-16 md:w-20 h-2 bg-transparent appearance-none cursor-pointer audio-slider"
            style={{
              background: `linear-gradient(to right, rgba(6, 182, 212, 0.6) 0%, rgba(6, 182, 212, 0.6) ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.2) ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.2) 100%)`
            }}
          />
        </div>
        
        {/* Other User Listening Status or Live Sharing Toggle */}
        <div className="flex items-center gap-2">
          {messageId && conversationId && (
            otherUserPlaying ? (
              // Show who is listening with disconnect button
              <>
                <div className="px-2 py-1 bg-cyan-600/20 border border-cyan-500/30 rounded flex items-center gap-2">
                  <span className="text-cyan-300 text-xs">🎧</span>
                  <span className="text-xs text-cyan-300 font-mono">
                    {formatDuration(otherUserPlaying.position)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShareLivePosition(false);
                    if (onDisconnectOtherUser) {
                      onDisconnectOtherUser();
                    }
                  }}
                  className="px-2 py-1 text-xs bg-red-600/40 hover:bg-red-600/60 text-red-100 rounded border border-red-500/30 transition-colors"
                  title="Kapcsolat megszakítása"
                >
                  ✕
                </button>
              </>
            ) : (
              // Show live sharing toggle when nobody is listening
              <button
                onClick={() => setShareLivePosition(!shareLivePosition)}
                className={`px-2 py-1 text-xs rounded border transition-colors whitespace-nowrap ${
                  shareLivePosition 
                    ? 'bg-green-600/40 hover:bg-green-600/60 text-green-100 border-green-500/30' 
                    : 'bg-gray-600/40 hover:bg-gray-600/60 text-gray-300 border-gray-500/30'
                }`}
                title={shareLivePosition ? 'Élő megosztás bekapcsolva' : 'Élő megosztás kikapcsolva'}
              >
                {shareLivePosition ? '📡 Élő' : '📡 Ki'}
              </button>
            )
          )}
        </div>
        
        {/* Send Position Button */}
        {messageId && conversationId && (
          <button
            onClick={() => {
              console.log('📍 Pozíció küldése gombra kattintás');
              console.log('📍 Adatok:', { conversationId, messageId, position: currentTime });
              const socket = (window as any).socket;
              console.log('📍 Socket létezik?', !!socket);
              console.log('📍 Socket csatlakozva?', socket?.connected);
              if (socket) {
                socket.emit('audio-position', {
                  conversationId,
                  messageId,
                  position: currentTime
                });
                console.log('📍 audio-position esemény elküldve');
              } else {
                console.error('❌ Nincs socket kapcsolat!');
              }
            }}
            className="px-2 py-1 text-xs bg-cyan-600/40 hover:bg-cyan-600/60 text-cyan-100 rounded border border-cyan-500/30 transition-colors whitespace-nowrap"
            title="Pozíció küldése"
          >
            📍 Pozíció küldése
          </button>
        )}
      </div>
      </div>
    </div>
  );
};

export const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem('accessToken');
  
  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
    }
  }, [accessToken, navigate]);
  
  const { data: me, isLoading: meLoading, refetch: refetchMe } = useQuery('me', getMe, {
    enabled: !!accessToken,
    onError: () => {
      localStorage.removeItem('accessToken');
      navigate('/login');
    },
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTextLength, setTypingTextLength] = useState(0);
  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [messageReactions, setMessageReactions] = useState<Record<string, string[]>>({});
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  const [showReactionsForMessage, setShowReactionsForMessage] = useState<string | null>(null);
  const [isLastMessagePanelCollapsed, setIsLastMessagePanelCollapsed] = useState(() => {
    const saved = localStorage.getItem('isLastMessagePanelCollapsed');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [visibleDate, setVisibleDate] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [showCreateNewFolder, setShowCreateNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderIcon, setFolderIcon] = useState('📁');
  const [folderVisibility, setFolderVisibility] = useState<'private' | 'shared'>('private');
  const [folders, setFolders] = useState<Array<{id: string, name: string, icon: string, messageIds: string[], visibility: 'private' | 'shared', closedBy: string[], createdBy: string}>>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [editingContent, setEditingContent] = useState('');
  const [previousSelection, setPreviousSelection] = useState<Set<string>>(new Set());
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const previousMessagesLengthRef = useRef(0);
  const [audioPositions, setAudioPositions] = useState<Record<string, { userId: string; position: number; username: string }>>({});
  const [linkPreviews, setLinkPreviews] = useState<Record<string, any>>({});
  const linkPreviewsRef = useRef<Record<string, any>>({});
  const processedLinksRef = useRef<Set<string>>(new Set());
  const [inputLinkPreview, setInputLinkPreview] = useState<any>(null);
  const [editableTitle, setEditableTitle] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [filterLinks, setFilterLinks] = useState(false);
  const [filterYouTube, setFilterYouTube] = useState(false);
  const [filterTikTok, setFilterTikTok] = useState(false);
  const [showCustomFilter, setShowCustomFilter] = useState(false);
  const [customFilterDomain, setCustomFilterDomain] = useState<string>('');
  const [avatarImage, setAvatarImage] = useState<string>('');
    // Fallback YouTube (watch / youtu.be / shorts / live) preview betöltés ha hiányzik
    useEffect(() => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const allContents: string[] = messages.map(m => m.content).filter(Boolean);
      const youtubeLinks: string[] = [];
      allContents.forEach(content => {
        const links = content.match(urlRegex);
        if (links) {
          links.forEach(l => {
            if ((l.includes('youtube.com') || l.includes('youtu.be')) && !processedLinksRef.current.has(l)) {
              youtubeLinks.push(l);
            }
          });
        }
      });
      if (youtubeLinks.length === 0) return;

      // Legfeljebb 5 új lekérés egyszerre hogy ne terheljük
      const toFetch = youtubeLinks.slice(0, 5);
      toFetch.forEach(link => {
        // Jelöljük feldolgozottnak AZONNAL hogy ne fusson újra
        processedLinksRef.current.add(link);
        
        const vid = extractYouTubeVideoId(link);
        const thumb = vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : undefined;
        // Elsőként azonnali minimal preview beállítás hogy kártya megjelenjen
        const initialPreview = { image: thumb, title: 'YouTube videó', siteName: 'YouTube', pending: true };
        linkPreviewsRef.current[link] = initialPreview;
        setLinkPreviews(prev => ({
          ...prev,
          [link]: initialPreview
        }));
        // Részletesebb adat lekérése noembed szolgáltatásból (ha elérhető)
        fetch(`https://noembed.com/embed?url=${encodeURIComponent(link)}`)
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(data => {
            const previewData = {
              image: data.thumbnail_url || thumb,
              title: data.title || 'YouTube videó',
              siteName: 'YouTube',
              author: data.author_name || undefined,
              pending: false
            };
            linkPreviewsRef.current[link] = previewData;
            setLinkPreviews(prev => ({
              ...prev,
              [link]: previewData
            }));
          })
          .catch(() => {
            // Marad a minimál preview; jelöljük nem pending
            const fallbackData = { image: thumb, title: 'YouTube videó', siteName: 'YouTube', pending: false };
            linkPreviewsRef.current[link] = fallbackData;
            setLinkPreviews(prev => ({
              ...prev,
              [link]: fallbackData
            }));
          });
      });
    }, [messages]);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [viewingAvatar, setViewingAvatar] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [audioThumbnail, setAudioThumbnail] = useState<string | null>(null);
  const audioThumbnailInputRef = useRef<HTMLInputElement>(null);
  const audioPositionTimers = useRef<Record<string, number>>({});
  const ignoredAudioPositionsRef = useRef<Set<string>>(new Set());
  const [selectedAudioMessageId, setSelectedAudioMessageId] = useState<string | null>(null);
  const [playlistTicker, setPlaylistTicker] = useState(0);
  const [expandedAudioGroups, setExpandedAudioGroups] = useState<Set<string>>(new Set());
  const [rotatingFileNameIndex, setRotatingFileNameIndex] = useState<Record<string, number>>({});
  const [userContextMenu, setUserContextMenu] = useState<{ userId: string; x: number; y: number; user: any } | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  const [longPressStartPos, setLongPressStartPos] = useState<{x: number; y: number} | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollStartRef = useRef<number>(0);
  const longPressCleanupRef = useRef<() => void>(() => {});

  const socket = useMemo(() => (accessToken ? getSocket(accessToken) : null), [accessToken]);

  // Long press handlers for user management
  const handleUserLongPressStart = (e: React.TouchEvent | React.MouseEvent, user: any) => {
    // Reset scroll flag
    setIsUserScrolling(false);
    scrollStartRef.current = window.scrollY;
    // Store start position for move threshold
    if ('touches' in e && e.touches[0]) {
      setLongPressStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if ('clientX' in e) {
      setLongPressStartPos({ x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY });
    }
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.bottom + 5;
    
    const timer = window.setTimeout(() => {
      if (!isUserScrolling) {
        setUserContextMenu({
          userId: user.id,
          x,
          y,
          user,
        });
        console.log('Context menu opened for:', user.username);
      }
    }, 500);
    setLongPressTimer(timer);

    // Global listeners to cancel long press if user starts scrolling or performing large movements
    const cancelOnInteraction = () => {
      if (longPressTimer) {
        const scrollDelta = Math.abs(window.scrollY - scrollStartRef.current);
        if (scrollDelta > 2) {
          clearTimeout(longPressTimer);
          setLongPressTimer(null);
        }
      }
    };
    const cancelOnWheel = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
    };
    window.addEventListener('scroll', cancelOnInteraction, { passive: true, capture: true });
    window.addEventListener('touchmove', cancelOnInteraction, { passive: true, capture: true });
    window.addEventListener('mousemove', cancelOnInteraction, { passive: true });
    window.addEventListener('wheel', cancelOnWheel, { passive: true, capture: true });
    longPressCleanupRef.current = () => {
      window.removeEventListener('scroll', cancelOnInteraction, true);
      window.removeEventListener('touchmove', cancelOnInteraction, true);
      window.removeEventListener('mousemove', cancelOnInteraction);
      window.removeEventListener('wheel', cancelOnWheel, true);
    };
  };

  const handleUserLongPressEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    // Cleanup global listeners
    if (longPressCleanupRef.current) {
      longPressCleanupRef.current();
    }
    // Prevent click event if long press was triggered
    if (userContextMenu) {
      e.preventDefault();
      e.stopPropagation();
    }
    setLongPressStartPos(null);
  };

  // Cancel long press on scroll
  useEffect(() => {
    const onScroll = () => {
      if (longPressTimer) {
        setIsUserScrolling(true);
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
    };
    // Use capturing to catch early
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, [longPressTimer]);

  // Cancel on move threshold > 8px
  const handleUserLongPressMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!longPressTimer || !longPressStartPos) return;
    let cx: number, cy: number;
    if ('touches' in e && e.touches[0]) {
      cx = e.touches[0].clientX; cy = e.touches[0].clientY;
    } else if ('clientX' in e) {
      cx = (e as React.MouseEvent).clientX; cy = (e as React.MouseEvent).clientY;
    } else return;
    const dx = Math.abs(cx - longPressStartPos.x);
    const dy = Math.abs(cy - longPressStartPos.y);
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Biztosan törölni szeretnéd ezt a felhasználót?')) {
      try {
        await deleteUser(userId);
        setUserContextMenu(null);
        await refetchConversations();
      } catch (error) {
        alert('Hiba történt a felhasználó törlésekor');
      }
    }
  };

  const handleToggleBan = async (userId: string, currentVerified: boolean) => {
    const action = currentVerified ? 'tiltani' : 'tiltás feloldása';
    if (confirm(`Biztosan ${action} szeretnéd ezt a felhasználót?`)) {
      try {
        await toggleBanUser(userId, currentVerified);
        setUserContextMenu(null);
        await refetchConversations();
      } catch (error) {
        alert('Hiba történt a művelet végrehajtásakor');
      }
    }
  };

  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    const action = currentIsAdmin ? 'eltávolítani az admin jogot' : 'admin jogot adni';
    if (confirm(`Biztosan ${action} szeretnél?`)) {
      try {
        await toggleAdmin(userId, !currentIsAdmin);
        setUserContextMenu(null);
        await refetchConversations();
      } catch (error) {
        alert('Hiba történt az admin jog módosításakor');
      }
    }
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (userContextMenu) {
        setUserContextMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userContextMenu]);

  // Save last message panel state to localStorage
  useEffect(() => {
    localStorage.setItem('isLastMessagePanelCollapsed', JSON.stringify(isLastMessagePanelCollapsed));
  }, [isLastMessagePanelCollapsed]);

  // Update playlist display every 500ms to reflect playing state
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaylistTicker(prev => prev + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Save socket to window for access in AudioPlayer component
  useEffect(() => {
    if (socket) {
      (window as any).socket = socket;
      console.log('📍 Socket saved to window object');
    }
    return () => {
      delete (window as any).socket;
    };
  }, [socket]);

  useEffect(() => {
    notificationSound.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE=');
  }, []);

  // Window resize handler for responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setShowSidebar(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Detect links in input and fetch preview
  useEffect(() => {
    const links = extractLinks(input);
    if (links.length > 0 && links[0]) {
      const link = links[0];
      if (!inputLinkPreview || inputLinkPreview.url !== link) {
        setIsLoadingPreview(true);
        fetch(`${API_URL}/link-preview?url=${encodeURIComponent(link)}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        })
          .then(res => res.json())
          .then(data => {
            setInputLinkPreview(data);
            setEditableTitle(data.title || '');
            setIsLoadingPreview(false);
          })
          .catch(() => {
            setIsLoadingPreview(false);
          });
      }
    } else {
      setInputLinkPreview(null);
      setEditableTitle('');
    }
  }, [input]);

  // Load avatar from backend user data
  useEffect(() => {
    if (me?.avatarImage) {
      setAvatarImage(me.avatarImage);
    }
  }, [me?.avatarImage]);

  useEffect(() => {
    const handleClickOutside = (_e: MouseEvent) => {
      if (showAvatarMenu) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showAvatarMenu]);

  const { data: convData, refetch: refetchConversations } = useQuery(
    ['conversation', me?.isAdmin],
    () => (me?.isAdmin ? listConversations() : getMyConversation()),
    { 
      enabled: !!me, 
      retry: false,
      cacheTime: 0,
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    },
  );

  // For non-admin users, set their single conversation ID
  useEffect(() => {
    if (!me || !convData) return;
    if (!me.isAdmin && convData && (convData as any).id) {
      setActiveConversationId((convData as any).id);
    }
  }, [me, convData]);

  // For admin users, auto-select first conversation if none selected yet
  useEffect(() => {
    if (me?.isAdmin && Array.isArray(convData) && convData.length > 0 && !activeConversationId) {
      setActiveConversationId(convData[0].id);
    }
  }, [me?.isAdmin, convData, activeConversationId]);

  const { refetch: refetchMessages } = useQuery(
    ['messages', activeConversationId],
    () => getMessages(activeConversationId!),
    {
      enabled: !!activeConversationId,
      onSuccess: (data) => {
        // Filter out messages deleted by current user
        const filteredData = data.filter((msg: any) => {
          const deletedBy = msg.deletedBy ? JSON.parse(msg.deletedBy) : [];
          return !deletedBy.includes(me?.id);
        });
        const sortedMessages = [...filteredData].reverse();
        setMessages(sortedMessages);
        setFilteredMessages(sortedMessages);
      },
      refetchOnMount: true,
    },
  );

  useEffect(() => {
    if (activeConversationId) {
      refetchMessages();
      setSearchQuery('');
    }
  }, [activeConversationId, refetchMessages]);

  useEffect(() => {
    if (!socket || !activeConversationId) return;
    socket.emit('conversation:join', { conversationId: activeConversationId });

    // Send heartbeat every 20 seconds to keep online status active
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
      }
    }, 20000);

    socket.on('message:new', (msg: any) => {
      console.log('🔵 message:new event received', msg);
      if (msg.conversationId === activeConversationId) {
        console.log('✅ Message is for active conversation');
        setMessages((prev) => [...prev, msg]);
        setFilteredMessages((prev) => [...prev, msg]);
        
        // Hide typing indicator when message is sent
        setIsTyping(false);
        
        // Only glow the latest message from the other person
        console.log('💡 Setting newMessageIds with:', msg.id, 'sender:', msg.senderId, 'me:', me?.id);
        setNewMessageIds(new Set([msg.id]));
        
        // If a folder is active, add the new message to that folder
        if (activeFolderId) {
          setFolders(prev => prev.map(folder => 
            folder.id === activeFolderId 
              ? { ...folder, messageIds: [...folder.messageIds, msg.id] }
              : folder
          ));
        }
        
        if (msg.senderId !== me?.id && notificationSound.current) {
          notificationSound.current.play().catch(() => {});
        }
      }
    });

    socket.on('typing', (payload: any) => {
      setIsTyping(payload.isTyping);
      setTypingTextLength(payload.textLength || 0);
    });

    socket.on('user:online', (payload: { userId: string; lastSeen: Date }) => {
      // Update messages with new online status
      setMessages((prev) => prev.map((msg: any) => {
        if (msg.sender?.id === payload.userId) {
          return {
            ...msg,
            sender: { ...msg.sender, lastSeen: payload.lastSeen }
          };
        }
        return msg;
      }));
    });

    socket.on('user:offline', (payload: { userId: string; lastSeen: Date }) => {
      // Update messages with new offline status
      setMessages((prev) => prev.map((msg: any) => {
        if (msg.sender?.id === payload.userId) {
          return {
            ...msg,
            sender: { ...msg.sender, lastSeen: payload.lastSeen }
          };
        }
        return msg;
      }));
    });

    socket.on('folder:new', (folder: any) => {
      // Received folder from backend (after it was saved to database)
      console.log('📁 folder:new event received', folder);
      
      // Parse closedBy if it's a string
      if (typeof folder.closedBy === 'string') {
        folder.closedBy = JSON.parse(folder.closedBy);
      }
      
      // Add folder to list (deduplicate by ID)
      setFolders(prev => {
        const exists = prev.some(f => f.id === folder.id);
        if (exists) {
          console.log('⚠️ Folder already exists, skipping:', folder.id);
          return prev;
        }
        console.log('✅ Adding folder to list:', folder.name);
        return [...prev, folder];
      });
    });

    socket.on('audio-position:received', (data: { messageId: string; position: number; senderId: string; username?: string }) => {
      console.log('🎵 Audio position received:', data);
      console.log('🎵 Available audio players:', Array.from((window as any).audioRefsMap?.keys() || []));
      
      // Update audio positions state to show who is listening
      if (data.senderId !== me?.id) {
        // If position is near start (< 3 seconds), consider it a new playback - remove from ignored list
        if (data.position < 3) {
          if (ignoredAudioPositionsRef.current.has(data.messageId)) {
            console.log('🔄 Új lejátszás észlelve, ignorálás törlése:', data.messageId);
            ignoredAudioPositionsRef.current.delete(data.messageId);
          }
          // Don't return here - continue to show the position
        } else {
          // Only check if ignored for positions > 3 seconds
          if (ignoredAudioPositionsRef.current.has(data.messageId)) {
            console.log('⏭️ Ignoring audio position for message:', data.messageId);
            return;
          }
        }
        
        // Find username from messages
        const senderMessage = messages.find((msg: any) => msg.senderId === data.senderId);
        const username = senderMessage?.sender?.username || data.username || 'Ismeretlen felhasználó';
        
        // Clear any existing timer for this message
        const timerKey = `${data.messageId}-${data.senderId}`;
        if (audioPositionTimers.current[timerKey]) {
          clearTimeout(audioPositionTimers.current[timerKey]);
        }
        
        setAudioPositions(prev => ({
          ...prev,
          [data.messageId]: {
            userId: data.senderId,
            position: data.position,
            username
          }
        }));
        
        // Clear position after 5 seconds of no updates
        audioPositionTimers.current[timerKey] = window.setTimeout(() => {
          setAudioPositions(prev => {
            const newPositions = { ...prev };
            if (newPositions[data.messageId]?.userId === data.senderId) {
              delete newPositions[data.messageId];
            }
            return newPositions;
          });
          delete audioPositionTimers.current[timerKey];
        }, 5000);
      }
      
      // Update position only, don't start playback automatically
      const callbacks = (window as any).audioRefsMap?.get(data.messageId);
      if (callbacks?.seekOnly && typeof callbacks.seekOnly === 'function') {
        callbacks.seekOnly(data.position);
        console.log(`✅ Updated position for message ${data.messageId} to ${data.position}s (no autoplay)`);
      } else {
        console.warn('⚠️ Audio player seek callback not found for message:', data.messageId);
        console.warn('⚠️ Callback type:', typeof callbacks);
      }
    });

    return () => {
      clearInterval(heartbeatInterval);
      socket.off('message:new');
      socket.off('typing');
      socket.off('user:online');
      socket.off('user:offline');
      socket.off('audio-position:received');
      socket.off('folder:new');
    };
  }, [socket, activeConversationId, me?.id, messages]);

  // Load folders from database when conversation changes
  useEffect(() => {
    if (!activeConversationId) return;

    console.log('🔄 Loading folders for conversation:', activeConversationId);
    getFolders(activeConversationId)
      .then((data) => {
        console.log('✅ Folders loaded from database:', data);
        setFolders(data);
      })
      .catch((err) => {
        console.error('❌ Failed to load folders:', err);
      });
  }, [activeConversationId]);

  useEffect(() => {
    // Scroll when new messages are added or on initial load
    if (messages.length > previousMessagesLengthRef.current || previousMessagesLengthRef.current === 0) {
      setIsScrolling(true);
      
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        const timer = setTimeout(() => {
          if (messagesContainerRef.current) {
            const container = messagesContainerRef.current;
            container.scrollTo({
              top: container.scrollHeight + 200,
              behavior: 'smooth'
            });
            
            // Wait for smooth scroll to complete (approximately 500ms for smooth scroll)
            setTimeout(() => {
              setIsScrolling(false);
            }, 800);
          }
        }, 200);
        
        previousMessagesLengthRef.current = messages.length;
        return () => clearTimeout(timer);
      });
    }
  }, [messages.length]);

  useEffect(() => {
    let result = messages;
    
    // Search filter
    if (searchQuery.trim()) {
      result = result.filter((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Link filter
    if (filterLinks) {
      result = result.filter((m) => extractLinks(m.content).length > 0);
    }
    
    // YouTube filter
    if (filterYouTube) {
      result = result.filter((m) => {
        const links = extractLinks(m.content);
        return links.some(link => link.includes('youtube.com') || link.includes('youtu.be'));
      });
    }
    
    // TikTok filter
    if (filterTikTok) {
      result = result.filter((m) => {
        const links = extractLinks(m.content);
        return links.some(link => link.includes('tiktok.com') || link.includes('vm.tiktok.com'));
      });
    }
    
    // Custom domain filter
    if (customFilterDomain) {
      result = result.filter((m) => {
        const links = extractLinks(m.content);
        return links.some(link => link.includes(customFilterDomain));
      });
    }
    
    setFilteredMessages(result);
  }, [searchQuery, messages, filterLinks, filterYouTube, filterTikTok, customFilterDomain]);

  const mutation = useMutation((content: string) => sendMessage(activeConversationId!, content), {
    onSuccess: (msg) => {
      setMessages((prev) => [...prev, msg]);
      setFilteredMessages((prev) => [...prev, msg]);
      
      // Remove glow from all previous messages, only glow the latest
      setNewMessageIds(new Set([msg.id]));
      
      // If a folder is active, add the new message to that folder
      if (activeFolderId) {
        setFolders(prev => prev.map(folder => 
          folder.id === activeFolderId 
            ? { ...folder, messageIds: [...folder.messageIds, msg.id] }
            : folder
        ));
      }
    },
  });

  const handleSend = () => {
    if (!input.trim() || !activeConversationId) return;
    
    let messageToSend = input;
    
    // If there's a link preview with edited title, update the preview in cache
    if (inputLinkPreview && editableTitle !== inputLinkPreview.title) {
      setLinkPreviews(prev => ({
        ...prev,
        [inputLinkPreview.url]: {
          ...inputLinkPreview,
          title: editableTitle
        }
      }));
    }
    
    mutation.mutate(messageToSend);
    setInput('');
    setShowEmojiPicker(false);
    setInputLinkPreview(null);
    setEditableTitle('');
    
    // Send typing: false when message is sent
    socket?.emit('typing', {
      conversationId: activeConversationId,
      isTyping: false,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setInput((prev) => prev + emojiData.emoji);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check file size (3GB = 3 * 1024 * 1024 * 1024 bytes)
    const maxSize = 3 * 1024 * 1024 * 1024;
    
    // If only one file, use the old single-file logic
    if (files.length === 1) {
      const file = files[0];
      if (file.size > maxSize) {
        alert('A fájl mérete nem lehet nagyobb 3GB-nál!');
        return;
      }

      setSelectedFile(file);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
      return;
    }

    // Multiple files - send them directly
    if (!activeConversationId) return;
    
    setIsUploadingFile(true);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (file.size > maxSize) {
        alert(`A fájl mérete nem lehet nagyobb 3GB-nál: ${file.name}`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversationId', activeConversationId);
        formData.append('content', file.name);

        const response = await fetch(`${API_URL}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          },
          body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        const newMessage = await response.json();
        setMessages((prev) => [...prev, newMessage]);
        setFilteredMessages((prev) => [...prev, newMessage]);
        setNewMessageIds(prev => new Set([...prev, newMessage.id]));

        if (activeFolderId) {
          setFolders(prev => prev.map(folder => 
            folder.id === activeFolderId 
              ? { ...folder, messageIds: [...folder.messageIds, newMessage.id] }
              : folder
          ));
        }
      } catch (error) {
        console.error('Failed to send file:', file.name, error);
        alert(`Hiba történt a fájl feltöltése során: ${file.name}`);
      }
    }

    setIsUploadingFile(false);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setAudioThumbnail(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (audioThumbnailInputRef.current) {
      audioThumbnailInputRef.current.value = '';
    }
  };

  const handleAudioThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🎵 Audio thumbnail select triggered');
    const file = e.target.files?.[0];
    if (!file) {
      console.log('❌ No file selected');
      return;
    }

    console.log('📁 File selected:', file.name, file.type);

    if (!file.type.startsWith('image/')) {
      alert('Kérlek csak képfájlt válassz!');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      console.log('✅ Thumbnail loaded successfully');
      setAudioThumbnail(reader.result as string);
    };
    reader.onerror = () => {
      console.error('❌ Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  const handleSendWithFile = async () => {
    if (!selectedFile || !activeConversationId) return;

    setIsUploadingFile(true);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('conversationId', activeConversationId);
      if (input.trim()) {
        formData.append('content', input.trim());
      }
      if (audioThumbnail && selectedFile.type.startsWith('audio/')) {
        formData.append('audioThumbnail', audioThumbnail);
      }

      const response = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

      const newMessage = await response.json();
      setMessages((prev) => [...prev, newMessage]);
      setFilteredMessages((prev) => [...prev, newMessage]);
      setNewMessageIds(new Set([newMessage.id]));

      if (activeFolderId) {
        setFolders(prev => prev.map(folder => 
          folder.id === activeFolderId 
            ? { ...folder, messageIds: [...folder.messageIds, newMessage.id] }
            : folder
        ));
      }

      setInput('');
      handleRemoveFile();
      
      socket?.emit('typing', {
        conversationId: activeConversationId,
        isTyping: false,
      });
    } catch (error) {
      console.error('File upload error:', error);
      alert('Hiba történt a fájl feltöltése során!');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Ma';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Tegnap';
    } else {
      return date.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' });
    }
  };

  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const handleReaction = (messageId: string, emoji: string) => {
    setMessageReactions((prev) => {
      const current = prev[messageId] || [];
      if (current.includes(emoji)) {
        return { ...prev, [messageId]: current.filter((e) => e !== emoji) };
      } else {
        return { ...prev, [messageId]: [...current, emoji] };
      }
    });
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const handleMessageClick = (messageId: string) => {
    if (activeFolderId) {
      // Deactivate folder with animation
      setActiveFolderId(null);
      
      // Wait for folder animation, then scroll and highlight
      setTimeout(() => {
        const messageElement = messageRefs.current.get(messageId);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Highlight message (stays until clicked again)
          setHighlightedMessageId(messageId);
        }
      }, 300);
    } else if (highlightedMessageId) {
      // If there's a highlighted message, just remove the highlight
      setHighlightedMessageId(null);
    }
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollBottom(!isNearBottom);

      // Find the visible date based on scroll position
      const container = messagesContainerRef.current;
      const dateElements = container.querySelectorAll('.date-separator');
      let currentDate: string | null = null;

      dateElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (rect.top <= containerRect.top + 100) {
          currentDate = el.textContent || null;
        }
      });

      setVisibleDate(currentDate);
    }
  };

  const shouldShowDateSeparator = (currentMsg: any, prevMsg: any) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.createdAt).toDateString();
    const prevDate = new Date(prevMsg.createdAt).toDateString();
    return currentDate !== prevDate;
  };

  const shouldGroupMessages = (currentMsg: any, prevMsg: any) => {
    if (!prevMsg || !currentMsg) return false;
    // Group if same sender and within 2 minutes
    if (currentMsg.senderId !== prevMsg.senderId) return false;
    const timeDiff = new Date(currentMsg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime();
    return timeDiff < 120000; // 2 minutes
  };

  // Group consecutive messages from same sender
  const groupedMessages = useMemo(() => {
    const groups: any[] = [];
    let currentGroup: any = null;

    // Filter messages by active folder if one is selected
    let messagesToGroup = filteredMessages;
    if (activeFolderId) {
      const activeFolder = folders.find(f => f.id === activeFolderId);
      if (activeFolder) {
        messagesToGroup = filteredMessages.filter(msg => activeFolder.messageIds.includes(msg.id));
      }
    }
    
    // Filter by selected audio message if one is selected
    if (selectedAudioMessageId) {
      messagesToGroup = messagesToGroup.filter(msg => msg.id === selectedAudioMessageId);
    }

    messagesToGroup.forEach((msg, index) => {
      if (!currentGroup || !shouldGroupMessages(msg, messagesToGroup[index - 1])) {
        // Start new group
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          id: msg.id,
          senderId: msg.senderId,
          messages: [msg],
          createdAt: msg.createdAt,
          lastMessageId: msg.id,
        };
      } else {
        // Add to current group
        currentGroup.messages.push(msg);
        currentGroup.lastMessageId = msg.id;
      }
    });

    if (currentGroup) groups.push(currentGroup);
    return groups;
  }, [filteredMessages, activeFolderId, folders, selectedAudioMessageId]);

  const extractLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  // Get the last message group from the other person based on visible date
  const otherPersonLastMessage = useMemo(() => {
    // Find the overall last message (regardless of date)
    let overallLastMessage = null;
    for (let i = groupedMessages.length - 1; i >= 0; i--) {
      if (groupedMessages[i].senderId !== me?.id) {
        const lastMsg = groupedMessages[i].messages[groupedMessages[i].messages.length - 1];
        overallLastMessage = {
          content: groupedMessages[i].messages.map((m: any) => m.content).join('\n\n'),
          sender: groupedMessages[i].messages[0]?.sender,
          lastMessage: lastMsg
        };
        break;
      }
    }

    // Get the most recent date with messages
    const mostRecentDate = overallLastMessage ? formatDate((overallLastMessage as any).lastMessage.createdAt) : null;
    const isViewingOlderDate = visibleDate && mostRecentDate && visibleDate !== mostRecentDate;

    if (!visibleDate) {
      // If no visible date, show the overall last message
      return overallLastMessage;
    }

    // Find the last message from the other person on the visible date
    for (let i = groupedMessages.length - 1; i >= 0; i--) {
      const group = groupedMessages[i];
      const groupDate = formatDate(group.messages[0].createdAt);
      
      if (groupDate === visibleDate && group.senderId !== me?.id) {
        const lastMsg = group.messages[group.messages.length - 1];
        return {
          content: group.messages.map((m: any) => m.content).join('\n\n'),
          sender: group.messages[0]?.sender,
          lastMessage: lastMsg,
          overallLastMessage: isViewingOlderDate ? overallLastMessage : null // Only include if viewing older date
        };
      }
    }

    // If no message found for visible date, show the last message before that date
    for (let i = groupedMessages.length - 1; i >= 0; i--) {
      if (groupedMessages[i].senderId !== me?.id) {
        const lastMsg = groupedMessages[i].messages[groupedMessages[i].messages.length - 1];
        return {
          content: groupedMessages[i].messages.map((m: any) => m.content).join('\n\n'),
          sender: groupedMessages[i].messages[0]?.sender,
          lastMessage: lastMsg,
          overallLastMessage: isViewingOlderDate ? overallLastMessage : null // Only include if viewing older date
        };
      }
    }
    
    return null;
  }, [groupedMessages, me?.id, visibleDate]);

  // Rotate file names for collapsed audio groups every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRotatingFileNameIndex(prev => {
        const newIndices: Record<string, number> = {};
        groupedMessages.forEach(group => {
          const audioMessages = group.messages.filter((m: any) => m.fileType?.startsWith('audio/'));
          if (audioMessages.length > 1 && !expandedAudioGroups.has(group.lastMessageId)) {
            const currentIndex = prev[group.lastMessageId] || 0;
            newIndices[group.lastMessageId] = (currentIndex + 1) % audioMessages.length;
          }
        });
        return { ...prev, ...newIndices };
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [groupedMessages, expandedAudioGroups]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    navigate('/login');
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const avatarData = reader.result as string;
        setAvatarImage(avatarData);
        setShowAvatarMenu(false);
        
        // Save to backend
        try {
          await updateAvatar(avatarData);
          // Refetch user data and messages to update UI everywhere
          await refetchMe();
          if (activeConversationId) {
            const msgs = await getMessages(activeConversationId);
            // Filter out messages deleted by current user
            const filteredMsgs = msgs.filter((msg: any) => {
              const deletedBy = msg.deletedBy ? JSON.parse(msg.deletedBy) : [];
              return !deletedBy.includes(me?.id);
            });
            console.log('Updated messages with avatars:', filteredMsgs.slice(0, 2).map((m: any) => ({ id: m.id, avatar: m.sender?.avatarImage })));
            setMessages(filteredMsgs);
          }
        } catch (error) {
          console.error('Failed to save avatar:', error);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (meLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Betöltés...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Avatar Image Viewer Modal */}
      {viewingAvatar && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          onClick={() => setViewingAvatar(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img 
              src={viewingAvatar} 
              alt="Avatar" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setViewingAvatar(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-gray-800 hover:bg-gray-700 text-white rounded-full flex items-center justify-center text-xl transition-all shadow-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="h-screen flex flex-col md:flex-row bg-gray-900 overflow-hidden">
      {me?.isAdmin && (
        <>
          {/* Mobile hamburger button */}
          {isMobile && (
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="fixed top-4 left-4 z-50 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg shadow-xl text-white transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showSidebar ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}
          
          {/* Sidebar overlay for mobile */}
          {isMobile && showSidebar && (
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowSidebar(false)}
            />
          )}
          
        <aside className={`
          ${isMobile ? 'fixed inset-y-0 left-0 z-40 transform transition-transform duration-300' : 'relative'}
          ${isMobile && !showSidebar ? '-translate-x-full' : 'translate-x-0'}
          ${isMobile ? 'w-80' : isTablet ? 'w-64' : 'w-80'}
          border-r border-gray-800 bg-gray-950 shadow-2xl flex flex-col
        `}>
          <div className="p-4 border-b border-gray-800 bg-gradient-to-r from-cyan-600 to-teal-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-xl">💬 Beszélgetések</h2>
                <p className="text-sm opacity-90">Admin panel</p>
              </div>
              {isMobile && (
                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="overflow-y-auto h-[calc(100vh-140px)]">
            {Array.isArray(convData) && convData.length === 0 && (
              <div className="p-4 text-center text-gray-500">
                <p>Még nincsenek beszélgetések</p>
              </div>
            )}
            {Array.isArray(convData) &&
              convData.map((conv: any) => (
                <div
                  key={conv.id}
                  className={`p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors ${
                    activeConversationId === conv.id ? 'bg-gray-800 border-l-4 border-cyan-500' : ''
                  }`}
                  onClick={() => setActiveConversationId(conv.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white font-bold shadow-lg">
                      {conv.user.username[0].toUpperCase()}
                    </div>
                    <div 
                      className="flex-1 select-none"
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        handleUserLongPressStart(e, conv.user);
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                        handleUserLongPressEnd(e);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleUserLongPressStart(e, conv.user);
                      }}
                      onMouseMove={(e) => handleUserLongPressMove(e)}
                      onTouchMove={(e) => handleUserLongPressMove(e)}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        handleUserLongPressEnd(e);
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation();
                        handleUserLongPressEnd(e);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleUserLongPressStart(e, conv.user);
                        setTimeout(() => setLongPressTimer(null), 0);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-100">{conv.user.username}</p>
                        {conv.user.isAdmin && <span className="text-xs bg-yellow-600 px-1.5 py-0.5 rounded">👑 Admin</span>}
                        {!conv.user.verified && <span className="text-xs bg-red-600 px-1.5 py-0.5 rounded">🚫 Tiltva</span>}
                      </div>
                      <p className="text-xs text-gray-400">{conv.user.email}</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full py-2 px-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg"
            >
              Kijelentkezés
            </button>
          </div>
        </aside>
        </>
      )}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!activeConversationId ? (
          <div className="flex-1 flex items-center justify-center bg-gray-850">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-xl text-gray-300 mb-2">Válassz egy beszélgetést</p>
              <p className="text-sm text-gray-500">vagy várj amíg az admin válaszol</p>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-gray-700 bg-gray-800 shadow-lg p-2 sm:p-3 md:p-4 flex-shrink-0">
              <div className="flex items-center justify-between gap-1 sm:gap-2">
                <div className="flex items-center gap-1 sm:gap-2 md:gap-3 min-w-0">
                  {me?.isAdmin && isMobile && (
                    <button
                      onClick={() => setShowSidebar(!showSidebar)}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                  )}
                  <div className="relative flex-shrink-0">
                    {avatarImage ? (
                      <img 
                        src={avatarImage} 
                        alt="Avatar"
                        className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover shadow-lg ring-2 ring-green-500"
                      />
                    ) : (
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold shadow-lg text-sm md:text-base">
                        {me?.isAdmin ? 'A' : 'U'}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAvatarMenu(!showAvatarMenu);
                      }}
                      className="absolute -right-1 -bottom-1 w-5 h-5 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-white text-xs shadow-lg transition-all"
                      title="Avatar beállítások"
                    >
                      ⋯
                    </button>
                    {showAvatarMenu && (
                      <div 
                        className="absolute top-full left-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50 min-w-[180px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            avatarInputRef.current?.click();
                            setShowAvatarMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-100 hover:bg-gray-700 transition-colors flex items-center gap-2 rounded-t-lg"
                        >
                          🖼️ Kép feltöltése
                        </button>
                        {avatarImage && (
                          <button
                            onClick={async () => {
                              setAvatarImage('');
                              setShowAvatarMenu(false);
                              try {
                                await updateAvatar('');
                                // Refetch user data and messages to update UI everywhere
                                await refetchMe();
                                if (activeConversationId) {
                                  const msgs = await getMessages(activeConversationId);
                                  setMessages(msgs);
                                }
                              } catch (error) {
                                console.error('Failed to delete avatar:', error);
                              }
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 transition-colors flex items-center gap-2 rounded-b-lg"
                          >
                            🗑️ Avatar törlése
                          </button>
                        )}
                      </div>
                    )}
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <h3 className="font-semibold text-gray-100 text-sm md:text-base truncate">
                      {me?.username || 'Felhasználó'}
                    </h3>
                    <p className="text-xs text-green-400 hidden sm:block">● Online</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="text"
                    placeholder="🔍"
                    className="w-20 md:w-auto px-2 md:px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {!me?.isAdmin && (
                    <button
                      onClick={handleLogout}
                      className="px-2 md:px-4 py-1 bg-gradient-to-r from-red-600 to-red-700 text-white text-xs md:text-sm rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg whitespace-nowrap"
                    >
                      <span className="hidden md:inline">Kilépés</span>
                      <span className="md:hidden">🚪</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Selection menu - responsive position */}
            {selectedMessages.size > 0 && (
              <div className="absolute top-14 md:top-20 left-2 md:left-4 right-2 md:right-auto z-20 bg-gray-850/98 backdrop-blur-md rounded-xl shadow-2xl border border-gray-700/50 p-2 md:p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs md:text-sm font-medium text-cyan-400 whitespace-nowrap">{selectedMessages.size} kijelölve</span>
                  
                  <div className="h-6 w-px bg-gray-700 hidden md:block"></div>
                  
                  <button
                    onClick={() => {
                      setShowFolderDialog(true);
                      setFolderVisibility('private');
                      setFolderIcon('📁');
                    }}
                    className="px-2 md:px-4 py-1.5 md:py-2 bg-gray-800 hover:bg-gray-700 text-gray-100 text-xs md:text-sm rounded-lg transition-all border border-gray-700 hover:border-cyan-500/50 flex items-center gap-1 md:gap-2 shadow-lg whitespace-nowrap"
                  >
                    <span className="md:hidden">📁</span>
                    <span className="hidden md:inline">📁 Mappába</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      const allMessageIds = filteredMessages.map(m => m.id);
                      const allSelected = allMessageIds.every(id => selectedMessages.has(id)) && selectedMessages.size === allMessageIds.length;
                      
                      if (allSelected) {
                        setSelectedMessages(previousSelection);
                        setPreviousSelection(new Set());
                      } else {
                        setPreviousSelection(new Set(selectedMessages));
                        setSelectedMessages(new Set(allMessageIds));
                      }
                    }}
                    className="px-2 md:px-4 py-1.5 md:py-2 bg-gray-800 hover:bg-gray-700 text-gray-100 text-xs md:text-sm rounded-lg transition-all border border-gray-700 hover:border-cyan-500/50 flex items-center gap-1 md:gap-2 shadow-lg whitespace-nowrap"
                    title="Összes kijelölése / Visszaállítás"
                  >
                    <span className="md:hidden">☑️</span>
                    <span className="hidden md:inline">☑️ Összes</span>
                  </button>
                  
                  {/* Edit menu dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowEditMenu(!showEditMenu)}
                      className="px-2 md:px-4 py-1.5 md:py-2 bg-gray-800 hover:bg-gray-700 text-gray-100 text-xs md:text-sm rounded-lg transition-all border border-gray-700 hover:border-cyan-500/50 flex items-center gap-1 md:gap-2 shadow-lg whitespace-nowrap"
                    >
                      <span className="md:hidden">⚙️</span>
                      <span className="hidden md:inline">⚙️ Műveletek</span>
                    </button>
                    {showEditMenu && (
                      <div className="absolute top-full mt-2 left-0 bg-gray-850 border border-gray-700/50 rounded-lg shadow-2xl overflow-hidden min-w-[160px] backdrop-blur-md">
                        {selectedMessages.size === 1 && (
                          <button
                            onClick={() => {
                              const messageId = Array.from(selectedMessages)[0];
                              const message = messages.find(m => m.id === messageId);
                              if (message) {
                                setEditingMessageId(messageId);
                                setEditingContent(message.content);
                                setSelectedMessages(new Set());
                                setShowEditMenu(false);
                              }
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-100 hover:bg-gray-800 transition-colors flex items-center gap-2 border-b border-gray-700/50"
                          >
                            ✏️ Szerkesztés
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (activeFolderId) {
                              // If a folder is active, remove messages from the folder only
                              if (window.confirm(`Biztosan eltávolítod ${selectedMessages.size} üzenetet a mappából?`)) {
                                // Get all message IDs from selected groups
                                const allSelectedMessageIds: string[] = [];
                                groupedMessages.forEach(group => {
                                  if (selectedMessages.has(group.lastMessageId)) {
                                    group.messages.forEach((msg: any) => {
                                      allSelectedMessageIds.push(msg.id);
                                    });
                                  }
                                });
                                
                                setFolders(prev => prev.map(folder => 
                                  folder.id === activeFolderId
                                    ? { ...folder, messageIds: folder.messageIds.filter(id => !allSelectedMessageIds.includes(id)) }
                                    : folder
                                ));
                                setSelectedMessages(new Set());
                                setShowEditMenu(false);
                              }
                            } else {
                              // If no folder is active, delete messages permanently
                              if (window.confirm(`Biztosan törölni szeretnéd ${selectedMessages.size} üzenetet?`)) {
                                const messageIdsToDelete = Array.from(selectedMessages);
                                
                                // Call API to delete messages
                                apiDeleteMessages(messageIdsToDelete)
                                  .then(() => {
                                    // Remove from UI after successful deletion
                                    setMessages(prev => prev.filter(m => !selectedMessages.has(m.id)));
                                    setFilteredMessages(prev => prev.filter(m => !selectedMessages.has(m.id)));
                                    setFolders(prev => prev.map(folder => ({
                                      ...folder,
                                      messageIds: folder.messageIds.filter(id => !selectedMessages.has(id))
                                    })));
                                    setSelectedMessages(new Set());
                                    setShowEditMenu(false);
                                  })
                                  .catch((err) => {
                                    console.error('❌ Failed to delete messages:', err);
                                    alert('Hiba történt az üzenetek törlése közben');
                                  });
                              }
                            }
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-gray-100 hover:bg-gray-800 hover:text-red-400 transition-colors flex items-center gap-2"
                        >
                          {activeFolderId ? '📤 Eltávolítás a mappából' : '🗑️ Törlés'}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="h-6 w-px bg-gray-700 hidden md:block"></div>
                  
                  <button
                    onClick={() => {
                      setSelectedMessages(new Set());
                      setShowEditMenu(false);
                    }}
                    className="px-2 md:px-4 py-1.5 md:py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-100 text-xs md:text-sm rounded-lg transition-all border border-gray-700 hover:border-gray-600 whitespace-nowrap"
                  >
                    <span className="md:hidden">✕</span>
                    <span className="hidden md:inline">✕ Mégse</span>
                  </button>
                </div>
              </div>
            )}

            {/* Folder dialog */}
            {showFolderDialog && !showCreateNewFolder && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg shadow-2xl border border-cyan-500/30 p-4 md:p-6 w-full max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg md:text-xl font-bold text-gray-100 mb-3 md:mb-4">Üzenetek mappába rendezése</h3>
                  
                  {/* Existing folders section */}
                  {folders.filter(f => !f.closedBy.includes(me?.id || '') && (f.visibility === 'shared' || f.createdBy === me?.id)).length > 0 && (
                    <div className="mb-3 md:mb-4">
                      <h4 className="text-xs md:text-sm font-medium text-gray-300 mb-2">Hozzáadás meglévő mappához</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {folders
                          .filter(f => !f.closedBy.includes(me?.id || '') && (f.visibility === 'shared' || f.createdBy === me?.id))
                          .map(folder => (
                            <button
                              key={folder.id}
                              onClick={() => {
                                // Get all message IDs from selected groups
                                const allSelectedMessageIds: string[] = [];
                                groupedMessages.forEach(group => {
                                  if (selectedMessages.has(group.lastMessageId)) {
                                    group.messages.forEach((msg: any) => {
                                      allSelectedMessageIds.push(msg.id);
                                    });
                                  }
                                });
                                
                                // Add messages to existing folder (avoid duplicates)
                                setFolders(prev => prev.map(f => 
                                  f.id === folder.id
                                    ? { ...f, messageIds: [...new Set([...f.messageIds, ...allSelectedMessageIds])] }
                                    : f
                                ));
                                
                                setShowFolderDialog(false);
                                setSelectedMessages(new Set());
                              }}
                              className="w-full flex items-center gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-cyan-500/50 rounded-lg transition-all text-left"
                            >
                              {folder.icon?.startsWith('data:image') ? (
                                <img src={folder.icon} alt="icon" className="w-5 h-5 md:w-6 md:h-6 rounded-full flex-shrink-0" />
                              ) : (
                                <span className="text-base md:text-xl flex-shrink-0">{folder.icon || '📁'}</span>
                              )}
                              <span className="text-xs md:text-sm text-gray-100 flex-1 truncate">{folder.name}</span>
                              <span className="text-xs text-gray-400 flex-shrink-0">({folder.messageIds.length})</span>
                              {folder.visibility === 'shared' && <span className="text-xs flex-shrink-0">👥</span>}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setShowCreateNewFolder(true)}
                      className="w-full px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-lg hover:from-cyan-700 hover:to-teal-700 transition-all shadow-lg"
                    >
                      ➕ Új mappa létrehozása
                    </button>
                    <button
                      onClick={() => {
                        setShowFolderDialog(false);
                        setSelectedMessages(new Set());
                      }}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all"
                    >
                      Mégse
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Create new folder dialog */}
            {showFolderDialog && showCreateNewFolder && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-gray-800 rounded-lg shadow-2xl border border-cyan-500/30 p-4 sm:p-6 w-11/12 sm:w-96 max-w-md max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-bold text-gray-100 mb-4">Új mappa létrehozása</h3>
                  
                  {/* Icon preview */}
                  <div className="flex justify-center mb-4">
                    {folderIcon.startsWith('data:image') ? (
                      <img 
                        src={folderIcon} 
                        alt="Folder icon" 
                        className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-full animate-[float_3s_ease-in-out_infinite] shadow-lg ring-2 ring-cyan-500/50"
                      />
                    ) : (
                      <div className="text-6xl animate-[float_3s_ease-in-out_infinite] drop-shadow-lg">
                        {folderIcon}
                      </div>
                    )}
                  </div>
                  
                  <input
                    type="text"
                    placeholder="Mappa neve..."
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-4"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && folderName.trim()) {
                        // Get all message IDs from selected groups (not just lastMessageId)
                        const allSelectedMessageIds: string[] = [];
                        groupedMessages.forEach(group => {
                          if (selectedMessages.has(group.lastMessageId)) {
                            // Add all messages from this group
                            group.messages.forEach((msg: any) => {
                              allSelectedMessageIds.push(msg.id);
                            });
                          }
                        });
                        
                        const newFolder = {
                          id: Date.now().toString(),
                          name: folderName,
                          icon: folderIcon,
                          messageIds: allSelectedMessageIds,
                          visibility: folderVisibility,
                          closedBy: [],
                          createdBy: me?.id || ''
                        };
                        
                        // Send folder to backend via WebSocket - backend will save and broadcast
                        if (socket && activeConversationId) {
                          console.log('📤 Sending folder:create event', { conversationId: activeConversationId, folder: newFolder });
                          socket.emit('folder:create', {
                            conversationId: activeConversationId,
                            folder: newFolder
                          });
                          // Folder will be added via folder:new event from backend
                        } else {
                          console.log('⚠️ Cannot create folder: No socket or conversation');
                        }
                        
                        setFolderName('');
                        setFolderIcon('📁');
                        setFolderVisibility('private');
                        setShowFolderDialog(false);
                        setShowCreateNewFolder(false);
                        setSelectedMessages(new Set());
                      }
                    }}
                    autoFocus
                  />
                  
                  {/* Icon selector */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ikon választás</label>
                    
                    {/* File upload button */}
                    <label className="block mb-3 cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-lg hover:from-cyan-700 hover:to-teal-700 transition-all shadow-lg text-center">
                        <span className="text-xl">📤</span>
                        <span className="text-sm">Saját kép feltöltése</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setFolderIcon(event.target?.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    
                    <div className="grid grid-cols-6 gap-2">
                      {['📁', '📂', '🗂️', '📋', '📄', '📝', '🎯', '⭐', '💼', '🎨', '🔥', '💡', '🎵', '🎮', '🏆', '❤️', '💬', '🌟'].map(icon => (
                        <button
                          key={icon}
                          onClick={() => setFolderIcon(icon)}
                          className={`text-3xl p-2 rounded-lg transition-all hover:scale-110 ${
                            folderIcon === icon
                              ? 'bg-cyan-600 ring-2 ring-cyan-400'
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Visibility options */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Láthatóság</label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setFolderVisibility('private')}
                        className={`flex-1 px-4 py-2 rounded-lg border transition-all ${
                          folderVisibility === 'private'
                            ? 'bg-cyan-600 border-cyan-500 text-white'
                            : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        🔒 Privát
                      </button>
                      <button
                        onClick={() => setFolderVisibility('shared')}
                        className={`flex-1 px-4 py-2 rounded-lg border transition-all ${
                          folderVisibility === 'shared'
                            ? 'bg-cyan-600 border-cyan-500 text-white'
                            : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        👥 Megosztott
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {folderVisibility === 'private' 
                        ? 'Csak te látod ezt a mappát' 
                        : 'A másik fél is látja ezt a mappát'}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (folderName.trim()) {
                          // Get all message IDs from selected groups (not just lastMessageId)
                          const allSelectedMessageIds: string[] = [];
                          groupedMessages.forEach(group => {
                            if (selectedMessages.has(group.lastMessageId)) {
                              // Add all messages from this group
                              group.messages.forEach((msg: any) => {
                                allSelectedMessageIds.push(msg.id);
                              });
                            }
                          });
                          
                          const newFolder = {
                            id: Date.now().toString(),
                            name: folderName,
                            icon: folderIcon,
                            messageIds: allSelectedMessageIds,
                            visibility: folderVisibility,
                            closedBy: [],
                            createdBy: me?.id || ''
                          };
                          
                          // Send folder to backend via WebSocket - backend will save and broadcast
                          if (socket && activeConversationId) {
                            console.log('📤 Sending folder:create event', { conversationId: activeConversationId, folder: newFolder });
                            socket.emit('folder:create', {
                              conversationId: activeConversationId,
                              folder: newFolder
                            });
                            // Folder will be added via folder:new event from backend
                          } else {
                            console.log('⚠️ Cannot create folder: No socket or conversation');
                          }
                          
                          setFolderName('');
                          setFolderIcon('📁');
                          setFolderVisibility('private');
                          setShowFolderDialog(false);
                          setShowCreateNewFolder(false);
                          setSelectedMessages(new Set());
                        }
                      }}
                      className="flex-1 px-3 md:px-4 py-1.5 md:py-2 text-sm md:text-base bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-lg hover:from-cyan-700 hover:to-teal-700 transition-all shadow-lg"
                    >
                      Létrehoz
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateNewFolder(false);
                        setFolderName('');
                        setFolderIcon('📁');
                        setFolderVisibility('private');
                      }}
                      className="flex-1 px-3 md:px-4 py-1.5 md:py-2 text-sm md:text-base bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all"
                    >
                      Vissza
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Now Listening Panel - shows what the other user is listening to */}
            {Object.keys(audioPositions).length > 0 && Object.values(audioPositions).some(pos => pos.userId !== me?.id) && (
              <div className="bg-gradient-to-r from-cyan-900/10 to-teal-900/10 border-b border-cyan-500/20 relative backdrop-blur-sm flex-shrink-0">
                <div className="px-2 md:px-4 py-2 md:py-3 flex flex-col items-center justify-center gap-2">
                  {Object.entries(audioPositions)
                    .filter(([_, pos]) => pos.userId !== me?.id)
                    .map(([messageId, pos]) => {
                      // Find the message to get its content
                      const message = filteredMessages.find(m => m.id === messageId);
                      const isSelected = selectedAudioMessageId === messageId;
                      
                      return (
                        <button
                          key={messageId}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedAudioMessageId(null);
                            } else {
                              setSelectedAudioMessageId(messageId);
                            }
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                            isSelected 
                              ? 'bg-cyan-600/40 border-2 border-cyan-400/60 shadow-lg scale-105' 
                              : 'bg-cyan-600/10 border border-cyan-500/20 hover:bg-cyan-600/40 hover:border-cyan-400/60 hover:scale-102'
                          }`}
                        >
                          <span className="text-2xl opacity-60">🎧</span>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-cyan-300 text-sm font-semibold opacity-70">{pos.username}</span>
                              <span className="text-cyan-400 text-xs font-mono opacity-60">{formatDuration(pos.position)}</span>
                            </div>
                            {message && (
                              <p className="text-gray-300 text-xs truncate max-w-full opacity-60">
                                {message.content || 'Hangfájl'}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-cyan-400 opacity-50">
                            {isSelected ? '✓ Mutatva' : 'Kattints a megtekintéshez'}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Last message panel - below header */}
            {otherPersonLastMessage && (
              <div className="bg-gray-900/30 border-b border-gray-700/50 relative backdrop-blur-md flex-shrink-0">
                {!isLastMessagePanelCollapsed ? (
                  <div className="px-2 md:px-4 py-1.5 md:py-2 flex flex-col items-center justify-center gap-1 md:gap-2">
                    {/* Partner info */}
                    <div className="flex items-center gap-2 md:gap-3">
                      {otherPersonLastMessage.sender?.avatarImage ? (
                        <img 
                          src={otherPersonLastMessage.sender.avatarImage} 
                          alt="Avatar"
                          className={`w-8 h-8 md:w-10 md:h-10 rounded-full object-cover shadow-lg ring-2 ${
                            otherPersonLastMessage.sender.lastSeen && 
                            new Date().getTime() - new Date(otherPersonLastMessage.sender.lastSeen).getTime() < 60 * 1000
                              ? 'ring-green-500 avatar-online'
                              : 'ring-gray-500'
                          }`}
                        />
                      ) : (
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs md:text-sm font-bold shadow-lg">
                          {getInitials(otherPersonLastMessage.sender?.username || 'User')}
                        </div>
                      )}
                      <span className="text-sm md:text-lg font-bold bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-300 bg-clip-text text-transparent animate-gradient-x truncate max-w-[150px] md:max-w-none">
                        {otherPersonLastMessage.sender?.username || 'User'}
                      </span>
                    </div>
                    <button
                      onClick={() => setIsLastMessagePanelCollapsed(true)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
                      title="Összecsukás"
                    >
                      <span>{visibleDate && otherPersonLastMessage.overallLastMessage ? `${visibleDate} utolsó üzenete:` : 'Utolsó üzenet:'}</span>
                      <span>▲</span>
                    </button>
                    <div className="flex justify-center items-center w-full px-2 gap-2 md:gap-4">
                      {/* Show overall last message on the left if we're viewing a specific date */}
                      {visibleDate && otherPersonLastMessage.overallLastMessage && (
                        <div className="flex-1 flex flex-col items-center gap-1 p-2 border border-green-500/30 rounded-lg bg-green-900/10 animate-fade-in-left">
                          <span className="text-xs text-green-400 font-semibold">Legfrissebb üzenet</span>
                          {otherPersonLastMessage.overallLastMessage.lastMessage?.fileUrl ? (
                            <div className="w-full max-w-xs">
                              {otherPersonLastMessage.overallLastMessage.lastMessage.fileType?.startsWith('audio/') ? (
                                <CustomAudioPlayer 
                                  src={`${API_URL}${otherPersonLastMessage.overallLastMessage.lastMessage.fileUrl}`}
                                  type={otherPersonLastMessage.overallLastMessage.lastMessage.fileType}
                                  thumbnail={otherPersonLastMessage.overallLastMessage.lastMessage.audioThumbnail}
                                  messageId={otherPersonLastMessage.overallLastMessage.lastMessage.id}
                                  conversationId={activeConversationId || undefined}
                                  otherUserPlaying={audioPositions[otherPersonLastMessage.overallLastMessage.lastMessage.id] || null}
                                  isCollapsedFirstAudio={false}
                                  fileName={otherPersonLastMessage.overallLastMessage.lastMessage.content || otherPersonLastMessage.overallLastMessage.lastMessage.fileName}
                                />
                              ) : otherPersonLastMessage.overallLastMessage.lastMessage.fileType?.startsWith('image/') ? (
                                <img 
                                  src={`${API_URL}${otherPersonLastMessage.overallLastMessage.lastMessage.fileUrl}`}
                                  alt={otherPersonLastMessage.overallLastMessage.lastMessage.fileName || 'Kép'}
                                  className="max-w-full max-h-32 rounded-lg shadow-lg cursor-pointer border border-purple-500/30"
                                  onClick={() => otherPersonLastMessage.overallLastMessage?.lastMessage?.fileUrl && window.open(`${API_URL}${otherPersonLastMessage.overallLastMessage.lastMessage.fileUrl}`, '_blank')}
                                />
                              ) : otherPersonLastMessage.overallLastMessage.lastMessage.fileType?.startsWith('video/') ? (
                                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30 rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm">
                                  <div className="w-12 h-12 rounded bg-gray-900 flex items-center justify-center border border-red-500/30">
                                    <span className="text-2xl">🎬</span>
                                  </div>
                                  <div className="flex flex-col items-start">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-red-400 text-sm">📹</span>
                                      <span className="text-red-300 text-xs font-medium truncate max-w-[150px]">
                                        {otherPersonLastMessage.overallLastMessage.lastMessage.fileName || 'Video'}
                                      </span>
                                    </div>
                                    <span className="text-gray-400 text-xs">Video fájl</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-gray-600/20 to-gray-700/20 border border-gray-500/30 rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm">
                                  <div className="w-10 h-10 rounded bg-gray-900 flex items-center justify-center border border-gray-500/30">
                                    <span className="text-xl">📄</span>
                                  </div>
                                  <div className="flex flex-col items-start">
                                    <span className="text-gray-300 text-xs font-medium truncate max-w-[150px]">
                                      {otherPersonLastMessage.overallLastMessage.lastMessage.fileName || 'Fájl'}
                                    </span>
                                    <span className="text-gray-400 text-xs">{otherPersonLastMessage.overallLastMessage.lastMessage.fileType || 'Fájl'}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (() => {
                            /* Check for links in content */
                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                            const links = otherPersonLastMessage.overallLastMessage.content?.match(urlRegex);
                            const firstLink = links?.[0];
                            
                            if (firstLink) {
                              const isYouTube = firstLink.includes('youtube.com') || firstLink.includes('youtu.be') || firstLink.includes('shorts/');
                              const preview = linkPreviews[firstLink];
                              const ytId = isYouTube ? extractYouTubeVideoId(firstLink) : null;
                              const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : (preview && !preview.error ? preview.image : undefined);
                              
                              if (preview && !preview.error) {
                                return isYouTube && (preview && !preview.error || ytId) ? (
                                  /* YouTube link card */
                                  <a
                                    href={firstLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600/20 to-red-700/20 border border-red-500/30 rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm max-w-xs hover:border-red-500/60 hover:scale-105 transition-all"
                                  >
                                    {thumbUrl && (
                                      <img 
                                        src={thumbUrl}
                                        alt="YouTube thumbnail"
                                        className="w-12 h-9 rounded object-cover border border-red-500/30"
                                      />
                                    )}
                                    <div className="flex flex-col items-start flex-1 min-w-0">
                                      <div className="flex items-start gap-1">
                                        <span className="text-red-400 text-xs flex-shrink-0">🎥</span>
                                        <span className="text-red-300 text-xs font-medium break-words line-clamp-2">
                                          {(preview && (preview.title || preview.siteName)) || 'YouTube videó'}
                                        </span>
                                      </div>
                                      <span className="text-gray-400 text-xs">YouTube videó</span>
                                    </div>
                                  </a>
                                ) : (
                                  /* Regular link card */
                                  <a
                                    href={firstLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm max-w-xs hover:border-cyan-500/60 hover:scale-105 transition-all"
                                  >
                                    {preview.image && (
                                      <img 
                                        src={preview.image}
                                        alt="Link preview"
                                        className="w-10 h-10 rounded object-cover border border-cyan-500/30"
                                      />
                                    )}
                                    <div className="flex flex-col items-start flex-1 min-w-0">
                                      <span className="text-cyan-300 text-xs font-medium break-words line-clamp-2">
                                        {preview.title || preview.siteName || 'Link'}
                                      </span>
                                      <span className="text-gray-400 text-xs break-words line-clamp-1">{preview.siteName || new URL(firstLink).hostname}</span>
                                    </div>
                                  </a>
                                );
                              }
                            }
                            
                            /* Regular text message */
                            return (
                              <p className="text-xs text-gray-300 line-clamp-2 text-center">{otherPersonLastMessage.overallLastMessage.content}</p>
                            );
                          })()}
                        </div>
                      )}
                      {/* Current visible date message */}
                      <div key={otherPersonLastMessage.lastMessage?.id} className={`flex flex-col items-center ${visibleDate && otherPersonLastMessage.overallLastMessage ? 'flex-1' : 'w-full'} animate-fade-in-up`}>
                      {otherPersonLastMessage.lastMessage?.fileUrl ? (
                        /* Media cards */
                        otherPersonLastMessage.lastMessage.fileType?.startsWith('audio/') ? (
                          /* Audio player card - full player like on chat wall */
                          <div className="w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto">
                            <CustomAudioPlayer 
                              src={`${API_URL}${otherPersonLastMessage.lastMessage.fileUrl}`}
                              type={otherPersonLastMessage.lastMessage.fileType}
                              thumbnail={otherPersonLastMessage.lastMessage.audioThumbnail}
                              messageId={otherPersonLastMessage.lastMessage.id}
                              conversationId={activeConversationId || undefined}
                              otherUserPlaying={audioPositions[otherPersonLastMessage.lastMessage.id] || null}
                              isCollapsedFirstAudio={false}
                              fileName={otherPersonLastMessage.lastMessage.content || otherPersonLastMessage.lastMessage.fileName}
                              onDisconnectOtherUser={() => {
                                ignoredAudioPositionsRef.current.add(otherPersonLastMessage.lastMessage.id);
                                setAudioPositions(prev => {
                                  const newPositions = { ...prev };
                                  delete newPositions[otherPersonLastMessage.lastMessage.id];
                                  return newPositions;
                                });
                                const otherUser = audioPositions[otherPersonLastMessage.lastMessage.id];
                                if (otherUser) {
                                  const timerKey = `${otherPersonLastMessage.lastMessage.id}-${otherUser.userId}`;
                                  if (audioPositionTimers.current[timerKey]) {
                                    clearTimeout(audioPositionTimers.current[timerKey]);
                                    delete audioPositionTimers.current[timerKey];
                                  }
                                }
                              }}
                            />
                          </div>
                        ) : otherPersonLastMessage.lastMessage.fileType?.startsWith('image/') ? (
                          /* Image - just the image */
                          <img 
                            src={`${API_URL}${otherPersonLastMessage.lastMessage.fileUrl}`}
                            alt={otherPersonLastMessage.lastMessage.fileName || 'Kép'}
                            className="max-w-full max-h-64 rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity border border-purple-500/30"
                            onClick={() => window.open(`${API_URL}${otherPersonLastMessage.lastMessage.fileUrl}`, '_blank')}
                          />
                        ) : otherPersonLastMessage.lastMessage.fileType?.startsWith('video/') ? (
                          /* Video card */
                          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30 rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm mx-auto">
                            <div className="w-12 h-12 rounded bg-gray-900 flex items-center justify-center border border-red-500/30">
                              <span className="text-2xl">🎬</span>
                            </div>
                            <div className="flex flex-col items-start">
                              <div className="flex items-center gap-1.5">
                                <span className="text-red-400 text-sm">📹</span>
                                <span className="text-red-300 text-xs md:text-sm font-medium">
                                  {otherPersonLastMessage.lastMessage.fileName || 'Video'}
                                </span>
                              </div>
                              <span className="text-gray-400 text-xs">Video fájl</span>
                            </div>
                          </div>
                        ) : (
                          /* Other file card */
                          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-gray-600/20 to-gray-700/20 border border-gray-500/30 rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm mx-auto">
                            <div className="w-10 h-10 rounded bg-gray-900 flex items-center justify-center border border-gray-500/30">
                              <span className="text-xl">📄</span>
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="text-gray-300 text-xs md:text-sm font-medium truncate max-w-[200px]">
                                {otherPersonLastMessage.lastMessage.fileName || 'Fájl'}
                              </span>
                              <span className="text-gray-400 text-xs">{otherPersonLastMessage.lastMessage.fileType || 'Fájl'}</span>
                            </div>
                          </div>
                        )
                      ) : (() => {
                        /* Check for links in content */
                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        const links = otherPersonLastMessage.content?.match(urlRegex);
                        const firstLink = links?.[0];
                        
                        if (firstLink) {
                          const isYouTube = firstLink.includes('youtube.com') || firstLink.includes('youtu.be') || firstLink.includes('shorts/');
                          const preview = linkPreviews[firstLink];
                          const ytId = isYouTube ? extractYouTubeVideoId(firstLink) : null;
                          const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : (preview && !preview.error ? preview.image : undefined);
                          
                          if (preview && !preview.error) {
                            return isYouTube && (preview && !preview.error || ytId) ? (
                              /* YouTube link card - clickable */
                              <a
                                href={firstLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600/20 to-red-700/20 border border-red-500/30 rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm max-w-md hover:border-red-500/60 hover:scale-105 transition-all mx-auto"
                              >
                                {thumbUrl && (
                                  <img 
                                    src={thumbUrl}
                                    alt="YouTube thumbnail"
                                    className="w-16 h-12 rounded object-cover border border-red-500/30"
                                  />
                                )}
                                <div className="flex flex-col items-start flex-1 min-w-0">
                                  <div className="flex items-start gap-1.5">
                                    <span className="text-red-400 text-sm flex-shrink-0">🎥</span>
                                    <span className="text-red-300 text-xs md:text-sm font-medium break-words line-clamp-2">
                                      {(preview && preview.title) || 'YouTube videó'}
                                    </span>
                                  </div>
                                  <span className="text-gray-400 text-xs">YouTube</span>
                                </div>
                              </a>
                            ) : (
                              /* Regular link card - clickable */
                              <a
                                href={firstLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm max-w-md hover:border-cyan-500/60 hover:scale-105 transition-all mx-auto"
                              >
                                {preview.image && (
                                  <img 
                                    src={preview.image}
                                    alt="Link preview"
                                    className="w-12 h-12 rounded object-cover border border-cyan-500/30"
                                  />
                                )}
                                <div className="flex flex-col items-start flex-1 min-w-0">
                                  <div className="flex items-start gap-1.5">
                                    <span className="text-cyan-400 text-sm flex-shrink-0">🔗</span>
                                    <span className="text-cyan-300 text-xs md:text-sm font-medium break-words line-clamp-2">
                                      {preview.title || preview.siteName || 'Link'}
                                    </span>
                                  </div>
                                  <span className="text-gray-400 text-xs break-words line-clamp-1">{preview.siteName || new URL(firstLink).hostname}</span>
                                </div>
                              </a>
                            );
                          }
                        }
                        
                        /* Regular text message */
                        return (
                          <p className="text-cyan-300 text-xs md:text-sm font-light whitespace-pre-wrap break-words leading-tight line-clamp-2 md:line-clamp-none text-center typewriter-text">
                            "{otherPersonLastMessage.content?.split('').map((char: string, charIndex: number) => (
                              <span 
                                key={charIndex} 
                                style={{ animationDelay: `${charIndex * 0.05}s` }}
                              >
                                {char}
                              </span>
                            ))}"
                          </p>
                        );
                      })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsLastMessagePanelCollapsed(false)}
                    className="w-full py-1 text-gray-500 hover:text-gray-300 transition-colors text-xs flex items-center justify-center gap-1"
                    title="Kibontás"
                  >
                    <span>Utolsó üzenet:</span>
                    <span>▼</span>
                  </button>
                )}
              </div>
            )}

            {/* Folders panel */}
            {folders.filter(f => 
              !f.closedBy.includes(me?.id || '') && 
              (f.visibility === 'shared' || f.createdBy === me?.id)
            ).length > 0 && (
              <div className="bg-gray-900/30 border-b border-gray-700/50 backdrop-blur-md px-2 md:px-4 py-1.5 md:py-2 flex-shrink-0">
                <div className="flex flex-col gap-2">
                  {/* First row: inactive folders */}
                  <div className="flex gap-1 md:gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 pb-1">
                    {folders
                      .filter(f => 
                        !f.closedBy.includes(me?.id || '') && 
                        (f.visibility === 'shared' || f.createdBy === me?.id) &&
                        f.id !== activeFolderId
                      )
                      .map(folder => (
                      <div
                        key={folder.id}
                        className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg backdrop-blur-md cursor-pointer transition-all duration-300 ease-in-out flex-shrink-0 ${
                          activeFolderId
                            ? 'bg-gradient-to-r from-cyan-600/20 to-teal-600/20 border-cyan-500/20 opacity-40'
                            : 'bg-gradient-to-r from-cyan-600/40 to-teal-600/40 border-cyan-500/30 hover:from-cyan-600/60 hover:to-teal-600/60 hover:scale-105'
                        }`}
                        onClick={() => {
                          setActiveFolderId(folder.id);
                        }}
                      >
                        {folder.icon?.startsWith('data:image') ? (
                          <img 
                            src={folder.icon} 
                            alt="folder icon"
                            className="w-8 h-8 object-cover rounded-full shadow-md ring-1 ring-cyan-500/30 transition-all duration-300"
                          />
                        ) : (
                          <span className="text-xl transition-all duration-300">{folder.icon || '📁'}</span>
                        )}
                        {folder.visibility === 'shared' && <span className="text-xs">👥</span>}
                        {folder.visibility === 'private' && <span className="text-xs">🔒</span>}
                        <span className="text-sm text-cyan-300 font-light">{folder.name}</span>
                        <span className="text-xs text-cyan-400/70">({folder.messageIds.length})</span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (folder.visibility === 'shared') {
                              try {
                                await apiFolderClose(folder.id);
                                setFolders(prev => prev.map(f => 
                                  f.id === folder.id 
                                    ? { ...f, closedBy: [...f.closedBy, me?.id || ''] }
                                    : f
                                ));
                              } catch (err) {
                                console.error('❌ Failed to close folder:', err);
                              }
                            } else {
                              // Show confirmation for private folder deletion
                              if (window.confirm(`Biztosan törölni szeretnéd a "${folder.name}" mappát? Minden benne lévő üzenet elvész!`)) {
                                try {
                                  await apiFolderClose(folder.id);
                                  setFolders(prev => prev.filter(f => f.id !== folder.id));
                                } catch (err) {
                                  console.error('❌ Failed to delete folder:', err);
                                }
                              }
                            }
                          }}
                          className="ml-1 text-gray-400 hover:text-red-400 transition-colors"
                          title={folder.visibility === 'shared' ? 'Bezárás (csak neked)' : 'Törlés'}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Second row: active folder */}
                  {activeFolderId && folders
                    .filter(f => 
                      !f.closedBy.includes(me?.id || '') && 
                      (f.visibility === 'shared' || f.createdBy === me?.id) &&
                      f.id === activeFolderId
                    )
                    .map(folder => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-center gap-2 px-3 py-1.5 border rounded-lg backdrop-blur-md cursor-pointer transition-all duration-300 ease-in-out bg-gradient-to-r from-cyan-600/80 to-teal-600/80 border-cyan-400 ring-2 ring-cyan-400 scale-110 shadow-xl shadow-cyan-500/30"
                      onClick={() => {
                        setActiveFolderId(null);
                      }}
                    >
                      {folder.icon?.startsWith('data:image') ? (
                        <img 
                          src={folder.icon} 
                          alt="folder icon"
                          className={`w-8 h-8 object-cover rounded-full shadow-md ring-1 ring-cyan-500/30 transition-all duration-300 ${
                            activeFolderId === folder.id ? 'animate-[float_3s_ease-in-out_infinite]' : ''
                          }`}
                        />
                      ) : (
                        <span className={`text-base md:text-xl transition-all duration-300 ${
                          activeFolderId === folder.id ? 'animate-[float_3s_ease-in-out_infinite]' : ''
                        }`}>{folder.icon || '📁'}</span>
                      )}
                      {folder.visibility === 'shared' && <span className="text-xs hidden sm:inline">👥</span>}
                      {folder.visibility === 'private' && <span className="text-xs hidden sm:inline">🔒</span>}
                      <span className="text-xs md:text-sm text-cyan-300 font-light truncate max-w-[100px] md:max-w-none">{folder.name}</span>
                      <span className="text-xs text-cyan-400/70">({folder.messageIds.length})</span>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          // If active, just deactivate
                          if (activeFolderId === folder.id) {
                            setActiveFolderId(null);
                          } else {
                            // If inactive, delete/close
                            if (folder.visibility === 'shared') {
                              try {
                                await apiFolderClose(folder.id);
                                setFolders(prev => prev.map(f => 
                                  f.id === folder.id 
                                    ? { ...f, closedBy: [...f.closedBy, me?.id || ''] }
                                    : f
                                ));
                              } catch (err) {
                                console.error('❌ Failed to close folder:', err);
                              }
                            } else {
                              // Show confirmation for private folder deletion
                              if (window.confirm(`Biztosan törölni szeretnéd a "${folder.name}" mappát? Minden benne lévő üzenet elvész!`)) {
                                try {
                                  await apiFolderClose(folder.id);
                                  setFolders(prev => prev.filter(f => f.id !== folder.id));
                                } catch (err) {
                                  console.error('❌ Failed to delete folder:', err);
                                }
                              }
                            }
                          }
                        }}
                        className="ml-0.5 md:ml-1 text-gray-400 hover:text-red-400 transition-colors text-xs md:text-sm flex-shrink-0"
                        title={activeFolderId === folder.id ? 'Inaktiválás' : (folder.visibility === 'shared' ? 'Bezárás (csak neked)' : 'Törlés')}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Exit filter button - shown when audio message is selected */}
                {selectedAudioMessageId && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setSelectedAudioMessageId(null)}
                      className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                      title="Szűrés kikapcsolása"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}

            <div 
              className="flex-1 overflow-y-auto p-2 md:p-4 pb-20 md:pb-24 bg-gray-850 particles-bg"
              ref={messagesContainerRef}
              onScroll={handleScroll}
            >
              {filteredMessages.length === 0 && searchQuery && (
                <div className="text-center text-gray-400 mt-8">
                  <p>Nincs találat: "{searchQuery}"</p>
                </div>
              )}
              {groupedMessages.map((group, groupIndex) => {
                const prevGroup = groupedMessages[groupIndex - 1];
                const firstMsg = group.messages[0];
                const hasNewMessage = group.messages.some((m: any) => newMessageIds.has(m.id));
                const isLastMessage = groupIndex === groupedMessages.length - 1;
                
                return (
                <React.Fragment key={group.id}>
                  {/* Date separator */}
                  {shouldShowDateSeparator(firstMsg, prevGroup?.messages[prevGroup.messages.length - 1]) && (
                    <div className="date-separator my-6 sticky top-0 z-10">
                      <span className="bg-gray-800 px-3 py-1 rounded-full text-xs text-gray-400 shadow-lg">
                        {formatDate(firstMsg.createdAt)}
                      </span>
                    </div>
                  )}
                  
                  <div
                    className={`mb-3 md:mb-4 flex items-end gap-1 md:gap-2 message-slide-in ${
                      group.senderId === me?.id ? 'justify-end flex-row-reverse ml-auto' : 'justify-start mr-auto'
                    }`}
                    style={{ maxWidth: isMobile ? '95%' : isTablet ? '90%' : '75%' }}
                    onMouseEnter={() => setHoveredMessageId(group.lastMessageId)}
                    onTouchStart={() => {
                      longPressTimerRef.current = window.setTimeout(() => {
                        setSelectedMessages(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(group.lastMessageId)) {
                            newSet.delete(group.lastMessageId);
                          } else {
                            newSet.add(group.lastMessageId);
                          }
                          return newSet;
                        });
                      }, 500);
                    }}
                    onTouchEnd={() => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                    }}
                    onMouseDown={() => {
                      longPressTriggeredRef.current = false;
                      longPressTimerRef.current = window.setTimeout(() => {
                        longPressTriggeredRef.current = true;
                        setSelectedMessages(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(group.lastMessageId)) {
                            newSet.delete(group.lastMessageId);
                          } else {
                            newSet.add(group.lastMessageId);
                          }
                          return newSet;
                        });
                      }, 500);
                    }}
                    onMouseUp={() => {
                      if (longPressTimerRef.current && !longPressTriggeredRef.current) {
                        clearTimeout(longPressTimerRef.current);
                      }
                      longPressTimerRef.current = null;
                    }}
                    onMouseLeave={() => {
                      if (longPressTimerRef.current && !longPressTriggeredRef.current) {
                        clearTimeout(longPressTimerRef.current);
                      }
                      longPressTimerRef.current = null;
                      setHoveredMessageId(null);
                    }}
                    onClick={(e) => {
                      if (selectedMessages.size > 0 && !longPressTriggeredRef.current) {
                        e.preventDefault();
                        setSelectedMessages(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(group.lastMessageId)) {
                            newSet.delete(group.lastMessageId);
                          } else {
                            newSet.add(group.lastMessageId);
                          }
                          return newSet;
                        });
                      } else if (!longPressTriggeredRef.current) {
                        e.preventDefault();
                        handleMessageClick(group.lastMessageId);
                      }
                      longPressTriggeredRef.current = false;
                    }}
                    ref={(el) => {
                      if (el) {
                        messageRefs.current.set(group.lastMessageId, el);
                      }
                    }}
                  >
                    {/* Avatar */}
                    {group.messages[0]?.sender?.avatarImage ? (
                      <img 
                        src={group.messages[0].sender.avatarImage} 
                        alt="Avatar"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingAvatar(group.messages[0].sender.avatarImage);
                        }}
                        className={`w-8 h-8 rounded-full object-cover flex-shrink-0 shadow-lg ring-2 cursor-pointer hover:ring-4 transition-all ${
                          group.messages[0].sender.lastSeen && 
                          new Date().getTime() - new Date(group.messages[0].sender.lastSeen).getTime() < 60 * 1000
                            ? 'ring-green-500 avatar-online'
                            : 'ring-gray-500'
                        }`}
                      />
                    ) : (
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br flex-shrink-0 ${
                        group.senderId === me?.id 
                          ? 'from-cyan-500 to-teal-500' 
                          : 'from-purple-500 to-pink-500'
                      } flex items-center justify-center text-white text-xs font-bold shadow-lg ${
                        group.messages[0]?.sender?.lastSeen && 
                        new Date().getTime() - new Date(group.messages[0].sender.lastSeen).getTime() < 60 * 1000
                          ? 'avatar-online'
                          : ''
                      }`}>
                        {getInitials(group.messages[0]?.sender?.username || 'User')}
                      </div>
                    )}
                    
                    <div className="flex-1 flex gap-1 sm:gap-2 md:gap-3 items-stretch flex-wrap md:flex-nowrap">
                      {/* Audio playlist panel - shown on the left of message when group has multiple audio files AND expanded */}
                      {(() => {
                        // Use playlistTicker to force re-render when audio playing state changes
                        playlistTicker; // Trigger re-render
                        const audioMessages = group.messages.filter((m: any) => m.fileType?.startsWith('audio/'));
                        const isExpanded = expandedAudioGroups.has(group.lastMessageId);
                        if (audioMessages.length > 1 && isExpanded) {
                          return (
                            <div className={`flex-shrink-0 w-full sm:w-40 md:w-48 p-1.5 sm:p-2 rounded-lg bg-gray-800/50 border border-gray-700/50 backdrop-blur-sm order-first ${
                              group.senderId === me?.id ? 'border-l-2 border-l-cyan-500' : 'border-l-2 border-l-gray-600'
                            }`}>
                              <div className="flex items-center gap-1 sm:gap-2 mb-1.5 sm:mb-2 pb-1.5 sm:pb-2 border-b border-gray-700/30">
                                <span className="text-xs text-gray-500">({audioMessages.length})</span>
                              </div>
                              <div className="space-y-0.5 sm:space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800" style={{ maxHeight: 'calc(100% - 36px)' }}>
                                {audioMessages.map((audioMsg: any, idx: number) => {
                                  const callbacks = (window as any).audioRefsMap?.get(audioMsg.id);
                                  const isCurrentlyPlaying = callbacks?.isPlaying?.() || false;
                                  
                                  return (
                                    <button
                                      key={audioMsg.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (callbacks?.seekAndPlay) {
                                          callbacks.seekAndPlay(0);
                                        }
                                        const messageElement = messageRefs.current.get(audioMsg.id);
                                        if (messageElement) {
                                          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                      }}
                                      className={`w-full text-left px-1.5 sm:px-2 py-1 sm:py-1.5 rounded transition-all group flex items-center gap-1 sm:gap-2 ${
                                        isCurrentlyPlaying 
                                          ? 'bg-cyan-600/30 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                                          : 'hover:bg-gray-700/50'
                                      }`}
                                    >
                                      <span className={`text-[10px] sm:text-xs flex-shrink-0 ${isCurrentlyPlaying ? 'text-cyan-400 font-bold' : 'text-gray-500'}`}>
                                        {idx + 1}.
                                      </span>
                                      <span className={`text-[10px] sm:text-xs truncate flex-1 ${
                                        isCurrentlyPlaying ? 'text-cyan-300 font-semibold' : 'text-gray-300 group-hover:text-cyan-400'
                                      }`}>
                                        {audioMsg.content || audioMsg.fileName || '♪'}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      <div
                        onClick={(e) => {
                          // Toggle reactions on click (for mobile)
                          if (!e.defaultPrevented && selectedMessages.size === 0) {
                            setShowReactionsForMessage(
                              showReactionsForMessage === group.lastMessageId ? null : group.lastMessageId
                            );
                          }
                        }}
                        className={`flex-1 px-4 py-2 rounded-2xl break-words relative group message-bubble bubble-3d border transition-all duration-300 cursor-pointer ${
                          hasNewMessage
                            ? (group.senderId === me?.id ? 'glow-effect' : 'glow-effect-gray')
                            : 'shadow-xl'
                        } ${
                          selectedMessages.has(group.lastMessageId)
                            ? 'ring-4 ring-yellow-400 scale-105 selected-message'
                            : ''
                        } ${
                          highlightedMessageId === group.lastMessageId
                            ? 'ring-4 ring-cyan-400 scale-110 shadow-2xl shadow-cyan-500/50 animate-pulse'
                            : ''
                        } ${
                          // Check if any message in this group is in a folder
                          (() => {
                            if (isLastMessage) {
                              // Last message should be fully transparent
                              return group.senderId === me?.id
                                ? 'bg-transparent border-cyan-500/20 text-gray-100 rounded-br-none'
                                : 'bg-transparent border-gray-600/20 text-gray-100 rounded-bl-none';
                            }
                            
                            const isInFolder = group.messages.some((msg: any) => 
                              folders.some(f => f.messageIds.includes(msg.id))
                            );
                            if (group.senderId === me?.id) {
                              return isInFolder 
                                ? 'bg-gradient-to-r from-cyan-600/70 to-teal-600/70 border-cyan-500/50 text-gray-100 rounded-br-none'
                                : 'bg-gradient-to-r from-cyan-600/40 to-teal-600/40 border-cyan-500/30 text-gray-100 rounded-br-none';
                            } else {
                              return isInFolder
                                ? 'bg-gray-700/70 border-gray-600/50 text-gray-100 rounded-bl-none'
                                : 'bg-gray-700/40 border-gray-600/30 text-gray-100 rounded-bl-none';
                            }
                          })()
                        }`}
                      >
                        {/* Render all messages in the group */}
                        {(() => {
                          const audioMessages = group.messages.filter((m: any) => m.fileType?.startsWith('audio/'));
                          const hasMultipleAudios = audioMessages.length > 1;
                          const isExpanded = expandedAudioGroups.has(group.lastMessageId);
                          
                          return group.messages.map((m: any, msgIndex: number) => {
                            // If this is an audio message in a multi-audio group
                            if (hasMultipleAudios && m.fileType?.startsWith('audio/')) {
                              const audioIndex = audioMessages.findIndex((a: any) => a.id === m.id);
                              // Show only first audio if not expanded
                              if (audioIndex > 0 && !isExpanded) {
                                return null;
                              }
                            }
                            
                            return (
                          <div key={m.id}>
                            {editingMessageId === m.id ? (
                              <div className="flex flex-col gap-2">
                                <textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  className="w-full px-3 py-2 bg-gray-800 border border-cyan-500 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                                  rows={3}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      // Save edit
                                      setMessages(prev => prev.map(msg => 
                                        msg.id === m.id ? { ...msg, content: editingContent } : msg
                                      ));
                                      setFilteredMessages(prev => prev.map(msg => 
                                        msg.id === m.id ? { ...msg, content: editingContent } : msg
                                      ));
                                      setEditingMessageId(null);
                                      setEditingContent('');
                                    } else if (e.key === 'Escape') {
                                      setEditingMessageId(null);
                                      setEditingContent('');
                                    }
                                  }}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setMessages(prev => prev.map(msg => 
                                        msg.id === m.id ? { ...msg, content: editingContent } : msg
                                      ));
                                      setFilteredMessages(prev => prev.map(msg => 
                                        msg.id === m.id ? { ...msg, content: editingContent } : msg
                                      ));
                                      setEditingMessageId(null);
                                      setEditingContent('');
                                    }}
                                    className="px-3 py-1 bg-cyan-600 text-white text-xs rounded hover:bg-cyan-700 transition-all"
                                  >
                                    ✓ Mentés
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingMessageId(null);
                                      setEditingContent('');
                                    }}
                                    className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-all"
                                  >
                                    ✕ Mégse
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`transition-all ${
                                  editingMessageId && group.messages.length > 1 && group.messages.some((msg: any) => msg.id === editingMessageId)
                                    ? 'cursor-pointer hover:bg-white/5 rounded p-1 -m-1 hover:ring-1 hover:ring-cyan-500/30'
                                    : ''
                                }`}
                                onClick={(e) => {
                                  if (editingMessageId && group.messages.some((msg: any) => msg.id === editingMessageId) && group.messages.length > 1) {
                                    e.stopPropagation();
                                    setEditingMessageId(m.id);
                                    setEditingContent(m.content);
                                  }
                                }}
                                title={editingMessageId && group.messages.some((msg: any) => msg.id === editingMessageId) && group.messages.length > 1 ? 'Kattints a szerkesztéshez' : ''}
                              >
                                {/* File attachment display */}
                                {m.fileUrl && (
                                  <div className="mb-2">
                                    {m.fileType?.startsWith('image/') ? (
                                      <img 
                                          src={`${API_URL}${m.fileUrl}`}
                                        alt={m.fileName || 'Kép'}
                                        className="max-w-full max-h-96 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => window.open(`${API_URL}${m.fileUrl}`, '_blank')}
                                      />
                                    ) : m.fileType?.startsWith('audio/') ? (
                                      <div className="space-y-3">
                                        {(() => {
                                          const audioMessages = group.messages.filter((msg: any) => msg.fileType?.startsWith('audio/'));
                                          const isExpanded = expandedAudioGroups.has(group.lastMessageId);
                                          const audioIndex = audioMessages.findIndex((a: any) => a.id === m.id);
                                          const isFirstAudio = audioIndex === 0;
                                          const hasMultipleAudios = audioMessages.length > 1;
                                          
                                          // For collapsed groups, show rotating filename and calculate total duration
                                          const rotatingIndex = rotatingFileNameIndex[group.lastMessageId] || 0;
                                          const displayFileName = hasMultipleAudios && isFirstAudio && !isExpanded
                                            ? audioMessages[rotatingIndex]?.content || audioMessages[rotatingIndex]?.fileName
                                            : m.content || m.fileName;
                                          
                                          // Create playlist for collapsed groups
                                          const audioPlaylist = hasMultipleAudios && isFirstAudio && !isExpanded
                                            ? audioMessages.map((audio: any) => ({
                                                url: `${API_URL}${audio.fileUrl}`,
                                                fileName: audio.content || audio.fileName
                                              }))
                                            : undefined;
                                          
                                          return (
                                            <div className="flex gap-2 items-center">
                                              <div className="audio-player-wrapper w-full flex-1">
                                                <CustomAudioPlayer 
                                                  src={`${API_URL}${m.fileUrl}`} 
                                                  type={m.fileType}
                                                  thumbnail={m.audioThumbnail}
                                                  messageId={m.id}
                                                  conversationId={activeConversationId || undefined}
                                                  otherUserPlaying={audioPositions[m.id] || null}
                                                  isCollapsedFirstAudio={hasMultipleAudios && isFirstAudio && !isExpanded}
                                                  fileName={displayFileName}
                                                  playlist={audioPlaylist}
                                                  onDisconnectOtherUser={() => {
                                              // Add to ignored list
                                              ignoredAudioPositionsRef.current.add(m.id);
                                              
                                              // Clear this specific audio position
                                              setAudioPositions(prev => {
                                                const newPositions = { ...prev };
                                                delete newPositions[m.id];
                                                return newPositions;
                                              });
                                              
                                              // Clear any pending timer
                                              const otherUser = audioPositions[m.id];
                                              if (otherUser) {
                                                const timerKey = `${m.id}-${otherUser.userId}`;
                                                if (audioPositionTimers.current[timerKey]) {
                                                  clearTimeout(audioPositionTimers.current[timerKey]);
                                                  delete audioPositionTimers.current[timerKey];
                                                }
                                              }
                                            }}
                                          />
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    ) : m.fileType?.startsWith('video/') ? (
                                      <video controls className="max-w-full max-h-96 rounded-lg">
                                          <source src={`${API_URL}${m.fileUrl}`} type={m.fileType} />
                                        A böngésződ nem támogatja a video lejátszást.
                                      </video>
                                    ) : (
                                      <a 
                                          href={`${API_URL}${m.fileUrl}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                                      >
                                        <span className="text-2xl">📄</span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm text-cyan-300 truncate">{m.fileName}</p>
                                          <p className="text-xs text-gray-400">{m.fileType || 'Fájl'}</p>
                                        </div>
                                        <span className="text-xs text-gray-400">⬇️</span>
                                      </a>
                                    )}
                                  </div>
                                )}
                                
                                {/* Don't show content text for audio files - filename is shown in player */}
                                {!m.fileType?.startsWith('audio/') && (
                                  <p className={`whitespace-pre-wrap text-cyan-100 font-light ${isLastMessage && msgIndex === group.messages.length - 1 ? `typewriter-text ${isScrolling ? 'hidden-text' : ''}` : ''}`}>
                                    {isLastMessage && msgIndex === group.messages.length - 1 ? (
                                      (extractLinks(m.content).length > 0 
                                        ? m.content.replace(/(https?:\/\/[^\s]+)/g, '').trim()
                                        : m.content
                                      ).split('').map((char: string, charIndex: number) => (
                                        <span 
                                          key={charIndex} 
                                          style={{ animationDelay: `${charIndex * 0.05}s` }}
                                        >
                                          {char}
                                        </span>
                                      ))
                                    ) : (
                                      extractLinks(m.content).length > 0 
                                        ? m.content.replace(/(https?:\/\/[^\s]+)/g, '').trim()
                                        : m.content
                                    )}
                                  </p>
                                )}
                              </div>
                            )}
                            
                            {/* Link previews */}
                            {!editingMessageId && extractLinks(m.content).map((link: string, i: number) => {
                              const preview = linkPreviews[link];
                              if (!preview) {
                                // Fetch preview if not yet loaded
                                fetch(`${API_URL}/link-preview?url=${encodeURIComponent(link)}`, {
                                  headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                                  }
                                })
                                  .then(res => res.json())
                                  .then(data => {
                                    setLinkPreviews(prev => ({ ...prev, [link]: data }));
                                  })
                                  .catch((err) => {
                                    console.error('Link preview error:', err);
                                    setLinkPreviews(prev => ({ ...prev, [link]: { error: true } }));
                                  });
                                return (
                                  <div key={i} className="mt-2 p-3 bg-gray-800/50 rounded-lg animate-pulse">
                                    <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                                  </div>
                                );
                              }
                              
                              if (preview.error) {
                                return (
                                  <a
                                    key={i}
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="block mt-2 p-2 bg-black/20 rounded text-xs hover:bg-black/30 transition-colors"
                                  >
                                    🔗 {link}
                                  </a>
                                );
                              }
                              
                              // Check if it's a YouTube or TikTok link
                              const isYouTube = link.includes('youtube.com') || link.includes('youtu.be');
                              const isTikTok = link.includes('tiktok.com') || link.includes('vm.tiktok.com');
                              
                              if (isTikTok) {
                                // TikTok compact layout with thumbnail on the side
                                return (
                                  <a
                                    key={i}
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="block mt-3 overflow-hidden rounded-lg border border-gray-700 hover:border-pink-500/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-pink-500/10 group"
                                  >
                                    <div className="p-3 bg-gray-800/80 backdrop-blur-sm">
                                      <div className="flex items-start gap-3">
                                        {preview.image && (
                                          <div className="relative overflow-hidden bg-gray-900 rounded flex-shrink-0 w-32 h-20">
                                            <img 
                                              src={preview.image} 
                                              alt={preview.title}
                                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                              onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                              }}
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-pink-600/90 rounded-full flex items-center justify-center group-hover:bg-pink-500 transition-colors">
                                                <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                                  <path d="M8 5v14l11-7z"/>
                                                </svg>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-semibold text-gray-100 mb-1 line-clamp-2 group-hover:text-pink-400 transition-colors">
                                            {preview.title}
                                          </div>
                                          {preview.description && (
                                            <div className="text-xs text-gray-400 line-clamp-2 mb-1">
                                              {preview.description}
                                            </div>
                                          )}
                                          <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <span className="truncate">🎵 {preview.siteName || 'TikTok'}</span>
                                          </div>
                                        </div>
                                        <div className="flex-shrink-0 text-pink-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </div>
                                      </div>
                                    </div>
                                  </a>
                                );
                              }
                              
                              if (isYouTube) {
                                // YouTube compact layout with thumbnail on the side
                                return (
                                  <a
                                    key={i}
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="block mt-3 overflow-hidden rounded-lg border border-gray-700 hover:border-red-500/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-red-500/10 group w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl mx-auto"
                                  >
                                    <div className="p-3 bg-gray-800/80 backdrop-blur-sm">
                                      <div className="flex items-start gap-3">
                                        {preview.image && (
                                          <div className="relative overflow-hidden bg-gray-900 rounded flex-shrink-0 w-32 h-20">
                                            <img 
                                              src={preview.image} 
                                              alt={preview.title}
                                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                              onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                              }}
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-600/90 rounded-full flex items-center justify-center group-hover:bg-red-500 transition-colors">
                                                <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                                  <path d="M8 5v14l11-7z"/>
                                                </svg>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-semibold text-gray-100 mb-1 line-clamp-2 group-hover:text-red-400 transition-colors">
                                            {preview.title}
                                          </div>
                                          {preview.description && (
                                            <div className="text-xs text-gray-400 line-clamp-2 mb-1">
                                              {preview.description}
                                            </div>
                                          )}
                                          <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <span className="truncate">🎥 {preview.siteName || 'YouTube'}</span>
                                          </div>
                                        </div>
                                        <div className="flex-shrink-0 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </div>
                                      </div>
                                    </div>
                                  </a>
                                );
                              }
                              
                              // Regular link preview with compact layout (thumbnail on side)
                              return (
                                <a
                                  key={i}
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="block mt-3 overflow-hidden rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/10 group w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl mx-auto"
                                >
                                  <div className="p-3 bg-gray-800/80 backdrop-blur-sm">
                                    <div className="flex items-start gap-3">
                                      {preview.image && (
                                        <div className="relative overflow-hidden bg-gray-900 rounded flex-shrink-0 w-32 h-20">
                                          <img 
                                            src={preview.image} 
                                            alt={preview.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                            }}
                                          />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-gray-100 mb-1 line-clamp-2 group-hover:text-cyan-400 transition-colors">
                                          {preview.title}
                                        </div>
                                        {preview.description && (
                                          <div className="text-xs text-gray-400 line-clamp-2 mb-1">
                                            {preview.description}
                                          </div>
                                        )}
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                          <span className="truncate">{preview.siteName}</span>
                                        </div>
                                      </div>
                                      <div className="flex-shrink-0 text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>
                                </a>
                              );
                            })}
                            
                            {/* Add spacing between messages in group except last */}
                            {msgIndex < group.messages.length - 1 && (
                              <div className={`${m.fileType?.startsWith('audio/') ? 'h-2 border-t border-cyan-500/20 my-2' : 'h-2'}`} />
                            )}
                          </div>
                            );
                          });
                        })()}
                        
                        {/* Expand/Collapse button for multiple audio messages */}
                        {(() => {
                          const audioMessages = group.messages.filter((m: any) => m.fileType?.startsWith('audio/'));
                          if (audioMessages.length > 1) {
                            const isExpanded = expandedAudioGroups.has(group.lastMessageId);
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedAudioGroups(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(group.lastMessageId)) {
                                      newSet.delete(group.lastMessageId);
                                    } else {
                                      newSet.add(group.lastMessageId);
                                    }
                                    return newSet;
                                  });
                                }}
                                className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-all mt-2 group hover:scale-105"
                              >
                                <span className={`transform transition-all duration-300 inline-block ${
                                  isExpanded ? 'rotate-180' : 'animate-bounce'
                                }`}>
                                  ▼
                                </span>
                                <span>
                                  {isExpanded ? `Kevesebb mutatása` : `Még ${audioMessages.length - 1} audió`}
                                </span>
                              </button>
                            );
                          }
                          return null;
                        })()}
                        
                        {/* Timestamp at the end of the group */}
                        <div className="flex items-center gap-2 mt-2">
                          <p
                            className={`text-xs ${
                              group.senderId === me?.id ? 'text-cyan-200' : 'text-gray-400'
                            }`}
                          >
                            {formatTime(group.messages[group.messages.length - 1].createdAt)}
                          </p>
                          {(() => {
                            const messageFolders = folders.filter(f => 
                              !f.closedBy.includes(me?.id || '') && 
                              (f.visibility === 'shared' || f.createdBy === me?.id) &&
                              group.messages.some((msg: any) => f.messageIds.includes(msg.id))
                            );
                            if (messageFolders.length > 0) {
                              return (
                                <div className="flex gap-1 flex-wrap">
                                  {messageFolders.map(folder => (
                                    <button
                                      key={folder.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveFolderId(folder.id);
                                      }}
                                      className="inline-flex items-center px-2 py-0.5 bg-cyan-600/30 border border-cyan-500/40 rounded-full text-xs text-cyan-300 hover:bg-cyan-600/50 hover:scale-105 transition-all cursor-pointer"
                                      title={`Kattints a "${folder.name}" mappa aktiválásához`}
                                    >
                                      <span className="text-xs truncate max-w-[80px]">{folder.name}</span>
                                    </button>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        
                        {/* Action buttons on hover */}
                        {hoveredMessageId === group.lastMessageId && (
                          <div
                            className={`absolute top-0 ${
                              group.senderId === me?.id ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'
                            } flex gap-1 px-2`}
                          >
                            <button
                              onClick={() => handleCopyMessage(group.messages.map((m: any) => m.content).join('\n'))}
                              className="p-1 bg-gray-600 text-white rounded hover:bg-gray-500 text-xs shadow-lg ripple"
                              title="Másolás"
                            >
                              📋
                            </button>
                          </div>
                        )}
                        
                        {/* Reaction buttons for the last message in group - show on hover/click or if has reactions */}
                        <div className={`flex gap-1 mt-2 transition-all duration-300 ease-out ${
                          hoveredMessageId === group.lastMessageId || 
                          showReactionsForMessage === group.lastMessageId || 
                          messageReactions[group.lastMessageId]?.length > 0
                            ? 'opacity-100 max-h-20 translate-y-0'
                            : 'opacity-0 max-h-0 -translate-y-2 overflow-hidden'
                        }`}>
                          {['👍', '❤️', '😂', '😮', '😢', '🔥', '✨', '💯'].map((emoji, index) => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(group.lastMessageId, emoji)}
                              className={`reaction-btn text-sm transition-all duration-200 ${
                                messageReactions[group.lastMessageId]?.includes(emoji) 
                                  ? 'opacity-100 scale-110' 
                                  : 'opacity-40 hover:opacity-100 hover:scale-125'
                              }`}
                              style={{
                                transitionDelay: `${index * 30}ms`
                              }}
                            >
                              {emoji}
                              {messageReactions[group.lastMessageId]?.filter(e => e === emoji).length > 0 && (
                                <span className="text-xs ml-0.5">
                                  {messageReactions[group.lastMessageId]?.filter(e => e === emoji).length}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
              })}
              {isTyping && (() => {
                // Find the other user's avatar from messages
                const otherUserMessage = messages.find((m: any) => m.sender?.id !== me?.id);
                const otherUserAvatar = otherUserMessage?.sender?.avatarImage;
                const otherUserLastSeen = otherUserMessage?.sender?.lastSeen;
                const isOnline = otherUserLastSeen && 
                  new Date().getTime() - new Date(otherUserLastSeen).getTime() < 60 * 1000;
                
                return (
                  <div className="mb-3 flex justify-start items-end gap-2 message-slide-in w-full">
                    {otherUserAvatar ? (
                      <img 
                        src={otherUserAvatar} 
                        alt="Avatar"
                        className={`w-8 h-8 rounded-full object-cover flex-shrink-0 shadow-lg ring-2 ${
                          isOnline ? 'ring-green-500 avatar-online' : 'ring-gray-500'
                        }`}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                        U
                      </div>
                    )}
                    <div className="px-4 py-3 rounded-2xl rounded-bl-none bg-gray-700 shadow-xl">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></span>
                          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                        </div>
                        {typingTextLength > 0 && (
                          <span className="text-xs text-cyan-300 font-mono">
                            {typingTextLength} karakter
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div ref={bottomRef} className="h-16" />
              
              {/* Scroll to bottom button */}
              {showScrollBottom && (
                <button
                  onClick={scrollToBottom}
                  className="scroll-bottom-btn bg-cyan-600 hover:bg-cyan-700 text-white p-3 rounded-full shadow-2xl glow-effect"
                  title="Ugrás az aljára"
                >
                  ⬇️
                </button>
              )}
            </div>

            <div className="border-t border-gray-700 bg-gray-800 shadow-2xl p-1.5 sm:p-2 md:p-4 flex-shrink-0">
              {/* Filter buttons */}
              <div className="flex gap-1 sm:gap-1.5 md:gap-2 mb-1.5 sm:mb-2 md:mb-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 pb-1">
                <button
                  onClick={() => {
                    setFilterLinks(!filterLinks);
                    setFilterYouTube(false);
                    setFilterTikTok(false);
                    setCustomFilterDomain('');
                  }}
                  className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    filterLinks
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  🔗 {filterLinks ? 'Csak linkek' : 'Linkek szűrése'}
                </button>
                <button
                  onClick={() => {
                    setFilterYouTube(!filterYouTube);
                    setFilterLinks(false);
                    setFilterTikTok(false);
                    setCustomFilterDomain('');
                  }}
                  className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    filterYouTube
                      ? 'bg-red-600 text-white shadow-lg shadow-red-500/30'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  🎥 {filterYouTube ? 'Csak YouTube' : 'YouTube szűrése'}
                </button>
                <button
                  onClick={() => {
                    setFilterTikTok(!filterTikTok);
                    setFilterLinks(false);
                    setFilterYouTube(false);
                    setCustomFilterDomain('');
                  }}
                  className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    filterTikTok
                      ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/30'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  🎵 {filterTikTok ? 'Csak TikTok' : 'TikTok szűrése'}
                </button>
                <button
                  onClick={() => setShowCustomFilter(!showCustomFilter)}
                  className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    showCustomFilter || customFilterDomain
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  🔍 {showCustomFilter ? 'Bezárás' : (customFilterDomain ? customFilterDomain : 'Szűrőszerkesztő')}
                </button>
                {(filterLinks || filterYouTube || filterTikTok || customFilterDomain) && (
                  <button
                    onClick={() => {
                      setFilterLinks(false);
                      setFilterYouTube(false);
                      setFilterTikTok(false);
                      setCustomFilterDomain('');
                    }}
                    className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs font-medium bg-gray-600 text-white hover:bg-gray-500 transition-all whitespace-nowrap"
                  >
                    <span className="md:hidden">✕</span>
                    <span className="hidden md:inline">✕ Szűrő törlése</span>
                  </button>
                )}
              </div>
              
              {/* Custom filter editor */}
              {showCustomFilter && (
                <div className="mb-3 p-4 bg-gray-800/80 backdrop-blur-md rounded-lg border border-gray-700/50 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-cyan-300">🔍 Szűrőszerkesztő</h3>
                    {customFilterDomain && (
                      <button
                        onClick={() => setCustomFilterDomain('')}
                        className="text-xs px-2 py-1 bg-red-600/80 text-white rounded hover:bg-red-600 transition-all shadow-lg"
                      >
                        ✕ Törlés
                      </button>
                    )}
                  </div>
                  {customFilterDomain && (
                    <div className="mb-2 px-3 py-2 bg-cyan-600/20 border border-cyan-500/30 rounded text-sm text-cyan-300">
                      Aktív: <span className="font-semibold">{customFilterDomain}</span>
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="🔎 Keresés domain-ben..."
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent mb-3"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                    {(() => {
                      const allLinks = new Set<string>();
                      messages.forEach(m => {
                        extractLinks(m.content).forEach(link => allLinks.add(link));
                      });
                      const uniqueDomains = new Set<string>();
                      Array.from(allLinks).forEach(link => {
                        try {
                          const domain = new URL(link).hostname;
                          uniqueDomains.add(domain);
                        } catch {}
                      });
                      const filteredDomains = Array.from(uniqueDomains).filter(domain =>
                        domain.toLowerCase().includes(searchQuery.toLowerCase())
                      );
                      if (filteredDomains.length === 0) {
                        return (
                          <div className="text-center py-4 text-gray-400 text-xs">
                            Nincs találat
                          </div>
                        );
                      }
                      return filteredDomains.map(domain => (
                        <button
                          key={domain}
                          onClick={() => {
                            setCustomFilterDomain(domain);
                            setFilterLinks(false);
                            setFilterYouTube(false);
                            setFilterTikTok(false);
                            setSearchQuery('');
                            setShowCustomFilter(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all font-light ${
                            customFilterDomain === domain
                              ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg shadow-cyan-500/30 scale-105'
                              : 'bg-gray-700/50 text-cyan-100 hover:bg-gray-600 hover:scale-102'
                          }`}
                        >
                          🔗 {domain}
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              )}
              
              {/* Link preview card above input */}
              {inputLinkPreview && (
                <div className="mb-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-start gap-3">
                    {inputLinkPreview.image && (
                      <img 
                        src={inputLinkPreview.image} 
                        alt="preview"
                        className="w-20 h-20 object-cover rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={editableTitle}
                        onChange={(e) => setEditableTitle(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-cyan-300 font-light focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-1"
                        placeholder="Cím szerkesztése..."
                      />
                      {inputLinkPreview.description && (
                        <p className="text-xs text-gray-400 line-clamp-2">{inputLinkPreview.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">{inputLinkPreview.siteName}</p>
                    </div>
                    <button
                      onClick={() => {
                        setInputLinkPreview(null);
                        setEditableTitle('');
                        setInput(input.replace(/(https?:\/\/[^\s]+)/g, '').trim());
                      }}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                      title="Előnézet eltávolítása"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
              {isLoadingPreview && (
                <div className="mb-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600 animate-pulse">
                  <div className="h-4 bg-gray-600 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-600 rounded w-1/2"></div>
                </div>
              )}
              
              {/* File preview */}
              {selectedFile && (
                <div className="mb-3 p-3 bg-gray-700/50 rounded-lg border border-cyan-500/50">
                  <div className="flex items-start gap-3">
                    {filePreview ? (
                      <img 
                        src={filePreview} 
                        alt="preview"
                        className="w-20 h-20 object-cover rounded"
                      />
                    ) : selectedFile.type.startsWith('audio/') ? (
                      <div className="flex flex-col gap-1">
                        <div className="relative group">
                          <div 
                            onClick={() => {
                              console.log('🖱️ Thumbnail clicked');
                              audioThumbnailInputRef.current?.click();
                            }}
                            className="w-20 h-20 bg-gray-600 rounded flex items-center justify-center cursor-pointer hover:bg-gray-500 transition-colors overflow-hidden relative hover-shake"
                          >
                            {audioThumbnail ? (
                              <img 
                                src={audioThumbnail} 
                                alt="audio thumbnail"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img 
                                src="/assets/zene.gif" 
                                alt="music"
                                className="w-full h-full object-contain p-2"
                              />
                            )}
                          </div>
                          {audioThumbnail && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAudioThumbnail(null);
                                if (audioThumbnailInputRef.current) {
                                  audioThumbnailInputRef.current.value = '';
                                }
                              }}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white text-xs shadow-lg transition-colors"
                              title="Thumbnail eltávolítása"
                            >
                              ✕
                            </button>
                          )}
                          <input
                            ref={audioThumbnailInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAudioThumbnailSelect}
                            className="hidden"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="w-20 h-20 bg-gray-600 rounded flex items-center justify-center">
                        <span className="text-3xl">📄</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-cyan-300 font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-gray-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      <p className="text-xs text-gray-500 mt-1">{selectedFile.type || 'Ismeretlen típus'}</p>
                    </div>
                    <button
                      onClick={handleRemoveFile}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                      title="Eltávolítás"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
              
              {/* Tiltott felhasználók számára engedély kérés gomb */}
              {(() => {
                console.log('🔍 User status check:', { me, verified: me?.verified, isAdmin: me?.isAdmin });
                return me && !me.verified && !me.isAdmin;
              })() ? (
                <div className="flex justify-center">
                  <button
                    onClick={async () => {
                      if (!activeConversationId) return;
                      try {
                        await sendMessage(activeConversationId, '🔒 Engedélyt kérek a csetfalra íráshoz');
                        // Refetch messages to show the new request
                        refetchMessages();
                      } catch (error) {
                        console.error('Hiba az engedély kérése során:', error);
                      }
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-lg hover:from-yellow-700 hover:to-orange-700 transition-all shadow-xl font-semibold text-sm flex items-center gap-2"
                  >
                    🔒 Engedély kérése
                  </button>
                </div>
              ) : (
                <div className="flex gap-1 sm:gap-1.5 md:gap-2 items-end">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-1.5 sm:p-2 md:p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-base sm:text-lg md:text-xl shadow-lg flex-shrink-0"
                    title="Emoji"
                  >
                    😊
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 sm:p-2 md:p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-base sm:text-lg md:text-xl shadow-lg flex-shrink-0"
                    title="Fájl csatolása"
                  >
                    📎
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                    multiple
                  />
                  <div className="flex-1 relative min-w-0">
                    <textarea
                      className="w-full bg-gray-700 border-2 border-gray-600 rounded-lg px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 resize-none text-xs sm:text-sm md:text-base text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      rows={isMobile ? 1 : 2}
                      placeholder={isMobile ? "Üzenet..." : "Írj üzenetet... (Enter = küldés, Shift+Enter = új sor)"}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        socket?.emit('typing', {
                          conversationId: activeConversationId,
                          isTyping: e.target.value.length > 0,
                          textLength: e.target.value.length,
                        });
                      }}
                      onKeyDown={handleKeyDown}
                    />
                    {showEmojiPicker && (
                      <div className="absolute bottom-full mb-2 right-0 z-10">
                        <EmojiPicker onEmojiClick={handleEmojiClick} theme={'dark' as any} />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={selectedFile ? handleSendWithFile : handleSend}
                    disabled={(!input.trim() && !selectedFile) || mutation.isLoading || isUploadingFile}
                    className="px-2 sm:px-3 md:px-6 py-1.5 sm:py-2 md:py-3 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-lg hover:from-cyan-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl font-semibold text-xs sm:text-sm md:text-base whitespace-nowrap flex-shrink-0"
                  >
                    {(mutation.isLoading || isUploadingFile) ? '⏳' : isMobile ? '📤' : '📤 Küldés'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>

    {/* User Context Menu */}
    {userContextMenu && (
      <>
        {/* Backdrop to close menu */}
        <div
          className="fixed inset-0 z-40"
          onClick={() => setUserContextMenu(null)}
        />
        <div
          className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden min-w-[200px]"
          style={{
            top: `${Math.min(userContextMenu.y, window.innerHeight - 200)}px`,
            left: `${Math.min(userContextMenu.x, window.innerWidth - 220)}px`,
            transform: 'translateX(-50%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 border-b border-gray-700 bg-gray-900">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white">{userContextMenu.user.username}</p>
              {userContextMenu.user.isAdmin && <span className="text-xs bg-yellow-600 px-1.5 py-0.5 rounded">👑</span>}
              {!userContextMenu.user.verified && <span className="text-xs bg-red-600 px-1.5 py-0.5 rounded">🚫</span>}
            </div>
            <p className="text-xs text-gray-400">{userContextMenu.user.email}</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => handleToggleAdmin(userContextMenu.userId, userContextMenu.user.isAdmin)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 transition-colors text-white flex items-center gap-2"
            >
              <span>{userContextMenu.user.isAdmin ? '👤' : '👑'}</span>
              <span>{userContextMenu.user.isAdmin ? 'Admin jog eltávolítása' : 'Admin jog adása'}</span>
            </button>
            <button
              onClick={() => handleToggleBan(userContextMenu.userId, userContextMenu.user.verified)}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                userContextMenu.user.verified ? 'text-orange-400' : 'text-green-400'
              }`}
            >
              <span>{userContextMenu.user.verified ? '🚫' : '✅'}</span>
              <span>{userContextMenu.user.verified ? 'Felhasználó tiltása' : 'Tiltás feloldása'}</span>
            </button>
            <button
              onClick={() => handleDeleteUser(userContextMenu.userId)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 transition-colors text-red-400 flex items-center gap-2"
            >
              <span>🗑️</span>
              <span>Felhasználó törlése</span>
            </button>
          </div>
        </div>
      </>
    )}
    </>
  );
};
