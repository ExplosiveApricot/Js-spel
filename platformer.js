/**
 * Platformer Game with Boss Battle
 * A complete 2D side-scrolling platformer with player-controlled camera, difficulty levels and boss fight
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Resize canvas to match window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Sound system
let soundEnabled = true;
document.addEventListener('DOMContentLoaded', () => {
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            soundToggle.textContent = soundEnabled ? '🔊 Sound On' : '🔇 Sound Off';
        });
    }
});

// Placeholder sound effect player
function playSound(type) {
    if (!soundEnabled) return;
    // Visual feedback for sound effects (no actual audio files)
    // In a real game, actual audio would play here
}

// ============================================================================
// DIFFICULTY SYSTEM
// ============================================================================
class DifficultyManager {
    constructor() {
        this.difficulty = null;
        this.config = {
            Easy: {
                enemySpawnRate: 180,   // slower spawns (~3 seconds)
                enemySpeed: 1.5,
                bossHealth: 300,
                playerDamageMultiplier: 0.5,
                enemyDamage: 3,
                projectileCooldown: 20,
                bossPhaseSwitchHealth: [225, 150, 75]
            },
            Medium: {
                enemySpawnRate: 120,
                enemySpeed: 2.5,
                bossHealth: 500,
                playerDamageMultiplier: 1,
                enemyDamage: 5,
                projectileCooldown: 20,
                bossPhaseSwitchHealth: [375, 250, 125]
            },
            Hard: {
                enemySpawnRate: 90,
                enemySpeed: 3.5,
                bossHealth: 750,
                playerDamageMultiplier: 1.5,
                enemyDamage: 8,
                projectileCooldown: 20,
                bossPhaseSwitchHealth: [562, 375, 187]
            },
            Nightmare: {
                enemySpawnRate: 60,
                enemySpeed: 4.5,
                bossHealth: 1000,
                playerDamageMultiplier: 2,
                enemyDamage: 12,
                projectileCooldown: 20,
                bossPhaseSwitchHealth: [750, 500, 250]
            }
        };
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }

    getConfig(difficulty = null) {
        const diff = difficulty || this.difficulty;
        return this.config[diff];
    }
}

// ============================================================================
// PLAYER CLASS
// ============================================================================
class Player {
    constructor(x, y, gameManager) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 40;
        this.velocityX = 0;
        this.velocityY = 0;
        this.jumpPower = 15;
        this.speed = 5;
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.isJumping = false;
        this.isGrounded = false;
        this.gravity = 0.6;
        this.gameManager = gameManager;

        // Weapon system
        this.projectileCooldown = 0;
        this.projectileSpeed = 8;
        this.projectileDamage = 20; // buffed damage
        this.direction = 1; // 1 = facing right, -1 = facing left

        // Input handling
        this.keys = {};
        this.setupInputHandling();
    }

    setupInputHandling() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    update(platforms, gameManager) {
        // Horizontal movement
        this.velocityX = 0;
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.velocityX = -this.speed;
            this.direction = -1; // Face left
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            this.velocityX = this.speed;
            this.direction = 1; // Face right
        }

        // Apply gravity
        this.velocityY += this.gravity;
        if (this.velocityY > 15) this.velocityY = 15; // Terminal velocity

        // Check for jump input
        if ((this.keys[' '] || this.keys['w'] || this.keys['arrowup']) && this.isGrounded) {
            this.velocityY = -this.jumpPower;
            this.isGrounded = false;
            this.isJumping = true;
            playSound('jump');
        } else if (!this.isGrounded) {
            this.isJumping = false;
        }

        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Collision with platforms
        this.isGrounded = false;
        platforms.forEach(platform => {
            // Check collision with platform
            if (this.velocityY >= 0 &&
                this.y + this.height >= platform.y &&
                this.y + this.height <= platform.y + platform.height + 5 &&
                this.x + this.width > platform.x &&
                this.x < platform.x + platform.width) {
                this.y = platform.y - this.height;
                this.velocityY = 0;
                this.isGrounded = true;
            }
        });

        // Shooting
        if (this.projectileCooldown > 0) {
            this.projectileCooldown--;
        }

        if (this.keys['control'] || this.keys['enter']) {
            if (this.projectileCooldown <= 0) {
                this.shoot(gameManager);
                this.projectileCooldown = gameManager.difficultyManager.getConfig().projectileCooldown;
            }
        }

        // Fall off screen
        if (this.y > canvas.height + 100) {
            this.takeDamage(999); // Die
        }

        // Boundaries (use world coordinates rather than screen)
        if (this.x < 0) this.x = 0;
        const worldMaxX = gameManager.levelGenerator ? gameManager.levelGenerator.worldWidth : canvas.width;
        if (this.x + this.width > worldMaxX) this.x = worldMaxX - this.width;
    }

    shoot(gameManager) {
        playSound('shoot');
        const projectile = new Projectile(
            this.x + this.width / 2,
            this.y + this.height / 2,
            this.projectileSpeed * this.direction, // Speed affected by direction
            this.projectileDamage
        );
        gameManager.projectiles.push(projectile);
    }

    takeDamage(amount) {
        const config = this.gameManager.difficultyManager.getConfig();
        this.health -= amount * (config.playerDamageMultiplier || 1);
        playSound('hit');
        if (this.health < 0) this.health = 0;
    }

    heal(amount) {
        this.health = Math.min(this.health + amount, this.maxHealth);
    }

    draw(ctx) {
        // Save context for potential flipping
        ctx.save();
        
        // Flip horizontally if facing left
        if (this.direction === -1) {
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.scale(-1, 1);
            ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
        }

        // Player body
        ctx.fillStyle = '#FF6B6B';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Head
        ctx.fillStyle = '#FFB84D';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y - 5, 8, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2 - 4, this.y - 8, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2 + 4, this.y - 8, 2, 0, Math.PI * 2);
        ctx.fill();

        // Weapon indicator (pointing in direction faced)
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x + this.width, this.y + 15, 10, 10);
        
        ctx.restore();

        // Health bar
        const barWidth = 100;
        const barHeight = 10;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - 50, this.y - 20, barWidth, barHeight);
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(this.x - 50, this.y - 20, (this.health / this.maxHealth) * barWidth, barHeight);
    }
}

// ============================================================================
// PROJECTILE CLASS
// ============================================================================
class Projectile {
    constructor(x, y, speed, damage) {
        this.x = x;
        this.y = y;
        this.width = 10;
        this.height = 5;
        this.speed = speed;
        this.damage = damage;
        this.lifetime = 300; // frames
    }

    update() {
        this.x += this.speed;
        this.lifetime--;
    }

    draw(ctx) {
        ctx.fillStyle = '#FFE66D';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    isAlive() {
        // stay alive while lifetime remains and within world bounds
        if (this.lifetime <= 0) return false;
        const worldWidth = game ? (game.levelGenerator ? game.levelGenerator.worldWidth : canvas.width) : canvas.width;
        return this.x >= -50 && this.x <= worldWidth + 50;
    }
}

// ============================================================================
// ENEMY CLASS
// ============================================================================
class Enemy {
    constructor(x, y, speed, health, damage) {
        this.x = x;
        this.y = y;
        this.width = 25;
        this.height = 35;
        this.speed = speed;
        this.maxHealth = health;
        this.health = health;
        this.damage = damage;
        this.velocityY = 0;
        this.gravity = 0.4;
        this.isGrounded = false;
        this.direction = -1; // Moving left towards player
        this.color = '#FF4444';
    }

    update(platforms, player) {
        // Gravity
        this.velocityY += this.gravity;
        if (this.velocityY > 10) this.velocityY = 10;

        // Movement
        this.x += this.direction * this.speed;
        this.y += this.velocityY;

        // Platform collision
        this.isGrounded = false;
        platforms.forEach(platform => {
            if (this.velocityY >= 0 &&
                this.y + this.height >= platform.y &&
                this.y + this.height <= platform.y + platform.height + 5 &&
                this.x + this.width > platform.x &&
                this.x < platform.x + platform.width) {
                this.y = platform.y - this.height;
                this.velocityY = 0;
                this.isGrounded = true;
            }
        });

        // Simple AI: try to jump towards player if not grounded
        if (this.isGrounded && Math.random() < 0.02) {
            this.velocityY = -8;
        }

        // Remove if off screen
        if (this.x < -100 || this.y > canvas.height + 100) {
            return true; // Mark for deletion
        }
        return false;
    }

    takeDamage(amount) {
        this.health -= amount;
        playSound('hit');
    }

    draw(ctx) {
        // Body
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Eyes
        ctx.fillStyle = '#FFF';
        ctx.fillRect(this.x + 5, this.y + 10, 5, 5);
        ctx.fillRect(this.x + 15, this.y + 10, 5, 5);

        // Pupils (looking at player)
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x + 6, this.y + 11, 3, 3);
        ctx.fillRect(this.x + 16, this.y + 11, 3, 3);

        // Health bar
        const barWidth = this.width;
        const barHeight = 4;
        ctx.fillStyle = '#666';
        ctx.fillRect(this.x, this.y - 8, barWidth, barHeight);
        ctx.fillStyle = '#FF6B6B';
        ctx.fillRect(this.x, this.y - 8, (this.health / this.maxHealth) * barWidth, barHeight);
    }
}

// ============================================================================
// BOSS CLASS
// ============================================================================
class Boss {
    constructor(x, y, difficultyConfig) {
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 100;
        this.maxHealth = difficultyConfig.bossHealth;
        this.health = this.maxHealth;
        this.velocityY = 0;
        this.gravity = 0.3;
        this.isGrounded = false;
        this.speed = 1; // slowed movement
        this.attackCooldown = 0;
        this.attackInterval = 100;
        this.phase = 1;
        this.phaseSwitchHealth = difficultyConfig.bossPhaseSwitchHealth;
        this.damage = 30;
        this.staggerCooldown = 0;
        this.color = '#8B0000';
    }

    update(platforms, player) {
        // Gravity
        this.velocityY += this.gravity;
        if (this.velocityY > 10) this.velocityY = 10;

        this.y += this.velocityY;

        // Platform collision
        this.isGrounded = false;
        platforms.forEach(platform => {
            if (this.velocityY >= 0 &&
                this.y + this.height >= platform.y &&
                this.y + this.height <= platform.y + platform.height + 5 &&
                this.x + this.width > platform.x &&
                this.x < platform.x + platform.width) {
                this.y = platform.y - this.height;
                this.velocityY = 0;
                this.isGrounded = true;
            }
        });

        // Boss AI
        if (player) {
            const distanceToPlayer = Math.abs(this.x - player.x);

            // Phase 1: Slow, melee attacks
            if (this.phase === 1) {
                if (this.x > player.x + 100) {
                    this.x -= this.speed;
                } else if (this.x < player.x - 100) {
                    this.x += this.speed;
                }

                if (this.isGrounded && Math.random() < 0.005) {
                    this.velocityY = -16; // bigger jump
                }
            }
            // Phase 2: Faster, more aggressive
            else if (this.phase === 2) {
                if (this.x > player.x + 50) {
                    this.x -= this.speed * 1.5;
                } else if (this.x < player.x - 50) {
                    this.x += this.speed * 1.5;
                }

                if (this.isGrounded && Math.random() < 0.01) {
                    this.velocityY = -18;
                }
            }
            // Phase 3: Very aggressive, max speed
            else if (this.phase === 3) {
                if (this.x > player.x) {
                    this.x -= this.speed * 2;
                } else if (this.x < player.x) {
                    this.x += this.speed * 2;
                }

                if (this.isGrounded && Math.random() < 0.015) {
                    this.velocityY = -20;
                }
            }
        }

        // Update phase based on health
        const newsPhase = this.getPhaseFromHealth();
        if (newsPhase !== this.phase) {
            this.phase = newsPhase;
            playSound('boost');
        }

        // Attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
        }

        if (this.staggerCooldown > 0) {
            this.staggerCooldown--;
        }
    }

    getPhaseFromHealth() {
        if (this.health > this.phaseSwitchHealth[0]) return 1;
        if (this.health > this.phaseSwitchHealth[1]) return 2;
        return 3;
    }

    takeDamage(amount) {
        this.health -= amount;
        this.staggerCooldown = 30;
        playSound('hit');
    }

    canAttack() {
        return this.attackCooldown <= 0;
    }

    attack() {
        this.attackCooldown = this.attackInterval;
        playSound('shoot');
    }

    draw(ctx) {
        // Stagger effect
        let offsetX = 0;
        if (this.staggerCooldown > 0) {
            offsetX = Math.random() * 4 - 2;
        }

        // Body (changes color based on phase)
        ctx.fillStyle = this.color;
        if (this.phase === 2) ctx.fillStyle = '#C41E3A';
        if (this.phase === 3) ctx.fillStyle = '#FF0000';

        ctx.fillRect(this.x + offsetX, this.y, this.width, this.height);

        // Head
        ctx.fillStyle = '#4a0000';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2 + offsetX, this.y - 15, 20, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (angry look)
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2 - 8 + offsetX, this.y - 18, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2 + 8 + offsetX, this.y - 18, 6, 0, Math.PI * 2);
        ctx.fill();

        // Pupils (phase indicator)
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2 - 8 + offsetX, this.y - 18, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2 + 8 + offsetX, this.y - 18, 3, 0, Math.PI * 2);
        ctx.fill();

        // Horns
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x + 10 + offsetX, this.y - 30);
        ctx.lineTo(this.x + offsetX, this.y - 45);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.x + this.width - 10 + offsetX, this.y - 30);
        ctx.lineTo(this.x + this.width + offsetX, this.y - 45);
        ctx.stroke();

        // Health bar (large)
        const barWidth = 200;
        const barHeight = 20;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width / 2 - barWidth / 2, 30, barWidth, barHeight);
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(canvas.width / 2 - barWidth / 2, 30, (this.health / this.maxHealth) * barWidth, barHeight);

        // Phase indicator
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`PHASE ${this.phase}`, canvas.width / 2, 55);
    }
}

// ============================================================================
// PLATFORM CLASS
// ============================================================================
class Platform {
    constructor(x, y, width, height, color = '#8B4513') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Add some texture
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}

// ============================================================================
// LEVEL GENERATOR
// ============================================================================
class LevelGenerator {
    constructor(gameManager) {
        this.gameManager = gameManager;
        this.platforms = [];
        this.enemies = [];
        this.worldWidth = 0;
        this.generateLevel();
    }

    generateLevel() {
        const groundY = canvas.height - 50;
        const cw = canvas.width;

        // Ground platform spans entire world
        const totalWidth = cw * 7;
        this.platforms.push(new Platform(0, groundY, totalWidth, 50, '#228B22'));

        // Preset platform layout - progressive difficulty
        const presetPlatforms = [
            // Starting area - easy platforms
            { x: 300, y: groundY - 120, w: 150, h: 20 },
            { x: 550, y: groundY - 100, w: 140, h: 20 },
            { x: 750, y: groundY - 140, w: 130, h: 20 },
            
            // Mid section - medium difficulty with varied heights
            { x: 950, y: groundY - 180, w: 120, h: 20 },
            { x: 1150, y: groundY - 150, w: 140, h: 20 },
            { x: 1400, y: groundY - 200, w: 110, h: 20 },
            { x: 1600, y: groundY - 130, w: 150, h: 20 },
            
            // Challenge section - tighter spacing and higher jumps
            { x: 1850, y: groundY - 220, w: 100, h: 20 },
            { x: 2050, y: groundY - 160, w: 130, h: 20 },
            { x: 2250, y: groundY - 240, w: 110, h: 20 },
            { x: 2450, y: groundY - 100, w: 140, h: 20 },
            
            // Upper navigation section
            { x: 2700, y: groundY - 280, w: 120, h: 20 },
            { x: 2900, y: groundY - 200, w: 130, h: 20 },
            { x: 3100, y: groundY - 150, w: 140, h: 20 },
            { x: 3300, y: groundY - 220, w: 100, h: 20 },
            { x: 3500, y: groundY - 180, w: 150, h: 20 },
            { x: 3700, y: groundY - 140, w: 130, h: 20 },
            
    
        ];

        // Add all preset platforms
        presetPlatforms.forEach(p => {
            this.platforms.push(new Platform(p.x, p.y, p.w, p.h));
        });

        // Create gap leading to boss arena
        this.platforms.push(new Platform(cw * 4 + 100, groundY, cw * 2, 50, '#228B22'));

        // Boss arena
        this.platforms.push(new Platform(cw * 6, groundY, cw, 50, '#8B0000'));

        this.worldWidth = totalWidth;
    }

    spawnEnemyRandomly() {
        const config = this.gameManager.difficultyManager.getConfig();
        const groundY = canvas.height - 50;

        // Spawn enemy ahead of camera, but not too close to the player
        let spawnX = this.gameManager.cameraX + canvas.width + Math.random() * 300;
        const player = this.gameManager.player;
        if (player && spawnX < player.x + player.width + 50) {
            spawnX = player.x + player.width + 50; // push further right
        }
        // also clamp inside world
        const worldMax = this.gameManager.levelGenerator ? this.gameManager.levelGenerator.worldWidth - 50 : spawnX;
        if (spawnX > worldMax) spawnX = worldMax;

        const enemy = new Enemy(
            spawnX,
            groundY - 100,
            config.enemySpeed,
            50,
            config.enemyDamage
        );

        this.enemies.push(enemy);
    }
}

// ============================================================================
// GAME MANAGER
// ============================================================================
class GameManager {
    constructor() {
        this.difficultyManager = new DifficultyManager();
        this.gameState = 'MENU'; // MENU, PLAYING, BOSS_FIGHT, GAME_OVER, VICTORY
        this.difficulty = null;
        this.player = null;
        this.projectiles = [];
        this.enemies = [];
        this.platforms = [];
        this.boss = null;
        this.levelGenerator = null;
        this.cameraX = 0;
        this.score = 0;
        this.enemySpawnCooldown = 0;
        this.bossSpawned = false;
        this.gameOverTime = 0;
        this.victoryTime = 0;
        this.minScrollX = 0; // Don't let camera go too far left
    }

    startGame(difficulty) {
        this.difficulty = difficulty;
        this.difficultyManager.setDifficulty(difficulty);
        this.gameState = 'PLAYING';
        this.score = 0;
        this.bossSpawned = false;
        this.cameraX = 0;
        this.minScrollX = 0;

        // Initialize game objects
        this.player = new Player(200, canvas.height - 150, this);
        this.levelGenerator = new LevelGenerator(this);
        this.platforms = this.levelGenerator.platforms;
        this.enemies = [];
        this.projectiles = [];
        // start enemy cooldown so first spawn happens quickly
        const cfg = this.difficultyManager.getConfig();
        this.enemySpawnCooldown = cfg.enemySpawnRate;
    }

    startBossFight() {
        this.gameState = 'BOSS_FIGHT';
        const config = this.difficultyManager.getConfig();
        const groundY = canvas.height - 50;

        // Move player to boss arena
        this.player.x = canvas.width * 6 + 100;
        this.player.y = groundY - 100;
        this.player.health = this.player.maxHealth;

        // Spawn boss near the boss arena (roughly six screens in)
        const arenaX = canvas.width * 6;
        const bossX = arenaX + 100; // just inside the red platform area
        this.boss = new Boss(bossX, groundY - 100, config);
        this.bossSpawned = true;
        this.enemies = []; // Clear regular enemies
        this.cameraX = canvas.width * 5.5;
        this.minScrollX = canvas.width * 5.5;
    }

    update() {
        if (this.gameState === 'MENU') {
            return;
        }

        if (this.gameState === 'PLAYING') {
            this.updateGameplay();
        } else if (this.gameState === 'BOSS_FIGHT') {
            this.updateBossFight();
        } else if (this.gameState === 'GAME_OVER') {
            this.gameOverTime++;
        } else if (this.gameState === 'VICTORY') {
            this.victoryTime++;
        }
    }

    updateGameplay() {
        // Update player
        this.player.update(this.platforms, this);

        // Camera system - follow player
        const targetCameraX = this.player.x - 200;
        if (targetCameraX > this.cameraX) {
            this.cameraX = targetCameraX;
        }
        
        // Prevent camera from going past world bounds
        const maxCameraX = this.levelGenerator.worldWidth - canvas.width;
        if (this.cameraX > maxCameraX) {
            this.cameraX = maxCameraX;
        }
        
        // Prevent camera from going too far left
        if (this.cameraX < 0) {
            this.cameraX = 0;
        }

        
        // eliminate any accidental death zone on right edge - player x is clamped earlier
        // no other death condition needed here

        // Update projectiles
        this.projectiles = this.projectiles.filter(p => p.isAlive());
        this.projectiles.forEach(p => p.update());

        // Check projectile-enemy collisions
        this.projectiles.forEach(projectile => {
            this.enemies.forEach(enemy => {
                if (this.checkCollision(projectile, enemy)) {
                    enemy.takeDamage(projectile.damage);
                    projectile.lifetime = 0;
                    this.score += 50;
                }
            });
        });

        // Update enemies
        this.enemies = this.enemies.filter(e => !e.update(this.platforms, this.player));
        this.enemies = this.enemies.filter(e => e.health > 0 || (this.score += 100, false));

        // Remove dead enemies and award points
        this.enemies = this.enemies.filter(enemy => {
            if (enemy.health <= 0) {
                this.score += 100;
                playSound('death');
                return false;
            }
            return true;
        });

        // Enemy-player collisions
        this.enemies.forEach(enemy => {
            if (this.checkCollision(this.player, enemy)) {
                this.player.takeDamage(enemy.damage);
                // Push player back
                if (this.player.x < enemy.x) {
                    this.player.x -= 20;
                } else {
                    this.player.x += 20;
                }
            }
        });

        // Spawn enemies
        const config = this.difficultyManager.getConfig();
        // determine boss area trigger once (slightly before world end)
        const bossTriggerX = this.levelGenerator.worldWidth - canvas.width * 1.5;
        // when player is within one screen of that trigger, clear enemies and prevent further spawning
        if (this.player.x > bossTriggerX - canvas.width) {
            this.enemies = [];
            this.enemySpawnCooldown = Infinity;
            // fully heal upon entering safe area
            this.player.health = this.player.maxHealth;
        } else {
            this.enemySpawnCooldown--;
            if (this.enemySpawnCooldown <= 0) {
                if (this.cameraX < this.levelGenerator.worldWidth - canvas.width - 500) {
                    this.levelGenerator.spawnEnemyRandomly();
                    this.enemies = this.levelGenerator.enemies;
                    this.enemySpawnCooldown = config.enemySpawnRate;
                }
            }
        }

        // Check if player reached boss area (based on player position near end of world)
        if (this.player.x > bossTriggerX && !this.bossSpawned) {
            this.startBossFight();
        }

        // Check player death
        if (this.player.health <= 0) {
            this.endGame(false);
        }
    }

    updateBossFight() {
        // Update player
        this.player.update(this.platforms, this);

        // Keep camera centered on boss arena
        this.cameraX = canvas.width * 5.5;

        // Update projectiles
        this.projectiles = this.projectiles.filter(p => p.isAlive());
        this.projectiles.forEach(p => p.update());

        // Projectile-boss collisions
        this.projectiles.forEach(projectile => {
            if (this.boss && this.checkCollision(projectile, this.boss)) {
                this.boss.takeDamage(projectile.damage);
                projectile.lifetime = 0;
                this.score += 25;
            }
        });

        // Update boss
        if (this.boss) {
            this.boss.update(this.platforms, this.player);

            // Boss melee attack
            if (this.checkCollision(this.boss, this.player)) {
                if (this.boss.canAttack()) {
                    this.player.takeDamage(this.boss.damage);
                    this.boss.attack();
                    playSound('hit');
                }
            }

            // Check if boss is defeated
            if (this.boss.health <= 0) {
                this.endGame(true);
            }
        }

        // Check player death
        if (this.player.health <= 0) {
            this.endGame(false);
        }
    }

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    endGame(victory) {
        if (victory) {
            this.gameState = 'VICTORY';
            playSound('boost');
            this.score += 5000; // Bonus for victory
        } else {
            this.gameState = 'GAME_OVER';
            playSound('death');
        }
        this.gameOverTime = 0;
        this.victoryTime = 0;
    }

    draw(ctx) {
        if (this.gameState === 'MENU') {
            this.drawMenu(ctx);
        } else if (this.gameState === 'PLAYING') {
            this.drawGameplay(ctx);
        } else if (this.gameState === 'BOSS_FIGHT') {
            this.drawBossFight(ctx);
        } else if (this.gameState === 'GAME_OVER') {
            this.drawGameplay(ctx);
            this.drawGameOver(ctx);
        } else if (this.gameState === 'VICTORY') {
            this.drawBossFight(ctx);
            this.drawVictory(ctx);
        }
    }

    drawMenu(ctx) {
        // Background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('BOSS-BATTLE', canvas.width / 2, 100);
        ctx.fillText('ADVENTURE', canvas.width / 2, 180);

        // Instructions
        ctx.font = '20px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        const instructions = [
            'Select Difficulty to Start',
            '',
            'Controls:',
            'A/D or Arrow Keys - Move',
            'W/Space or Up Arrow - Jump',
            'Ctrl or Enter - Shoot'
        ];

        let y = 350;
        instructions.forEach(line => {
            ctx.fillText(line, canvas.width / 2, y);
            y += 35;
        });

        // Difficulty buttons
        const difficulties = ['Easy', 'Medium', 'Hard', 'Nightmare'];
        const buttonWidth = 120;
        const buttonHeight = 50;
        const buttonSpacing = 20;
        const totalWidth = difficulties.length * buttonWidth + (difficulties.length - 1) * buttonSpacing;
        let startX = canvas.width / 2 - totalWidth / 2;

        difficulties.forEach((diff, index) => {
            const x = startX + index * (buttonWidth + buttonSpacing);
            const y = 600;

            ctx.fillStyle = '#FF6B6B';
            ctx.fillRect(x, y, buttonWidth, buttonHeight);

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, buttonWidth, buttonHeight);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(diff, x + buttonWidth / 2, y + buttonHeight / 2);

            // Store button for click detection
            this[`button_${diff}`] = { x, y, width: buttonWidth, height: buttonHeight };
        });

        // Credits
        ctx.font = '14px Arial';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('© 2024 Platformer Game', canvas.width / 2, canvas.height - 30);
    }

    drawGameplay(ctx) {
        // Draw platforms
        ctx.save();
        ctx.translate(-this.cameraX, 0);

        this.platforms.forEach(platform => platform.draw(ctx));

        // Draw enemies
        this.enemies.forEach(enemy => enemy.draw(ctx));

        // Draw player
        if (this.player) this.player.draw(ctx);

        // Draw projectiles
        this.projectiles.forEach(projectile => projectile.draw(ctx));

        ctx.restore();

        // HUD
        this.drawHUD(ctx);
    }

    drawBossFight(ctx) {
        // Draw platforms
        ctx.save();
        ctx.translate(-this.cameraX, 0);

        this.platforms.forEach(platform => platform.draw(ctx));

        // Draw player
        if (this.player) this.player.draw(ctx);

        // Draw boss
        if (this.boss) this.boss.draw(ctx);

        // Draw projectiles
        this.projectiles.forEach(projectile => projectile.draw(ctx));

        ctx.restore();

        // HUD
        this.drawHUD(ctx);

        // Boss fight indicator
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, 100);
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('⚔️ BOSS BATTLE ⚔️', canvas.width / 2, 60);
    }

    drawHUD(ctx) {
        // Score
        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Score: ${this.score}`, 20, 40);

        // Difficulty
        ctx.fillText(`Difficulty: ${this.difficulty}`, 20, 70);

        // Health text
        let healthText = `Health: ${Math.max(0, Math.floor(this.player.health))}/${this.player.maxHealth}`;
        ctx.fillText(healthText, 20, 100);
    }

    drawGameOver(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#FF0000';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 50);

        ctx.fillStyle = '#fff';
        ctx.font = '32px Arial';
        ctx.fillText(`Final Score: ${this.score}`, canvas.width / 2, canvas.height / 2 + 50);

        ctx.font = '24px Arial';
        ctx.fillText('Press SPACE or click to return to menu', canvas.width / 2, canvas.height / 2 + 120);
    }

    drawVictory(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('VICTORY!', canvas.width / 2, canvas.height / 2 - 50);

        ctx.fillStyle = '#fff';
        ctx.font = '32px Arial';
        ctx.fillText(`Final Score: ${this.score}`, canvas.width / 2, canvas.height / 2 + 50);
        
    }

    handleMenuClick(x, y) {
        const difficulties = ['Easy', 'Medium', 'Hard', 'Nightmare'];
        difficulties.forEach(diff => {
            const button = this[`button_${diff}`];
            if (button &&
                x >= button.x &&
                x < button.x + button.width &&
                y >= button.y &&
                y < button.y + button.height) {
                this.startGame(diff);
            }
        });
    }

    returnToMenu() {
        this.gameState = 'MENU';
        this.difficulty = null;
        this.cameraX = 0;
        this.player = null;
        this.boss = null;
        this.enemies = [];
        this.projectiles = [];
    }
}

// ============================================================================
// MAIN GAME LOOP
// ============================================================================
const game = new GameManager();

// Input handling
document.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (game.gameState === 'MENU') {
        game.handleMenuClick(x, y);
    } else if (game.gameState === 'GAME_OVER' || game.gameState === 'VICTORY') {
        if (game.gameOverTime > 60) {
            game.returnToMenu();
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (game.gameState === 'GAME_OVER' || game.gameState === 'VICTORY') {
            if (game.gameOverTime > 60) {
                game.returnToMenu();
            }
        }
    }
});

// Main game loop
function gameLoop() {
    // Clear canvas completely (remove any trails)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Optional background fill for sky color
    ctx.fillStyle = 'rgba(135, 206, 235, 1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update
    game.update();

    // Draw
    game.draw(ctx);

    requestAnimationFrame(gameLoop);
}

gameLoop();
