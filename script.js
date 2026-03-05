    const navLinks = document.querySelectorAll('nav ul li a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = document.querySelector(link.getAttribute('href'));
            section.scrollIntoView({ behavior: 'smooth' });
        });
    });

    document.addEventListener('contextmenu', e => e.preventDefault());

    const path = window.location.pathname.toLowerCase();
    if (path.endsWith('index.html') || path === '/' || path.endsWith('\\')) {
        document.body.classList.add('home');

        //BOTÃO DE JOGAR
        const myButton = document.createElement('button');
        myButton.textContent = 'Jogar';
        myButton.id = 'meu-botao';
        myButton.style.padding = '8px 16px';
        myButton.style.fontSize = '16px';
        document.body.appendChild(myButton);

        function showDifficultyMenu() {
            const menu = document.createElement('div');
            menu.id = 'diff-menu';
            Object.assign(menu.style, {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#222',
                padding: '20px',
                borderRadius: '10px',
                textAlign: 'center',
                zIndex: 1001
            });
            const title = document.createElement('div');
            title.textContent = 'Escolha a dificuldade';
            title.style.color = '#fff';
            title.style.marginBottom = '10px';
            menu.appendChild(title);
            const levels = ['Fácil','Médio','Difícil','Desafio'];
            levels.forEach(lvl => {
                const btn = document.createElement('button');
                btn.textContent = lvl;
                // dataset should use unaccented key for logic
                btn.dataset.diff = lvl.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
                btn.style.margin = '5px';
                btn.style.padding = '10px 20px';
                btn.style.border = 'none';
                btn.style.borderRadius = '5px';
                btn.style.cursor = 'pointer';
                btn.style.color = '#fff';
                let grad;
                const key = lvl.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
                switch(key){
                    case 'facil': grad='linear-gradient(to right,#4caf50,#81c784)'; break;
                    case 'medio': grad='linear-gradient(to right,#ffeb3b,#ffc107)'; break;
                    case 'dificil': grad='linear-gradient(to right,#f44336,#e57373)'; break;
                    case 'desafio': grad='linear-gradient(to right,#9c27b0,#ba68c8)'; break;
                }
                btn.style.background = grad;
                btn.addEventListener('click', () => {
                    difficulty = btn.dataset.diff;
                    document.body.removeChild(menu);
                    myButton.textContent = 'Voltar';
                    startGame();
                });
                menu.appendChild(btn);
            });
            document.body.appendChild(menu);
        }

        let playing = false;
        let gameCanvas, ctx, player, target, score, obstacles, walls, lasers, diagonals, bounces, reverseObs, bossItems;
        let keys = {};
        let highScore = 0;
        let wallCooldown = 0; 
        let difficulty = 'facil';

        function handleKeyDown(e) {
            keys[e.key] = true;
        }
        function handleKeyUp(e) {
            keys[e.key] = false;
        }

        function placeTarget() {
            // colocar o alvo na região central (60%) para evitar que fique muito difícil no início
            const regionW = gameCanvas.width * 0.6;
            const regionH = gameCanvas.height * 0.6;
            const offsetX = (gameCanvas.width - regionW) / 2;
            const offsetY = (gameCanvas.height - regionH) / 2;
            target = {
                x: offsetX + Math.random() * (regionW - 20),
                y: offsetY + Math.random() * (regionH - 20),
                size: 20
            };
        }

        function spawnObstacle() {
            const size = 20 + Math.random() * 30;
            obstacles.push({
                x: gameCanvas.width,
                y: Math.random() * (gameCanvas.height - size),
                w: size,
                h: size,
                speed: 6 + Math.random() * 4 
            });
        }
        // LIMITE DE 5 OBSTACULOS DE TRÁS PARA EVITAR SOBRECARGA
        function spawnReverse() {
            if (reverseObs.length >= 5) return; 
            const size = 20 + Math.random() * 30;
            reverseObs.push({
                x: -size,
                y: Math.random() * (gameCanvas.height - size),
                w: size,
                h: size,
                // tornar obstáculos de trás mais rápidos
                speed: 8 + Math.random() * 4 
            });
        }
        function spawnBoss() {
            // boss maior, lento mas permanece cerca de 5s
            const size = 50 + Math.random() * 30;
            bossItems.push({
                x: Math.random() * gameCanvas.width,
                y: Math.random() * gameCanvas.height,
                w: size,
                h: size,
                vx: (Math.random()-0.5)*10,
                vy: (Math.random()-0.5)*10,
                ttl: 300
            });
        }
        function spawnWall() {
            const gap = 80 + Math.random() * 50;
            const gapY = Math.random() * (gameCanvas.height - gap);
            walls.push({
                x: gameCanvas.width,
                w: 20,
                gapY,
                gap,
                speed: 4 + score * 0.02 
            });
        }

        function spawnLaser() {
            lasers.push({
                x: gameCanvas.width,
                y: Math.random() * (gameCanvas.height - 5),
                w: 40,
                h: 5,
                speed: 8 + Math.random() * 4
            });
        }
        function drawScore() {
            ctx.fillStyle = '#000';
            ctx.font = '20px Arial';
            ctx.fillText('Pontos: ' + score, 10, 30);
        }

        function spawnDiagonal() {
            const size = 20 + Math.random() * 20;
            const dirY = Math.random() < 0.5 ? -1 : 1;
            diagonals.push({
                x: gameCanvas.width,
                y: Math.random() * (gameCanvas.height - size),
                w: size,
                h: size,
                vx: -5 - Math.random() * 3,
                vy: dirY * (2 + Math.random() * 2)
            });
        }

        function spawnBounce() {
            const size = 20 + Math.random() * 20;
            const vy = 3 + Math.random() * 3;
            bounces.push({
                x: gameCanvas.width,
                y: Math.random() * (gameCanvas.height - size),
                w: size,
                h: size,
                vx: -4 - Math.random() * 2,
                vy,
            });
        }

        function gameLoop() {
            if (!playing) return;
            ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

            const speedMult = difficulty === 'desafio' ? 1.5 : 1;
            const step = player.speed * speedMult;
            if (keys['ArrowUp']) player.y = Math.max(0, player.y - step);
            if (keys['ArrowDown']) player.y = Math.min(gameCanvas.height - player.size, player.y + step);
            if (keys['ArrowLeft']) player.x = Math.max(0, player.x - step);
            if (keys['ArrowRight']) player.x = Math.min(gameCanvas.width - player.size, player.x + step);

            // JOGADOR
            ctx.fillStyle = 'red';
            ctx.fillRect(player.x, player.y, player.size, player.size);

            // TARGETO
            ctx.fillStyle = 'green';
            ctx.fillRect(target.x, target.y, target.size, target.size);

            if (Math.abs(player.x - target.x) < player.size && Math.abs(player.y - target.y) < player.size) {
                score += 1;
                // dificuldade extra: desacelera a cada 12 pontos, mínimo 2
                if (difficulty === 'desafio' && score % 12 === 0) {
                    player.speed = Math.max(2, player.speed - 0.55);
                }
                placeTarget();
            }

            // OBSTACULOS
            ctx.fillStyle = 'black';
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const o = obstacles[i];
                o.x -= o.speed * speedMult;
                ctx.fillRect(o.x, o.y, o.w, o.h);
                if (o.x + o.w < 0) {
                    obstacles.splice(i, 1);
                }
                if (player.x < o.x + o.w &&
                    player.x + player.size > o.x &&
                    player.y < o.y + o.h &&
                    player.y + player.size > o.y) {
                    stopGame();
                    alert('Game over! Score: ' + score + '\nRecorde: ' + highScore);
                    return;
                }
            }
            if (Math.random() < 0.05) spawnObstacle();

            // PAREDE E LASER COM VARIAÇÃO POR DIFICULDADE
            if (difficulty !== 'facil') {
                if (wallCooldown <= 0) {
                    // menos paredes e mais lentas no desafio, mas movimento geral mais rápido
                    let wallProb = difficulty === 'medio' ? 0.0035 :
                                   difficulty === 'dificil' ? 0.005 :
                                   0.005; // reduzir ainda mais no desafio
                    if (Math.random() < wallProb) {
                        spawnWall();
                        // cooldown menor no desafio
                        wallCooldown = difficulty === 'desafio' ? 80 : 120;
                    }
                }
                // lasers também reduzidos
                let laserProb = difficulty === 'medio' ? 0.02 :
                                difficulty === 'dificil' ? 0.03 :
                                0.04; // desafio
                if (Math.random() < laserProb) spawnLaser();
            }

            // DIAGONAL E QUICADORES NO DIFICL E DESAFIO
            if (difficulty === 'dificil' || difficulty === 'desafio') {
                if (difficulty === 'dificil' && Math.random() < 0.02) spawnDiagonal();
                if (difficulty === 'dificil' && Math.random() < 0.02) spawnBounce();
                    if (difficulty === 'desafio') {
                    // reduzir ainda mais para diminuir a dificuldade extrema
                    if (Math.random() < 0.005) spawnDiagonal();
                    if (Math.random() < 0.005) spawnBounce();
                    // objetos de trás só no desafio para aumentar a imprevisibilidade
                    if (Math.random() < 0.02) spawnReverse();
                    // boss um pouco mais frequente
                    if (Math.random() < 0.01) spawnBoss();
                }
            }

            if (wallCooldown > 0) wallCooldown--;
            // DIAGONALIS
            ctx.fillStyle = 'orange';
            for (let i = diagonals.length - 1; i >= 0; i--) {
                const d = diagonals[i];
                d.x += d.vx * speedMult;
                d.y += d.vy * speedMult;
                ctx.fillRect(d.x, d.y, d.w, d.h);
                if (d.x + d.w < 0 || d.y < 0 || d.y + d.h > gameCanvas.height) {
                    diagonals.splice(i, 1);
                    continue;
                }
                if (player.x < d.x + d.w &&
                    player.x + player.size > d.x &&
                    player.y < d.y + d.h &&
                    player.y + player.size > d.y) {
                    stopGame();
                    alert('Game over! Score: ' + score + '\nRecorde: ' + highScore);
                    return;
                }
            }

            // QUICADORES
            ctx.fillStyle = 'magenta';
            for (let i = bounces.length - 1; i >= 0; i--) {
                const b = bounces[i];
                b.x += b.vx * speedMult;
                b.y += b.vy * speedMult;
                if (b.y < 0 || b.y + b.h > gameCanvas.height) b.vy = -b.vy;
                ctx.fillRect(b.x, b.y, b.w, b.h);
                if (b.x + b.w < 0) {
                    bounces.splice(i, 1);
                    continue;
                }
                if (player.x < b.x + b.w &&
                    player.x + player.size > b.x &&
                    player.y < b.y + b.h &&
                    player.y + player.size > b.y) {
                    stopGame();
                    alert('Game over! Score: ' + score + '\nRecorde: ' + highScore);
                    return;
                }
            }

            // PAREDES
            ctx.fillStyle = 'purple';
            for (let i = walls.length - 1; i >= 0; i--) {
                const w = walls[i];
                w.x -= w.speed;
                ctx.fillRect(w.x, 0, w.w, w.gapY);
                ctx.fillRect(w.x, w.gapY + w.gap, w.w, gameCanvas.height - (w.gapY + w.gap));
                if (w.x + w.w < 0) walls.splice(i, 1);
                if (player.x < w.x + w.w && player.x + player.size > w.x) {
                    if (player.y < w.gapY || player.y + player.size > w.gapY + w.gap) {
                        stopGame();
                        alert('Game over! Score: ' + score + '\nRecorde: ' + highScore);
                        return;
                    }
                }
            }

            // LASERS
            ctx.fillStyle = 'blue';
            for (let i = lasers.length - 1; i >= 0; i--) {
                const l = lasers[i];
                l.x -= l.speed;
                ctx.fillRect(l.x, l.y, l.w, l.h);
                if (l.x + l.w < 0) lasers.splice(i, 1);
                if (player.x < l.x + l.w &&
                    player.x + player.size > l.x &&
                    player.y < l.y + l.h &&
                    player.y + player.size > l.y) {
                    stopGame();
                    alert('Game over! Score: ' + score + '\nRecorde: ' + highScore);
                    return;
                }
            }
          
            if (wallCooldown > 0) wallCooldown--;
            if (wallCooldown > 0) wallCooldown--;
            // OBSTACULOS DE TRÁS
            ctx.fillStyle = 'grey';
            for (let i = reverseObs.length - 1; i >= 0; i--) {
                const r = reverseObs[i];
                r.x += r.speed * speedMult;
                ctx.fillRect(r.x, r.y, r.w, r.h);
                if (r.x > gameCanvas.width) reverseObs.splice(i,1);
                if (player.x < r.x + r.w &&
                    player.x + player.size > r.x &&
                    player.y < r.y + r.h &&
                    player.y + player.size > r.y) {
                    stopGame();
                    alert('Game over! Score: ' + score + '\nRecorde: ' + highScore);
                    return;
                }
            }
            // BOSS
            ctx.fillStyle = 'yellow';
            for (let i = bossItems.length - 1; i >= 0; i--) {
                const b = bossItems[i];
                b.x += b.vx * speedMult;
                b.y += b.vy * speedMult;
                b.ttl--;
                ctx.fillRect(b.x, b.y, b.w, b.h);
                if (b.ttl <= 0) { bossItems.splice(i,1); continue; }
                if (player.x < b.x + b.w &&
                    player.x + player.size > b.x &&
                    player.y < b.y + b.h &&
                    player.y + player.size > b.y) {
                    stopGame();
                    alert('Game over! Score: ' + score + '\nRecorde: ' + highScore);
                    return;
                }
            }
            drawScore();
            requestAnimationFrame(gameLoop);
        }

        function startGame() {
            highScore = parseInt(localStorage.getItem('highScore') || '0', 10);

            playing = true;
            document.body.classList.add('playing');
            document.body.style.overflow = 'hidden';
         
            document.querySelector('header').style.display = 'none';
            document.querySelector('nav').style.display = 'none';
            document.querySelector('footer').style.display = 'none';

           
            myButton.style.position = 'fixed';
            myButton.style.top = '10px';
            myButton.style.right = '10px';
            myButton.style.left = '';

            const main = document.querySelector('main');
            main.innerHTML = '';
            gameCanvas = document.createElement('canvas');
            gameCanvas.style.position = 'fixed';
            gameCanvas.style.top = '0';
            gameCanvas.style.left = '0';
            gameCanvas.width = window.innerWidth;
            gameCanvas.height = window.innerHeight;
            main.appendChild(gameCanvas);
            ctx = gameCanvas.getContext('2d');
            //  ajustar velocidade do jogador com base na dificuldade
            let speedValue;
            switch (difficulty) {
                case 'facil': speedValue = 8.0; break;
                case 'medio': speedValue = 6.5; break;
                case 'dificil': speedValue = 6.5; break;
                case 'desafio': speedValue = 4.0; break;
                default: speedValue = 6.5;
            }
            player = { x: 50, y: 50, size: 20, speed: speedValue };
            score = 0;
            obstacles = [];
            walls = [];
            lasers = [];
            diagonals = [];
            bounces = [];
            reverseObs = [];
            bossItems = [];
            wallCooldown = 0;
            placeTarget();
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
            gameLoop();
        }

        function stopGame() {
            playing = false;
            document.body.classList.remove('playing');
            document.body.style.overflow = '';
            document.querySelector('header').style.display = '';
            document.querySelector('nav').style.display = '';
            document.querySelector('footer').style.display = '';
            const main = document.querySelector('main');
            main.innerHTML = '';
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);

            myButton.style.cssText = '';
            myButton.style.padding = '8px 16px';
            myButton.style.fontSize = '16px';
            myButton.style.position = 'absolute';
            myButton.style.top = '650px';
            myButton.style.left = '50%';
            myButton.style.transform = 'translateX(-50%)';
            myButton.style.zIndex = '1000';

            myButton.textContent = 'Jogar';

            if (score > highScore) {
                highScore = score;
                localStorage.setItem('highScore', highScore);
            }
        }

        myButton.addEventListener('click', () => {
            if (!playing) {
                // evitar abrir múltiplos menus se o jogador clicar várias vezes rapidamente
                if (document.getElementById('diff-menu')) return;
                showDifficultyMenu();
            } else {
                stopGame();
            }
        });
    }