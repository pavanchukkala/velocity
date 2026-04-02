import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Socket } from 'socket.io-client';
import { 
  Zap, Shield, Skull, Flame, Timer, Clock, Magnet 
} from 'lucide-react';
import { GameRef, Role, Obstacle, PowerUp, Particle } from '../../types';
import { 
  PLAYER_SIZE, INITIAL_SPEED, SPEED_INCREMENT, OBSTACLE_SPAWN_RATE, 
  PARTICLE_COUNT, NEAR_MISS_THRESHOLD, COMBO_TIMEOUT,
  ACCELERATION, FRICTION, MAX_VELOCITY
} from '../../constants';
import { playSound } from '../../utils/audio';
import { drawPlayer, drawBot, drawObstacle, drawPowerUp, drawReticle } from '../../utils/renderer';

interface GameCanvasProps {
  gameRef: React.MutableRefObject<GameRef>;
  dimensions: { width: number; height: number };
  role: Role;
  roomId: string;
  socket: Socket | null;
  onGameOver: (score: number) => void;
  updateScore: (score: number) => void;
  updateLevel: (level: number) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameRef, dimensions, role, roomId, socket, onGameOver, updateScore, updateLevel
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep score/level/combo/multiplier in refs so the game loop NEVER reads
  // stale values and the loop useEffect NEVER needs to restart when they change.
  const scoreRef      = useRef(0);
  const levelRef      = useRef(1);
  const comboRef      = useRef(0);
  const multiplierRef = useRef(1);
  // Mirror refs into React state for HUD display only (updated via setInterval)
  const [score, setScore]           = useState(0);
  const [level, setLevel]           = useState(1);
  const [combo, setCombo]           = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [timeLeft, setTimeLeft]     = useState(60);
  // Sync display state from refs every 80ms — cheap, decoupled from game loop
  useEffect(() => {
    const t = setInterval(() => {
      setScore(scoreRef.current);
      setLevel(levelRef.current);
      setCombo(comboRef.current);
      setMultiplier(multiplierRef.current);
    }, 80);
    return () => clearInterval(t);
  }, []);
  const [playerColor, setPlayerColor] = useState('#00ff66');
  const [shieldActive, setShieldActive] = useState(false);
  const [fireActive, setFireActive] = useState(false);
  const [hideActive, setHideActive] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const hue = Math.floor(Math.random() * 360);
      setPlayerColor(`hsl(${hue}, 100%, 60%)`);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const spawnObstacle = useCallback(() => {
    const typeRoll = Math.random();
    let type: 'BLOCK' | 'GATE' = 'BLOCK';
    let width = 40;
    let height = 40;

    if (typeRoll > 0.7) {
      type = 'GATE';
      width = 150;
      height = 30;
    }

    const obstacle: Obstacle = {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * (dimensions.width - width),
      y: -50,
      width,
      height,
      color: '#ff0055',
      type,
      vx: 0,
    };
    gameRef.current.obstacles.push(obstacle);
    if (socket) socket.emit("spawn-obstacle", { roomId, obstacle });
    playSound('spawn');
  }, [dimensions.width, socket, roomId]);

  const spawnPowerUp = useCallback(() => {
    const types: PowerUp['type'][] = ['SHIELD', 'BOOST', 'FIRE', 'HIDE', 'COIN', 'SLOW', 'MAGNET', 'TIME_STOP'];
    const powerUp: PowerUp = {
      x: Math.random() * dimensions.width,
      y: -30,
      type: types[Math.floor(Math.random() * types.length)],
      size: 25,
    };
    gameRef.current.powerUps.push(powerUp);
  }, [dimensions.width]);

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      gameRef.current.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        color,
      });
    }
  };

  const dropObstacle = useCallback((x: number) => {
    const g = gameRef.current;
    if (g.attackerEnergy >= 5) {
      g.attackerEnergy -= 5;
      const obstacle: Obstacle = {
        id: Math.random().toString(36).substr(2, 9),
        x: x - 20,
        y: -50,
        width: 40,
        height: 40,
        color: '#ff0055',
        vx: 0,
      };
      g.obstacles.push(obstacle);
      if (socket) socket.emit("spawn-obstacle", { roomId, obstacle });
      playSound('spawn');
    }
  }, [roomId, socket, gameRef]);

  const update = useCallback(() => {
    const g = gameRef.current;
    g.frameCount++;

    // Movement
    if (role === 'ESCAPER') {
      // Physics-based movement (Horizontal Only)
      if (g.keys['ArrowLeft'] || g.keys['a']) g.playerVx -= ACCELERATION;
      if (g.keys['ArrowRight'] || g.keys['d']) g.playerVx += ACCELERATION;
      
      // Apply friction
      g.playerVx *= FRICTION;
      g.playerVy = 0; // No vertical velocity

      // Cap velocity
      if (Math.abs(g.playerVx) > MAX_VELOCITY) {
        g.playerVx = Math.sign(g.playerVx) * MAX_VELOCITY;
      }

      // Update position
      g.playerX += g.playerVx;
      g.playerY = dimensions.height - 100; // Stick to bottom area

      // Boundaries
      if (g.playerX < PLAYER_SIZE) { g.playerX = PLAYER_SIZE; g.playerVx *= -0.5; }
      if (g.playerX > dimensions.width - PLAYER_SIZE) { g.playerX = dimensions.width - PLAYER_SIZE; g.playerVx *= -0.5; }

      // Add trail
      if (g.frameCount % 2 === 0 && Math.abs(g.playerVx) > 1) {
        g.trails.push({ x: g.playerX, y: g.playerY, life: 1.0 });
      }

      if (socket) socket.emit("move", { roomId, x: g.playerX, y: g.playerY, vx: g.playerVx, vy: g.playerVy });
    } else {
      // Bot Escaper Logic for Attacker
      if (g.botX === undefined) g.botX = dimensions.width / 2;
      if (g.botVx === undefined) g.botVx = 0;

      // Simple AI: Move away from nearest obstacle
      const nearestObs = g.obstacles.reduce((prev, curr) => {
        if (!prev) return curr;
        const distPrev = Math.abs(prev.x + prev.width/2 - g.botX!);
        const distCurr = Math.abs(curr.x + curr.width/2 - g.botX!);
        return distCurr < distPrev ? curr : prev;
      }, g.obstacles[0]);

      if (nearestObs && Math.abs(nearestObs.x + nearestObs.width/2 - g.botX!) < 150) {
        if (nearestObs.x + nearestObs.width/2 > g.botX!) g.botVx -= ACCELERATION * 0.8;
        else g.botVx += ACCELERATION * 0.8;
      } else {
        // Return to center
        if (g.botX! < dimensions.width / 2 - 50) g.botVx += ACCELERATION * 0.3;
        else if (g.botX! > dimensions.width / 2 + 50) g.botVx -= ACCELERATION * 0.3;
      }

      g.botVx *= FRICTION;
      g.botX! += g.botVx;

      // Boundaries
      if (g.botX! < PLAYER_SIZE) { g.botX = PLAYER_SIZE; g.botVx *= -0.5; }
      if (g.botX! > dimensions.width - PLAYER_SIZE) { g.botX = dimensions.width - PLAYER_SIZE; g.botVx *= -0.5; }

      // Bot Trail
      if (g.frameCount % 3 === 0 && Math.abs(g.botVx) > 1) {
        g.trails.push({ x: g.botX!, y: dimensions.height - 100, life: 0.8 });
      }
    }

    // Attacker Energy & Abilities
    if (g.attackerEnergy < 100) g.attackerEnergy += 0.1;
    if (g.empTimer > 0) g.empTimer--;
    if (g.firewallTimer > 0) g.firewallTimer--;

    // Update shake
    if (g.shake > 0) g.shake *= 0.9;

    // Update glitch
    if (g.glitchTimer > 0) g.glitchTimer--;

    // Update speed lines
    if (g.frameCount % 5 === 0) {
      g.speedLines.push({
        x: Math.random() * dimensions.width,
        y: -100,
        length: 20 + Math.random() * 50,
        speed: 10 + Math.random() * 10
      });
    }
    g.speedLines.forEach((line, i) => {
      line.y += line.speed + g.speed;
      if (line.y > dimensions.height) g.speedLines.splice(i, 1);
    });

    // Update Attacker Reticle
    if (role === 'ATTACKER' && g.botX !== undefined) {
      const targetX = g.botX;
      const targetY = dimensions.height - 100;
      
      // Smooth follow
      g.attackerReticle.x += (targetX - g.attackerReticle.x) * 0.1;
      g.attackerReticle.y += (targetY - g.attackerReticle.y) * 0.1;
      
      const dist = Math.abs(g.attackerReticle.x - targetX);
      if (dist < 50) {
        g.attackerReticle.lockProgress = Math.min(1, g.attackerReticle.lockProgress + 0.01);
      } else {
        g.attackerReticle.lockProgress = Math.max(0, g.attackerReticle.lockProgress - 0.02);
      }
    }

    // Update trails
    g.trails.forEach((t, i) => {
      t.life -= 0.05;
      if (t.life <= 0) g.trails.splice(i, 1);
    });

    // Timers
    if (g.fireTimer > 0) g.fireTimer--;
    if (g.hideTimer > 0) g.hideTimer--;
    if (g.slowTimer > 0) g.slowTimer--;
    if (g.magnetTimer > 0) g.magnetTimer--;
    if (g.timeStopTimer > 0) g.timeStopTimer--;
    if (g.boostTimer > 0) g.boostTimer--;
    if (role === 'ATTACKER') {
      if (g.attackerTimer > 0) {
        g.attackerTimer--;
        if (g.frameCount % 60 === 0) {
          setTimeLeft(Math.ceil(g.attackerTimer / 60));
        }
      } else {
        // Attacker failed to kill Escaper in time
        onGameOver(scoreRef.current);
        return;
      }
    }
    if (g.comboTimer > 0) g.comboTimer--;
    else if (comboRef.current > 0) {
      comboRef.current = 0;
      multiplierRef.current = 1;
      playSound('combobreak');
    }

    setShieldActive(g.levelUpTimer > 0); // Reuse levelUpTimer for shield visual if needed or add shieldTimer
    setFireActive(g.fireTimer > 0);
    setHideActive(g.hideTimer > 0);

    // Obstacles
    const hasAttacker = role === 'ATTACKER' || g.remotePlayers.some(p => p.role === 'ATTACKER');
    const isBossLevel = levelRef.current % 5 === 0;
    const spawnRate = isBossLevel ? 30 : Math.max(10, OBSTACLE_SPAWN_RATE - levelRef.current * 2);

    if (!hasAttacker && g.frameCount % spawnRate === 0) {
      if (isBossLevel && g.frameCount % 120 === 0) {
        // Boss Obstacle: Large Gate
        const obs: Obstacle = {
          id: 'boss-' + g.frameCount,
          x: 0,
          y: -100,
          width: dimensions.width,
          height: 60,
          color: '#ffcc00',
          type: 'GATE',
          vx: 0,
        };
        g.obstacles.push(obs);
      } else {
        spawnObstacle();
      }
    }
    if (g.frameCount % 300 === 0) {
      spawnPowerUp();
    }

    const currentSpeed = g.timeStopTimer > 0 ? 0 : (g.slowTimer > 0 ? g.speed * 0.4 : (g.boostTimer > 0 ? g.speed * 1.5 : g.speed));

    g.obstacles.forEach((obs, index) => {
      obs.y += currentSpeed;
      if (obs.vx) obs.x += obs.vx;

      // Collision
      if (role === 'ESCAPER' && g.hideTimer <= 0) {
        const dx = g.playerX - (obs.x + obs.width / 2);
        const dy = g.playerY - (obs.y + obs.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < (obs.width + obs.height) / 4 + PLAYER_SIZE / 2) {
          if (g.fireTimer > 0 || g.levelUpTimer > 0) {
            createExplosion(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.color);
            g.obstacles.splice(index, 1);
            scoreRef.current += 50;
            playSound('hit');
            g.shake = 10;
            // Consume shield if active
            if (g.levelUpTimer > 0 && g.fireTimer <= 0) {
              g.levelUpTimer = 0;
            }
          } else {
            g.shake = 30;
            g.glitchTimer = 20;
            setTimeout(() => onGameOver(scoreRef.current), 100);
          }
        }

        // Near Miss
        if (!obs.nearMissTriggered && distance < NEAR_MISS_THRESHOLD + (obs.width + obs.height) / 4) {
          obs.nearMissTriggered = true;
          comboRef.current += 1;
          multiplierRef.current = Math.min(5, 1 + Math.floor(comboRef.current / 10));
          scoreRef.current += 10 * multiplierRef.current;
          g.comboTimer = COMBO_TIMEOUT;
          playSound('nearmiss');
          g.floatingTexts.push({ x: g.playerX, y: g.playerY - 20, text: 'NEAR MISS!', life: 1.0, color: '#00f2ff' });
        }
      } else if (role === 'ATTACKER' && g.botX !== undefined) {
        // Collision for Bot Escaper (Attacker's target)
        const dx = g.botX - (obs.x + obs.width / 2);
        const dy = (dimensions.height - 100) - (obs.y + obs.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < (obs.width + obs.height) / 4 + PLAYER_SIZE / 2) {
          createExplosion(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.color);
          g.obstacles.splice(index, 1);
          scoreRef.current += 500;
          playSound('hit');
          g.shake = 15;
          g.floatingTexts.push({ x: g.botX, y: dimensions.height - 120, text: 'TERMINATED!', life: 1.0, color: '#ff0055' });
          
          // Reset bot position slightly
          g.botX = Math.random() * dimensions.width;
          g.botVx = 0;
        }
      }

      if (obs.y > dimensions.height) {
        g.obstacles.splice(index, 1);
        scoreRef.current += 10 * multiplierRef.current;
      }
    });

    // Power-ups
    g.powerUps.forEach((pu, index) => {
      // Magnet Effect
      if (g.magnetTimer > 0) {
        const dx = g.playerX - pu.x;
        const dy = g.playerY - pu.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          pu.x += dx * 0.05;
          pu.y += dy * 0.05;
        }
      }

      pu.y += currentSpeed * 0.8;
      const dx = g.playerX - pu.x;
      const dy = g.playerY - pu.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < pu.size + PLAYER_SIZE / 2) {
        g.powerUps.splice(index, 1);
        playSound('powerup');
        g.floatingTexts.push({ x: pu.x, y: pu.y, text: pu.type, life: 1.0, color: '#ffff00' });
        
        switch (pu.type) {
          case 'SHIELD': g.levelUpTimer = 300; break;
          case 'FIRE': g.fireTimer = 300; break;
          case 'HIDE': g.hideTimer = 300; break;
          case 'SLOW': g.slowTimer = 300; break;
          case 'MAGNET': g.magnetTimer = 300; break;
          case 'TIME_STOP': g.timeStopTimer = 180; break;
          case 'COIN': scoreRef.current += 500; playSound('collect'); break;
          case 'BOOST': g.boostTimer = 300; break;
        }
      }
      if (pu.y > dimensions.height) g.powerUps.splice(index, 1);
    });

    // Particles
    g.particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      if (p.life <= 0) g.particles.splice(i, 1);
    });

    // Floating Texts
    g.floatingTexts.forEach((t, i) => {
      t.y -= 1;
      t.life -= 0.02;
      if (t.life <= 0) g.floatingTexts.splice(i, 1);
    });

    // Leveling
    if (scoreRef.current > levelRef.current * 2000) {
      levelRef.current += 1;
      g.speed += 0.5;
      playSound('levelup');
      g.floatingTexts.push({ x: dimensions.width / 2, y: dimensions.height / 2, text: `LEVEL ${levelRef.current}`, life: 2.0, color: '#ff0055' });
    }

    g.speed += 0.0005; // Very slow increase for better engagement
  }, [dimensions, role, socket, onGameOver, spawnObstacle, spawnPowerUp, playerColor]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const g = gameRef.current;

    ctx.save();
    
    // Screen Shake
    if (g.shake > 1) {
      ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
      g.shake *= 0.9;
    }

    // Chromatic Aberration (Simulated)
    const aberration = comboRef.current > 5 ? Math.min(8, comboRef.current / 2) : 0;
    
    const renderScene = (offset: number, colorMask?: string) => {
      ctx.save();
      ctx.translate(offset, 0);
      if (colorMask) {
        ctx.globalCompositeOperation = 'screen';
      }

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Draw Trails (Only for Escaper to maintain stealth/cleanliness for Attacker)
      if (role === 'ESCAPER') {
        g.trails.forEach(t => {
          ctx.globalAlpha = t.life * 0.3;
          ctx.fillStyle = '#00ff66';
          ctx.beginPath();
          ctx.arc(t.x, t.y, Math.max(0, PLAYER_SIZE / 2 * t.life), 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.globalAlpha = 1.0;

      // Draw Particles
      g.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Draw background speed lines
      ctx.strokeStyle = '#00f2ff';
      ctx.lineWidth = 1;
      g.speedLines.forEach(line => {
        ctx.globalAlpha = 0.1 + (line.speed / 20) * 0.2;
        ctx.beginPath();
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(line.x, line.y + line.length);
        ctx.stroke();
      });
      ctx.globalAlpha = 1.0;

      // Draw Obstacles
      g.obstacles.forEach(obs => {
        drawObstacle(ctx, obs.x, obs.y, obs.width, obs.height, obs.color, g.timeStopTimer > 0, g.frameCount, obs.type);
      });

      // Draw Power-ups
      g.powerUps.forEach(pu => {
        drawPowerUp(ctx, pu, g.frameCount);
      });

      // Remote Players
      g.remotePlayers.forEach(p => {
        if (p.role === 'ESCAPER') {
          drawPlayer(ctx, p.x, p.y, playerColor, g.frameCount, p.vx || 0, 0, p.name, !!p.isSpeaking, {
            isShielded: false, isFiring: false, isHidden: false, isSlowed: false, isMagnetized: false, isTimeStopped: false, isBoosted: false
          });
        } else {
          drawBot(ctx, p.x, p.y, p.name, g.frameCount);
        }
      });

      if (role === 'ESCAPER') {
        drawPlayer(ctx, g.playerX, g.playerY, playerColor, g.frameCount, g.playerVx, g.playerVy, 'YOU', false, {
          isShielded: g.levelUpTimer > 0,
          isFiring: g.fireTimer > 0,
          isHidden: g.hideTimer > 0,
          isSlowed: g.slowTimer > 0,
          isMagnetized: g.magnetTimer > 0,
          isTimeStopped: g.timeStopTimer > 0,
          isBoosted: g.boostTimer > 0
        });
      }

      if (g.botX !== undefined && role === 'ATTACKER') {
        drawPlayer(ctx, g.botX, dimensions.height - 100, playerColor, g.frameCount, g.botVx || 0, 0, 'BOT', false, {
          isShielded: false, isFiring: false, isHidden: false, isSlowed: false, isMagnetized: false, isTimeStopped: false, isBoosted: false
        });
      }

      ctx.restore();
    };

    if (aberration > 0) {
      renderScene(-aberration, '#ff0000');
      renderScene(aberration, '#00ffff');
      renderScene(0);
    } else {
      renderScene(0);
    }

    // Glitch Overlay
    if (g.glitchTimer > 0) {
      g.glitchTimer--;
      if (Math.random() > 0.7) {
        ctx.fillStyle = `rgba(0, 255, 255, ${Math.random() * 0.3})`;
        ctx.fillRect(0, Math.random() * dimensions.height, dimensions.width, 2);
        ctx.fillStyle = `rgba(255, 0, 255, ${Math.random() * 0.3})`;
        ctx.fillRect(0, Math.random() * dimensions.height, dimensions.width, 2);
        
        if (Math.random() > 0.9) {
          const gx = Math.random() * dimensions.width;
          const gy = Math.random() * dimensions.height;
          ctx.drawImage(canvas, gx, gy, 50, 50, gx + (Math.random() - 0.5) * 20, gy, 50, 50);
        }
      }
    }

    // Draw Attacker Reticle
    if (role === 'ATTACKER') {
      drawReticle(ctx, g.attackerReticle.x, g.attackerReticle.y, g.attackerReticle.lockProgress, g.frameCount);
    }

    // Glitch Overlay
    if (g.glitchTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      for(let i=0; i<5; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#ff0055' : '#00f2ff';
        ctx.fillRect(0, Math.random() * dimensions.height, dimensions.width, Math.random() * 20);
      }
      ctx.restore();
    }

    ctx.restore();

    // Floating Texts
    g.floatingTexts.forEach(t => {
      ctx.globalAlpha = t.life;
      ctx.fillStyle = t.color;
      ctx.font = 'bold 20px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1.0;

    // Attacker HUD
    if (role === 'ATTACKER') {
      // No canvas drawing for HUD, handled in React layer
    }

  }, [dimensions, role, gameRef, playerColor]);

  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      update();
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [update, draw]);

  useEffect(() => {
    if (!socket) return;
    
    const handleAbility = ({ type }: { type: string }) => {
      if (role === 'ESCAPER') {
        if (type === 'EMP') {
          gameRef.current.slowTimer = 180;
          playSound('powerup');
          gameRef.current.floatingTexts.push({ 
            x: gameRef.current.playerX, 
            y: gameRef.current.playerY - 50, 
            text: 'EMP BLAST!', 
            life: 1.0, 
            color: '#ff0055' 
          });
        }
      }
    };

    socket.on("attacker-ability", handleAbility);
    return () => { socket.off("attacker-ability", handleAbility); };
  }, [socket, role, gameRef]);

  // Input Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { gameRef.current.keys[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { gameRef.current.keys[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (role === 'ESCAPER') {
        gameRef.current.playerX = touch.clientX - rect.left;
        gameRef.current.playerY = touch.clientY - rect.top;
      } else if (role === 'ATTACKER') {
        gameRef.current.playerX = touch.clientX - rect.left;
        gameRef.current.playerY = 50; // Force to top
        if (socket) socket.emit("move", { roomId, x: gameRef.current.playerX, y: gameRef.current.playerY, vx: 0, vy: 0 });
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (role === 'ATTACKER') {
        const touch = e.touches[0];
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = touch.clientX - rect.left;
          dropObstacle(x);
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (role === 'ATTACKER') {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = e.clientX - rect.left;
          dropObstacle(x);
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (role === 'ATTACKER') {
        gameRef.current.playerX = e.clientX - rect.left;
        gameRef.current.playerY = 50; // Force to top
        if (socket) socket.emit("move", { roomId, x: gameRef.current.playerX, y: gameRef.current.playerY, vx: 0, vy: 0 });
      }
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [role, socket, roomId, dropObstacle]);

  useEffect(() => {
    updateScore(score);
  }, [score, updateScore]);

  useEffect(() => {
    updateLevel(level);
  }, [level, updateLevel]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <canvas 
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block"
      />
      
      {/* HUD Overlays */}
      <div className="absolute bottom-8 left-8 flex flex-col gap-4 pointer-events-none">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Multiplier</span>
            <span className="text-3xl font-black text-[#ffcc00] italic">x{multiplier}</span>
          </div>
          {combo > 0 && (
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Combo</span>
              <span className="text-3xl font-black text-[#00f2ff] italic">{combo}</span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {shieldActive && (
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 border-[#00f2ff] bg-[#00f2ff]/15"
              style={{ boxShadow: '0 0 14px rgba(0,242,255,0.5)' }}>
              <Shield size={22} className="text-[#00f2ff]" />
              <span className="text-[9px] font-black uppercase tracking-wider text-[#00f2ff]">SHIELD</span>
              <div className="w-12 h-1.5 rounded-full bg-[#00f2ff]/25 overflow-hidden">
                <div className="h-full rounded-full bg-[#00f2ff] animate-pulse" style={{ width: `${Math.max(0,(gameRef.current.levelUpTimer/300)*100)}%` }} />
              </div>
            </div>
          )}
          {fireActive && (
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 border-[#ff6600] bg-[#ff6600]/15"
              style={{ boxShadow: '0 0 14px rgba(255,102,0,0.5)' }}>
              <Flame size={22} className="text-[#ff6600]" />
              <span className="text-[9px] font-black uppercase tracking-wider text-[#ff6600]">FIRE</span>
              <div className="w-12 h-1.5 rounded-full bg-[#ff6600]/25 overflow-hidden">
                <div className="h-full rounded-full bg-[#ff6600]" style={{ width: `${Math.max(0,(gameRef.current.fireTimer/300)*100)}%` }} />
              </div>
            </div>
          )}
          {hideActive && (
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 border-white/60 bg-white/10"
              style={{ boxShadow: '0 0 14px rgba(255,255,255,0.3)' }}>
              <Zap size={22} className="text-white/80" />
              <span className="text-[9px] font-black uppercase tracking-wider text-white/70">CLOAK</span>
              <div className="w-12 h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-white/70" style={{ width: `${Math.max(0,(gameRef.current.hideTimer/300)*100)}%` }} />
              </div>
            </div>
          )}
          {gameRef.current.slowTimer > 0 && (
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 border-[#00ffcc] bg-[#00ffcc]/15"
              style={{ boxShadow: '0 0 14px rgba(0,255,204,0.5)' }}>
              <Timer size={22} className="text-[#00ffcc]" />
              <span className="text-[9px] font-black uppercase tracking-wider text-[#00ffcc]">SLOW</span>
              <div className="w-12 h-1.5 rounded-full bg-[#00ffcc]/25 overflow-hidden">
                <div className="h-full rounded-full bg-[#00ffcc]" style={{ width: `${Math.max(0,(gameRef.current.slowTimer/300)*100)}%` }} />
              </div>
            </div>
          )}
          {gameRef.current.magnetTimer > 0 && (
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 border-[#ff3333] bg-[#ff3333]/15"
              style={{ boxShadow: '0 0 14px rgba(255,51,51,0.5)' }}>
              <Magnet size={22} className="text-[#ff3333]" />
              <span className="text-[9px] font-black uppercase tracking-wider text-[#ff3333]">MAGNET</span>
              <div className="w-12 h-1.5 rounded-full bg-[#ff3333]/25 overflow-hidden">
                <div className="h-full rounded-full bg-[#ff3333]" style={{ width: `${Math.max(0,(gameRef.current.magnetTimer/300)*100)}%` }} />
              </div>
            </div>
          )}
          {gameRef.current.timeStopTimer > 0 && (
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 border-[#9900ff] bg-[#9900ff]/15"
              style={{ boxShadow: '0 0 14px rgba(153,0,255,0.6)' }}>
              <Clock size={22} className="text-[#9900ff]" />
              <span className="text-[9px] font-black uppercase tracking-wider text-[#9900ff]">STOP</span>
              <div className="w-12 h-1.5 rounded-full bg-[#9900ff]/25 overflow-hidden">
                <div className="h-full rounded-full bg-[#9900ff]" style={{ width: `${Math.max(0,(gameRef.current.timeStopTimer/180)*100)}%` }} />
              </div>
            </div>
          )}
          {gameRef.current.boostTimer > 0 && (
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 border-[#ff00ff] bg-[#ff00ff]/15"
              style={{ boxShadow: '0 0 14px rgba(255,0,255,0.5)' }}>
              <Zap size={22} className="text-[#ff00ff]" />
              <span className="text-[9px] font-black uppercase tracking-wider text-[#ff00ff]">BOOST</span>
              <div className="w-12 h-1.5 rounded-full bg-[#ff00ff]/25 overflow-hidden">
                <div className="h-full rounded-full bg-[#ff00ff]" style={{ width: `${Math.max(0,(gameRef.current.boostTimer/300)*100)}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-24 right-8 flex flex-col items-end pointer-events-none">
        <span className="text-[10px] uppercase tracking-[0.5em] opacity-30 font-bold">Current Score</span>
        <span className="text-5xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{score}</span>
      </div>

      {/* Attacker HUD */}
      {role === 'ATTACKER' && (
        <div className="absolute bottom-8 right-8 flex flex-col items-end gap-4 pointer-events-auto">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#ff0055] font-bold">System Overlord Energy</span>
            <div className="w-64 h-3 bg-white/10 rounded-full overflow-hidden border border-white/20">
              <motion.div 
                className="h-full bg-[#ff0055] shadow-[0_0_15px_#ff0055]"
                initial={{ width: 0 }}
                animate={{ width: `${gameRef.current.attackerEnergy}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/40 mt-1">
              [ CLICK TO DROP TRAP - 5E ]
            </span>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#ff0055] font-bold">Time to Breach</span>
            <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden border border-white/20">
              <motion.div 
                className={`h-full ${timeLeft < 15 ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-white shadow-[0_0_15px_#ffffff]'}`}
                initial={{ width: '100%' }}
                animate={{ width: `${(timeLeft / 60) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="text-2xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              {timeLeft}s
            </span>
          </div>

          <div className="flex gap-3">
            <AbilityButton 
              icon={<Skull size={20} />} 
              label="SWARM" 
              cost={20} 
              energy={gameRef.current.attackerEnergy}
              onClick={() => {
                const g = gameRef.current;
                if (g.attackerEnergy >= 20) {
                  g.attackerEnergy -= 20;
                  for(let i=0; i<5; i++) {
                    const obs: Obstacle = {
                      id: Math.random().toString(36).substr(2, 9),
                      x: Math.random() * dimensions.width,
                      y: -50,
                      width: 20,
                      height: 20,
                      color: '#ff0055',
                      vx: 0,
                    };
                    g.obstacles.push(obs);
                    if (socket) socket.emit("spawn-obstacle", { roomId, obstacle: obs });
                  }
                  playSound('spawn');
                }
              }}
            />
            <AbilityButton 
              icon={<Zap size={20} />} 
              label="EMP" 
              cost={40} 
              energy={gameRef.current.attackerEnergy}
              onClick={() => {
                const g = gameRef.current;
                if (g.attackerEnergy >= 40) {
                  g.attackerEnergy -= 40;
                  g.slowTimer = 180;
                  if (socket) socket.emit("attacker-ability", { roomId, type: 'EMP' });
                  playSound('powerup');
                  g.floatingTexts.push({ x: dimensions.width/2, y: dimensions.height/2, text: 'EMP BLAST!', life: 1.0, color: '#ff0055' });
                }
              }}
            />
            <AbilityButton 
              icon={<Shield size={20} />} 
              label="FIREWALL" 
              cost={60} 
              energy={gameRef.current.attackerEnergy}
              onClick={() => {
                const g = gameRef.current;
                if (g.attackerEnergy >= 60) {
                  g.attackerEnergy -= 60;
                  const count = 8;
                  const w = dimensions.width / count;
                  for(let i=0; i<count; i++) {
                    if (i === Math.floor(count/2)) continue; // Leave a gap
                    const obs: Obstacle = {
                      id: Math.random().toString(36).substr(2, 9),
                      x: i * w,
                      y: -50,
                      width: w - 5,
                      height: 30,
                      color: '#ff0055',
                    };
                    g.obstacles.push(obs);
                    if (socket) socket.emit("spawn-obstacle", { roomId, obstacle: obs });
                  }
                  playSound('spawn');
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const AbilityButton = ({ icon, label, cost, energy, onClick }: any) => (
  <button 
    onClick={onClick}
    disabled={energy < cost}
    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all active:scale-95 ${
      energy >= cost 
        ? 'bg-white/5 border-white/20 hover:bg-white/10 text-[#ff0055]' 
        : 'bg-black/40 border-white/5 text-white/20 cursor-not-allowed'
    }`}
  >
    {icon}
    <span className="text-[9px] font-bold tracking-widest">{label}</span>
    <span className="text-[8px] opacity-60">{cost}E</span>
  </button>
);
