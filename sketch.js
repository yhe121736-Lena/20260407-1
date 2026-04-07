let points = [];
let gameState = "START"; // START, PLAYING, GAMEOVER, WIN
const pathWidth = 50;   // 路徑寬度
let isMoving = false;    // 是否已經觸碰起點開始移動
let particles = [];      // 粒子陣列
let shakeTime = 0;       // 震動計時器
let bgStars = [];        // 背景星星陣列
let starTrail = [];      // 流星尾巴座標陣列
let comets = [];         // 彗星陣列
let ufos = [];           // 幽浮陣列
let asteroids = [];      // 小行星陣列
let ufoHum;              // UFO 電磁音效振盪器
let startTime = 0;       // 開始導航的時間
let clearTime = 0;       // 通關花費時間
let scoreStars = 0;      // 獲得星等 (1-3)

function setup() {
  createCanvas(windowWidth, windowHeight);
  // 初始化音效 (使用合成器避免外部檔案載入失敗)
  ufoHum = new p5.Oscillator('sine');
  ufoHum.freq(100);
  ufoHum.amp(0);

  generatePath();
  createStars();
}

function createStars() {
  bgStars = [];
  for (let i = 0; i < 200; i++) {
    bgStars.push({
      x: random(width),
      y: random(height),
      size: random(1, 3),
      brightness: random(100, 255)
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  generatePath(); // 重新生成路徑以適應新視窗大小
  createStars();
  isMoving = false; // 重置狀態避免錯誤判定
  starTrail = [];   // 清空尾巴
  comets = [];      // 清空彗星
  ufos = [];        // 清空幽浮
  asteroids = [];   // 清空小行星
}

function draw() {
  // 畫面震動處理
  if (shakeTime > 0) {
    translate(random(-5, 5), random(-5, 5));
    shakeTime--;
  }

  background(5, 5, 20); // 更深邃的宇宙黑
  drawStars();          // 繪製背景星星
  updateAndDrawComets(); // 更新並繪製背景彗星
  updateAndDrawUFOs();   // 更新並繪製幽浮

  if (gameState === "START") {
    drawStartScreen();
  } else if (gameState === "PLAYING") {
    updatePlaying();
    drawGame();
    checkCollision();
    checkWin();
  } else if (gameState === "GAMEOVER") {
    drawGameOver();
  } else if (gameState === "WIN") {
    drawWinScreen();
  }

  // 更新並繪製粒子
  updateAndDrawParticles();
}

function drawStars() {
  noStroke();
  for (let s of bgStars) {
    // 讓星星有輕微閃爍感
    let b = s.brightness + sin(frameCount * 0.05 + s.x) * 50;
    fill(b, b, 255, 200);
    ellipse(s.x, s.y, s.size);
  }
}

// 彗星系統
function updateAndDrawComets() {
  // 1. 產生環境閃爍光效果
  if (comets.length > 0) {
    push();
    // 根據彗星數量計算亮度，並加上正弦波產生閃爍感
    let ambientAlpha = constrain(comets.length * 10 + sin(frameCount * 0.5) * 8, 0, 45);
    fill(200, 230, 255, ambientAlpha); // 淡淡的彗星冷色光
    noStroke();
    rect(0, 0, width, height);
    pop();
  }

  // 隨機產生彗星 (約每 120 幀出現一顆)
  if (random(1) < 0.008) {
    comets.push({
      x: random(width),
      y: -50,
      vx: random(4, 10),
      vy: random(4, 10),
      size: random(2, 4),
      tailLen: random(15, 30)
    });
  }

  for (let i = comets.length - 1; i >= 0; i--) {
    let c = comets[i];
    c.x += c.vx;
    c.y += c.vy;

    // 繪製彗星尾巴 (數個連續縮小的圓點)
    for (let j = 0; j < c.tailLen; j++) {
      let tx = c.x - (c.vx * j * 0.8);
      let ty = c.y - (c.vy * j * 0.8);
      let alpha = map(j, 0, c.tailLen, 200, 0);
      let s = map(j, 0, c.tailLen, c.size, 0.5);
      
      noStroke();
      fill(200, 230, 255, alpha);
      ellipse(tx, ty, s);
    }

    // 移除超出螢幕的彗星
    if (c.x > width + 200 || c.y > height + 200) {
      comets.splice(i, 1);
    }
  }
}

// 幽浮系統
function updateAndDrawUFOs() {
  // 極低機率產生幽浮 (約每 500 幀出現一次)
  if (random(1) < 0.002) {
    let direction = random() > 0.5 ? 1 : -1;
    ufos.push({
      x: direction === 1 ? -100 : width + 100,
      y: random(height * 0.2, height * 0.8),
      vx: random(2, 4) * direction,
      size: random(30, 50),
      wobbleOffset: random(TWO_PI)
    });
  }

  for (let i = ufos.length - 1; i >= 0; i--) {
    let u = ufos[i];
    u.x += u.vx;
    // 上下漂浮律動
    let currentY = u.y + sin(frameCount * 0.1 + u.wobbleOffset) * 15;

    // 音效處理：根據 UFO 是否在畫面中調整音量
    if (ufos.length > 0) {
      if (getAudioContext().state !== 'running') getAudioContext().resume();
      ufoHum.start();
      ufoHum.amp(0.1, 0.1); // 漸強
      ufoHum.freq(100 + sin(frameCount * 0.2) * 50); // 頻率抖動營造電磁感
    } else {
      ufoHum.amp(0, 0.5); // 漸弱
    }

    // 灑下星塵粒子 (每 3 幀產生一個)
    if (frameCount % 3 === 0) {
      particles.push({
        x: u.x + random(-u.size * 0.3, u.size * 0.3),
        y: currentY + u.size * 0.1, // 從機身底部灑出
        vx: u.vx * 0.5 + random(-0.5, 0.5), // 帶有原本幽浮的部分慣性
        vy: random(0.5, 2), // 緩慢下墜
        life: 100 + random(50),
        col: color(100, 255, 255, 180) // 與駕駛艙相同的青色星塵
      });
    }

    push();
    translate(u.x, currentY);
    
    // 1. 繪製半透明駕駛艙
    fill(100, 255, 255, 150);
    noStroke();
    arc(0, -u.size * 0.1, u.size * 0.5, u.size * 0.6, PI, TWO_PI);

    // 2. 繪製金屬機身
    fill(150, 150, 180);
    ellipse(0, 0, u.size, u.size * 0.4);

    // 3. 繪製底部閃爍燈光
    let colors = [color(255, 0, 0), color(0, 255, 0), color(255, 255, 0)];
    let lightIdx = floor(frameCount / 10) % 3;
    for (let j = -1; j <= 1; j++) {
      let lightCol = (j + 1 === lightIdx) ? colors[lightIdx] : color(50);
      fill(lightCol);
      ellipse(j * u.size * 0.25, u.size * 0.05, u.size * 0.1);
    }
    
    // 4. 側邊推進器微光
    fill(255, 255, 200, 50);
    ellipse(0, u.size * 0.1, u.size * 0.8, u.size * 0.1);
    
    pop();

    // 移除超出螢幕的幽浮
    if (u.x > width + 200 || u.x < -200) {
      ufos.splice(i, 1);
    }
  }
}

// 依照圖片要求，利用 vertex 指令產生 5 個點並串聯
function generatePath() {
  points = [];
  let currentY = 50;
  let currentX = width / 2;
  asteroids = [];
  
  // 起點
  points.push({ x: currentX, y: currentY });

  // 根據螢幕高度平均分配間距
  // 將轉折點數量從 4 增加到 8 (或更多)，讓路徑更長更彎曲
  let numSegments = 8; 
  let segmentHeight = (height - 100) / numSegments;

  for (let i = 0; i < numSegments; i++) {
    currentY += segmentHeight; // 往下延伸
    // 增加隨機位移的範圍 (原本是 40~100，現在改為 100~300)
    let offsetX = random(100, 300) * (random() > 0.5 ? 1 : -1);
    currentX = constrain(currentX + offsetX, pathWidth, width - pathWidth); 
    points.push({ x: currentX, y: currentY });
    
    // 在轉折點附近產生小行星裝飾
    if (random() > 0.3) {
      asteroids.push({
        x: currentX + random(-200, 200),
        y: currentY + random(-50, 50),
        size: random(10, 40),
        rot: random(TWO_PI),
        vRot: random(-0.02, 0.02)
      });
    }
  }
}

function updatePlaying() {
  // 如果還沒開始移動，檢查是否觸碰到起點
  if (!isMoving) {
    // 只有在滑鼠位於起點範圍內，且按下左鍵時才會啟動
    if (mouseIsPressed && dist(mouseX, mouseY, points[0].x, points[0].y) < pathWidth / 2) {
      isMoving = true;
      startTime = millis(); // 記錄開始航行的時間
      createExplosion(mouseX, mouseY, color(0, 255, 100), 20); // 開始特效
    }
  }
}

function drawGame() {
  drawAsteroids(); // 繪製裝飾性小行星

  // 1. 繪製「不穩定離子層」(邊界危險區)
  noFill();
  let flicker = sin(frameCount * 0.1) * 5;
  stroke(255, 50, 150, 40); // 霓虹粉紅色
  strokeWeight(pathWidth + 15 + flicker);
  drawPathLine();

  // 2. 繪製「星雲廊道」(安全飛行路徑)
  stroke(20, 20, 60, 200);
  strokeWeight(pathWidth);
  drawPathLine();

  // 3. 繪製廊道流動感
  stroke(100, 200, 255, 100);
  strokeWeight(pathWidth - 4);
  drawPathLine();

  // 4. 繪製離子束引導線
  stroke(255, 255, 255, 180);
  strokeWeight(1 + abs(sin(frameCount * 0.05)) * 2);
  drawPathLine();

  // 5. 繪製起點與終點
  noStroke();
  fill(0, 255, 150, 200 + flicker * 10); // 能源核心
  ellipse(points[0].x, points[0].y, pathWidth * 0.9);
  fill(255, 50, 255, 200); // 跳躍奇點
  ellipse(points[points.length-1].x, points[points.length-1].y, pathWidth * 0.9);

  // 6. 繪製提示文字與狀態
  fill(255);
  textSize(18);
  textAlign(CENTER);
  if (!isMoving) {
    text("點擊【能量核心】啟動躍遷", width / 2, 30);
  } else {
    // 顯示即時計時器
    let currentTime = (millis() - startTime) / 1000;
    text("航行時間: " + nf(currentTime, 1, 2) + "s", width / 2, 30);
  }

  // 7. 繪製跟隨滑鼠的玩家圈圈 (僅在 isMoving 為 true 時出現)
  if (isMoving) {
    noCursor();
    
    // 更新流星尾巴位置
    starTrail.push({ x: mouseX, y: mouseY });
    if (starTrail.length > 20) starTrail.shift(); // 限制尾巴長度為 20 個點

    // 繪製閃爍尾巴
    for (let i = 0; i < starTrail.length; i++) {
      let p = starTrail[i];
      let alpha = map(i, 0, starTrail.length, 0, 150); // 越舊的點越透明
      let size = map(i, 0, starTrail.length, 2, 12);   // 越舊的點越小
      fill(255, 255, 200, alpha);
      noStroke();
      ellipse(p.x, p.y, size);
    }

    // 繪製主題星際核心
    push();
    translate(mouseX, mouseY);
    
    // 1. 底層呼吸光暈
    let pulse = sin(frameCount * 0.1) * 5;
    noStroke();
    fill(255, 255, 200, 50);
    ellipse(0, 0, 25 + pulse);
    
    // 2. 旋轉星芒
    rotate(frameCount * 0.05);
    stroke(255, 255, 255, 150);
    strokeWeight(2);
    line(-12, 0, 12, 0);
    line(0, -12, 0, 12);
    
    // 3. 核心亮點
    fill(255);
    noStroke();
    ellipse(0, 0, 10);
    pop();

  } else {
    cursor(ARROW); // 還沒開始前顯示一般游標
  }
}

function drawAsteroids() {
  for (let a of asteroids) {
    a.rot += a.vRot;
    push();
    translate(a.x, a.y);
    rotate(a.rot);
    stroke(100);
    fill(40, 40, 50);
    // 繪製不規則多邊形代表小行星
    beginShape();
    for (let i = 0; i < TWO_PI; i += PI/4) {
      let r = a.size * (0.8 + noise(a.x, i) * 0.4);
      vertex(cos(i) * r, sin(i) * r);
    }
    endShape(CLOSE);
    pop();
  }
}

function drawPathLine() {
  strokeJoin(ROUND);
  beginShape();
  for (let p of points) vertex(p.x, p.y);
  endShape();
}

function checkCollision() {
  if (!isMoving) return; // 還沒開始不檢查碰撞

  // 簡化邏輯：檢查滑鼠與所有轉折點的距離，以及是否在路徑範圍外
  // 實務上急急棒需檢查點到線段的距離
  let onPath = false;
  
  for (let i = 0; i < points.length - 1; i++) {
    if (distToSegment(mouseX, mouseY, points[i], points[i+1]) < pathWidth / 2) {
      onPath = true;
      break;
    }
  }

  // 如果滑鼠在遊戲區域內但不在路徑上，則判定失敗
  if (!onPath) {
    shakeTime = 15; // 畫面震動
    createExplosion(mouseX, mouseY, color(255, 50, 50), 30); // 死亡爆炸
    gameState = "GAMEOVER";
  }
}

function checkWin() {
  if (!isMoving) return;
  let lastPoint = points[points.length - 1];
  if (dist(mouseX, mouseY, lastPoint.x, lastPoint.y) < pathWidth / 3) {
    // 通關結算
    clearTime = (millis() - startTime) / 1000;
    // 根據時間給予星等 (這裏的門檻值 10s 和 18s 可以根據地圖長度調整)
    if (clearTime < 10) scoreStars = 3;
    else if (clearTime < 18) scoreStars = 2;
    else scoreStars = 1;

    createExplosion(mouseX, mouseY, color(255, 215, 0), 100); // 勝利煙火
    gameState = "WIN";
  }
}

// 輔助函式：計算點到線段的距離
function distToSegment(px, py, p1, p2) {
  let l2 = distSq(p1.x, p1.y, p2.x, p2.y);
  if (l2 == 0) return dist(px, py, p1.x, p1.y);
  let t = ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / l2;
  t = constrain(t, 0, 1);
  return dist(px, py, p1.x + t * (p2.x - p1.x), p1.y + t * (p2.y - p1.y));
}

function distSq(x1, y1, x2, y2) { return Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2); }

// 特效系統
function createExplosion(x, y, col, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x,
      y: y,
      vx: random(-5, 5),
      vy: random(-5, 5),
      life: 255,
      col: col
    });
  }
}

function updateAndDrawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 5;
    noStroke();
    fill(red(p.col), green(p.col), blue(p.col), p.life);
    ellipse(p.x, p.y, random(2, 6)); // 粒子大小不一更像碎星
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// 畫面繪製
function drawStartScreen() {
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(32);
  text("★ 星際穿越 ★", width / 2, height / 2 - 20);
  
  textSize(16);
  let instructions = "【星際導航指南】\n\n1. 點擊 [青色能源核心] 啟動躍遷\n2. 沿著 [星雲廊道] 穩定飛行\n3. 嚴禁觸碰 [粉紅離子邊界]\n4. 抵達 [紫色奇點] 完成任務";
  text(instructions, width / 2, height / 2 + 100);
  
  textSize(20);
  text(">>> 點擊任意處進入駕駛艙 <<<", width / 2, height / 2 + 220);
  
  // 裝飾用背景粒子
  if (frameCount % 10 === 0) {
    createExplosion(random(width), random(height), color(255, 255, 255, 100), 1);
  }
}

function drawGameOver() {
  background(255, 0, 0, 100);
  fill(255);
  textAlign(CENTER);
  textSize(32);
  text("導航錯誤！太空船毀損", width / 2, height / 2);
  textSize(16);
  text("點擊畫面重新啟動引擎", width / 2, height / 2 + 40);
}

function drawWinScreen() {
  background(0, 255, 0, 100);
  fill(255);
  textAlign(CENTER);
  
  textSize(32);
  text("成功到達目的地！", width / 2, height / 2 - 40);
  
  textSize(24);
  text("通關時間: " + nf(clearTime, 1, 2) + " 秒", width / 2, height / 2 + 10);
  
  // 顯示星等評分
  let starRating = "評等: " + "★".repeat(scoreStars) + "☆".repeat(3 - scoreStars);
  text(starRating, width / 2, height / 2 + 50);

  textSize(16);
  text("點擊畫面挑戰更快的速度", width / 2, height / 2 + 100);
}

function mousePressed() {
  if (gameState === "START" || gameState === "GAMEOVER" || gameState === "WIN") {
    particles = []; // 清空舊粒子
    starTrail = []; // 清空舊尾巴
    ufos = [];      // 清空舊幽浮
    generatePath();
    gameState = "PLAYING";
    isMoving = false; // 重置移動狀態
  }
}