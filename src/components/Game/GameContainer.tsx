import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { nanoid } from 'nanoid';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Lobby } from './Lobby';
import { GameOver } from './GameOver';
import { GameCanvas } from './GameCanvas';
import { GameState, Role, RemotePlayer, GameRef, RoomType, VoiceSignal } from '../../types';
import Peer from 'simple-peer/simplepeer.min.js';
import { INITIAL_SPEED, VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../../constants';
import { playSound } from '../../utils/audio';

export const NeonVelocity: React.FC = () => {
  const socketRef = useRef<Socket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [gameState, setGameState] = useState<GameState>('LOBBY');
  const [role, setRole] = useState<Role>('ESCAPER');
  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('Player ' + Math.floor(Math.random() * 1000));
  const [players, setPlayers] = useState<RemotePlayer[]>([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [isBotMode, setIsBotMode] = useState(false);
  const [roomType, setRoomType] = useState<RoomType>('OFFLINE');
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [localRoomData, setLocalRoomData] = useState<{ attackerId: string, escaperId: string } | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [peers, setPeers] = useState<Map<string, Peer.Instance>>(new Map());
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Game refs to avoid re-renders during loop
  const gameRef = useRef<GameRef>({
    playerX: 400,
    playerY: 500,
    playerVx: 0,
    playerVy: 0,
    remotePlayers: [],
    obstacles: [],
    powerUps: [],
    particles: [],
    speed: INITIAL_SPEED,
    frameCount: 0,
    shake: 0,
    keys: {},
    lastSpawnTime: 0,
    botsDefeated: 0,
    levelUpTimer: 0,
    fireTimer: 0,
    hideTimer: 0,
    slowTimer: 0,
    magnetTimer: 0,
    timeStopTimer: 0,
    boostTimer: 0,
    attackerTimer: 3600, // 60 seconds
    comboTimer: 0,
    attackerEnergy: 0,
    empTimer: 0,
    firewallTimer: 0,
    trails: [],
    spawns: [],
    floatingTexts: [],
    speedLines: [],
    attackerReticle: { x: 0, y: 0, active: false, lockProgress: 0 },
    glitchTimer: 0,
  });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });
        
        // Update player position to be relative to new dimensions if in game
        if (gameState === 'PLAYING') {
          gameRef.current.playerY = clientHeight - 100;
        } else {
          gameRef.current.playerX = clientWidth / 2;
          gameRef.current.playerY = clientHeight - 100;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [gameState]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("room-update", ({ players: serverPlayers }) => {
      setPlayers(serverPlayers);
      // Filter out the local player by socket ID. Guard against socket.id not
      // yet being assigned on the first event (avoids the stationary ghost dot).
      const myId = socket.id;
      gameRef.current.remotePlayers = myId
        ? serverPlayers.filter((p: RemotePlayer) => p.id !== myId)
        : [];
    });

    socket.on("player-moved", ({ id, x, y, vx, vy }) => {
      const p = gameRef.current.remotePlayers.find(p => p.id === id);
      if (p) {
        p.x = x;
        p.y = y;
        p.vx = vx;
      }
    });

    socket.on("obstacle-spawned", (obstacle) => {
      gameRef.current.obstacles.push(obstacle);
    });

    socket.on("game-started", () => {
      resetGameLocal();
      setGameState('PLAYING');
      playSound('start');
    });

    socket.on("game-over", ({ score: finalScore }) => {
      setScore(finalScore);
      setGameState('GAMEOVER');
      playSound('over');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (micEnabled && !stream) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
        setStream(s);
      }).catch(err => {
        console.error("Mic access denied:", err);
        setMicEnabled(false);
      });
    } else if (!micEnabled && stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [micEnabled, stream]);

  useEffect(() => {
    if (micEnabled && stream) {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);

      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let lastSpeaking = false;
      const checkVolume = () => {
        analyzer.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const isSpeaking = average > 10; // Threshold

        if (isSpeaking !== lastSpeaking) {
          lastSpeaking = isSpeaking;
          socketRef.current?.emit("voice-state", { roomId, isMuted: false, isSpeaking });
        }
        
        if (micEnabled) requestAnimationFrame(checkVolume);
      };
      
      checkVolume();
      return () => {
        audioContext.close();
      };
    }
  }, [micEnabled, stream, roomId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on("match-found", ({ roomId: foundRoomId }) => {
      setIsMatchmaking(false);
      joinRoom(foundRoomId, role, 'ONLINE');
    });

    socket.on("local-room-created", ({ roomId: createdRoomId, attackerId, escaperId }) => {
      setLocalRoomData({ attackerId, escaperId });
      setRoomId(createdRoomId);
      joinRoom(createdRoomId, 'ESCAPER', 'LOCAL');
    });

    socket.on("voice-signal", ({ from, signal }: VoiceSignal) => {
      let peer = peers.get(from);
      if (!peer) {
        peer = new Peer({ initiator: false, trickle: false, stream: stream || undefined });
        peer.on('signal', (data) => {
          socket.emit('voice-signal', { roomId, to: from, signal: data });
        });
        peer.on('stream', (remoteStream) => {
          const audio = new Audio();
          audio.srcObject = remoteStream;
          audio.play();
        });
        setPeers(prev => new Map(prev).set(from, peer!));
      }
      peer.signal(signal);
    });

    return () => {
      socket.off("match-found");
      socket.off("local-room-created");
      socket.off("voice-signal");
    };
  }, [role, roomId, stream, peers]);

  // Initiate voice connections to new players
  useEffect(() => {
    if (!socketRef.current || !micEnabled || !stream) return;

    players.forEach(p => {
      if (p.id !== socketRef.current?.id && !peers.has(p.id)) {
        const newPeer = new Peer({ initiator: true, trickle: false, stream });
        newPeer.on('signal', (data) => {
          socketRef.current?.emit('voice-signal', { roomId, to: p.id, signal: data });
        });
        newPeer.on('stream', (remoteStream) => {
          const audio = new Audio();
          audio.srcObject = remoteStream;
          audio.play();
        });
        setPeers(prev => new Map(prev).set(p.id, newPeer));
      }
    });
  }, [players, micEnabled, stream, roomId]);

  const joinMatchmaking = () => {
    if (!socketRef.current) return;
    setIsMatchmaking(true);
    socketRef.current.emit("join-matchmaking", { name, role });
  };

  const createLocalRoom = () => {
    if (!socketRef.current) return;
    socketRef.current.emit("create-local-room", { name });
  };

  const joinRoom = (id: string, r: Role, type: RoomType = 'OFFLINE', teamId?: string) => {
    if (!socketRef.current) return;
    setRoomId(id);
    setRole(r);
    setRoomType(type);
    socketRef.current.emit("join-room", { roomId: id, name, role: r, roomType: type, teamId });
    setGameState('LOBBY');
  };

  const startGame = () => {
    socketRef.current?.emit("start-game", roomId);
  };

  const resetGameLocal = () => {
    gameRef.current = {
      ...gameRef.current,
      playerX: dimensions.width / 2,
      playerY: dimensions.height - 100,
      playerVx: 0,
      playerVy: 0,
      botX: dimensions.width / 2,
      botVx: 0,
      obstacles: [],
      powerUps: [],
      particles: [],
      speed: INITIAL_SPEED,
      frameCount: 0,
      shake: 0,
      botsDefeated: 0,
      levelUpTimer: 0,
      fireTimer: 0,
      hideTimer: 0,
      slowTimer: 0,
      magnetTimer: 0,
      timeStopTimer: 0,
      boostTimer: 0,
      attackerTimer: 3600,
      comboTimer: 0,
      attackerEnergy: 0,
      empTimer: 0,
      firewallTimer: 0,
      trails: [],
      spawns: [],
      floatingTexts: [],
      speedLines: [],
      attackerReticle: { x: dimensions.width / 2, y: dimensions.height / 2, active: false, lockProgress: 0 },
      glitchTimer: 0,
    };
    setScore(0);
    setLevel(1);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-screen bg-[#050505] overflow-hidden relative font-sans text-white select-none touch-none">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_#1a1a1a_0%,_#000_100%)]" />
        <div className="cyber-grid absolute inset-0 opacity-20" />
        <div className="scanlines absolute inset-0 pointer-events-none z-50 opacity-[0.03]" />
      </div>

      {/* Header UI */}
      <div className="absolute top-0 left-0 w-full p-4 sm:p-6 flex justify-between items-start z-40 pointer-events-none">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-[#ff0055] shadow-[0_0_15px_#ff0055]" />
            <div>
              <h2 className="text-2xl sm:text-3xl font-black italic tracking-tighter leading-none">NEON VELOCITY</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] uppercase tracking-[0.3em] text-[#00f2ff] font-bold">Sector {level}</span>
                <div className="h-[1px] w-12 bg-white/20" />
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-bold">{role}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 pointer-events-auto">
          <button 
            onClick={toggleFullscreen}
            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95 text-[#00f2ff]"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>

      {gameState === 'LOBBY' && (
        <Lobby 
          name={name} setName={setName}
          roomId={roomId} setRoomId={setRoomId}
          role={role} setRole={setRole}
          players={players}
          isBotMode={isBotMode} setIsBotMode={setIsBotMode}
          roomType={roomType} setRoomType={setRoomType}
          isMatchmaking={isMatchmaking} joinMatchmaking={joinMatchmaking}
          localRoomData={localRoomData} createLocalRoom={createLocalRoom}
          micEnabled={micEnabled} setMicEnabled={setMicEnabled}
          joinRoom={joinRoom}
          startGame={startGame}
        />
      )}

      {gameState === 'PLAYING' && (
        <GameCanvas 
          gameRef={gameRef}
          dimensions={dimensions}
          role={role}
          roomId={roomId}
          socket={socketRef.current}
          onGameOver={(finalScore) => {
            setScore(finalScore);
            if (finalScore > highScore) setHighScore(finalScore);
            setGameState('GAMEOVER');
            playSound('over');
          }}
          updateScore={(s) => setScore(s)}
          updateLevel={(l) => setLevel(l)}
        />
      )}

      {gameState === 'GAMEOVER' && (
        <GameOver 
          score={score}
          highScore={highScore}
          level={level}
          role={role}
          onRestart={() => {
            resetGameLocal();
            setGameState('PLAYING');
            playSound('start');
          }}
          onLobby={() => setGameState('LOBBY')}
        />
      )}
    </div>
  );
};
