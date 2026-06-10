// 로딩 UI 전용 상태 관리 객체
const LoadingUI = {
  overlay: null,
  inputCanvas: null,
  outputCanvas: null,
  statusText: null,
  kText: null,
  dataLog: null,
  scannerLine: null,
  ctxIn: null,
  ctxOut: null,
  imageWidth: 0,
  imageHeight: 0,
  imgDataOut: null,
  
  init() {
    this.overlay = document.getElementById("loadingOverlay");
    this.inputCanvas = document.getElementById("loadingInputCanvas");
    this.outputCanvas = document.getElementById("loadingOutputCanvas");
    this.statusText = document.getElementById("loadingStatusText");
    this.kText = document.getElementById("loadingKText");
    this.scannerLine = document.querySelector(".scanner-line");
    // 데이터 로그 패널
    this.dataLog = document.getElementById("loadingDataLog");
    
    if (this.inputCanvas) this.ctxIn = this.inputCanvas.getContext("2d");
    if (this.outputCanvas) this.ctxOut = this.outputCanvas.getContext("2d");
    
    // 리사이즈 이벤트 바인딩
    window.addEventListener('resize', () => {
      if (this.overlay && this.overlay.classList.contains('visible')) {
        this.resizeWrappers();
      }
    });
  },

  resizeWrappers() {
    if (!this.imageWidth || !this.imageHeight) return;
    const aspect = this.imageWidth / this.imageHeight;
    const isMobile = window.matchMedia("(orientation: portrait)").matches;
    const wrappers = document.querySelectorAll("#loadingOverlay .scanner-wrapper");
    
    let maxWidth, maxHeight;
    if (isMobile) {
      // 모바일 (세로 배치): 가로는 화면 거의 꽉 채우고, 세로는 상하단 여백 및 텍스트 공간 제외
      maxWidth = window.innerWidth * 0.85; 
      maxHeight = (window.innerHeight * 0.8 - 150) / 2;
    } else {
      // 데스크탑 (가로 배치): 가로는 적당히 넓게, 세로는 충분히 여유롭게
      maxWidth = Math.min(Math.max(window.innerWidth * 0.35, 200), 450); 
      maxHeight = window.innerHeight * 0.65;
    }
    
    // 주어진 최대 공간(maxWidth, maxHeight) 안에서 aspect 비율을 깨지 않고 가장 크게 렌더링
    let finalWidth = maxWidth;
    let finalHeight = finalWidth / aspect;
    
    if (finalHeight > maxHeight) {
      finalHeight = maxHeight;
      finalWidth = finalHeight * aspect;
    }
    
    wrappers.forEach(w => {
      w.style.width = `${finalWidth}px`;
      w.style.height = `${finalHeight}px`;
    });
  },

  show() {
    if (this.overlay) this.overlay.classList.add("visible");
    // CSS 가짜 애니메이션을 끄고 자바스크립트 수동 위치 동기화로 변경
    if (this.scannerLine) {
      this.scannerLine.style.animation = "none";
      this.scannerLine.style.top = "0%";
      this.scannerLine.style.opacity = "1";
    }
  },

  hide() {
    if (this.overlay) this.overlay.classList.remove("visible");
  },

  setStatus(text) {
    if (this.statusText) this.statusText.textContent = text;
  },

  setKText(text) {
    if (this.kText) this.kText.textContent = text;
  },

  setupCanvases(width, height, grayMatrix) {
    this.imageWidth = width;
    this.imageHeight = height;
    
    // JS 기반으로 최적 크기를 실시간 계산하도록 변경
    this.resizeWrappers();
    
    if (this.inputCanvas) {
      this.inputCanvas.width = width;
      this.inputCanvas.height = height;
      const imgDataIn = this.ctxIn.createImageData(width, height);
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          const val = grayMatrix[i][j];
          const idx = (i * width + j) * 4;
          imgDataIn.data[idx] = val;
          imgDataIn.data[idx+1] = val;
          imgDataIn.data[idx+2] = val;
          imgDataIn.data[idx+3] = 255;
        }
      }
      this.ctxIn.putImageData(imgDataIn, 0, 0);
      
      // 원래 작은 이미지에 텍스트를 그리는 코드가 있었으나,
      // 숫자가 너무 빽빽해서 지저분한 그리드처럼 보이므로 제거함.
    }
    
    if (this.outputCanvas) {
      this.outputCanvas.width = width;
      this.outputCanvas.height = height;
      this.ctxOut.clearRect(0, 0, width, height);
      this.imgDataOut = this.ctxOut.createImageData(width, height);
    }
    
    if (this.dataLog) {
      this.dataLog.innerHTML = "";
    }
  },

  // SVD 복원 과정에서 한 줄(Row) 계산이 끝날 때마다 호출됨
  async onRowCalculated(y, rowData) {
    // 1. 출력 캔버스 업데이트
    if (this.imgDataOut && this.ctxOut) {
      for (let x = 0; x < this.imageWidth; x++) {
        const idx = (y * this.imageWidth + x) * 4;
        const val = rowData[x];
        this.imgDataOut.data[idx] = val;
        this.imgDataOut.data[idx+1] = val;
        this.imgDataOut.data[idx+2] = val;
        this.imgDataOut.data[idx+3] = 255;
      }
      this.ctxOut.putImageData(this.imgDataOut, 0, 0);
      
      // 출력 캔버스에도 동일하게 숫자 그리기 제거됨
    }

    // 2. 스캔 라인 동기화 (실제 Y 좌표 비례 이동)
    if (this.scannerLine) {
      const percentage = (y / Math.max(1, this.imageHeight - 1)) * 100;
      this.scannerLine.style.top = `${percentage}%`;
    }

    // 3. 실제 계산된 행렬 값 패널 출력 (너무 자주 쓰면 렉이 걸리므로 속도 조절)
    const logInterval = Math.max(1, Math.floor(this.imageHeight / 30)); 
    if (this.dataLog && y % logInterval === 0) {
      const sample = Array.from(rowData).slice(0, 10).map(v => Math.round(v));
      const logLine = document.createElement("div");
      logLine.textContent = `[Row ${y}] ${sample.join(", ")}${rowData.length > 10 ? ', ...' : ''}`;
      this.dataLog.appendChild(logLine);
      
      // 자동 스크롤 기능
      if (this.dataLog.childNodes.length > 50) {
        this.dataLog.removeChild(this.dataLog.firstChild);
      }
      this.dataLog.scrollTop = this.dataLog.scrollHeight;
    }

    // 4. 리얼타임 시각화를 위해 브라우저 렌더링 흐름(UI thread) 양보
    // 매 줄마다 넘기면 500x500 연산 시 너무 느려지므로, 적절한 청크 단위로 requestAnimationFrame 호출
    const chunk = Math.max(1, Math.floor(this.imageHeight / 50));
    if (y % chunk === 0) {
       await new Promise(r => requestAnimationFrame(r));
    }
  },

  // Power Iteration 진행 시 호출됨 (행렬 분해 진짜 수학 연산 시각화)
  async onDecompIteration(iter, vVector, sigma, rank1Matrix) {
    // 1. 우측 캔버스에 수렴 중인 뼈대(Rank-1) 이미지 렌더링
    if (this.imgDataOut && this.ctxOut) {
      for (let y = 0; y < this.imageHeight; y++) {
        for (let x = 0; x < this.imageWidth; x++) {
          const idx = (y * this.imageWidth + x) * 4;
          const val = rank1Matrix[y][x];
          this.imgDataOut.data[idx] = val;
          this.imgDataOut.data[idx+1] = val;
          this.imgDataOut.data[idx+2] = val;
          this.imgDataOut.data[idx+3] = 255;
        }
      }
      this.ctxOut.putImageData(this.imgDataOut, 0, 0);
    }

    // 2. 스캔 라인은 위아래로 진동 (전역 연산임을 시각화)
    if (this.scannerLine) {
      const percentage = (Math.sin(iter * 0.8) * 40) + 50; // 10% ~ 90% 사이를 오감
      this.scannerLine.style.top = `${percentage}%`;
    }

    // 3. 로그 창에 실제 수렴 중인 고유 벡터 v 출력
    if (this.dataLog) {
      const sample = Array.from(vVector).slice(0, 5).map(v => v.toFixed(3));
      const logLine = document.createElement("div");
      logLine.style.color = "#ffff00"; // 노란색으로 강조
      logLine.textContent = `[Power Iteration ${iter}] σ₁ ≈ ${Math.round(sigma)}, v ≈ [${sample.join(", ")}...]`;
      this.dataLog.appendChild(logLine);
      
      if (this.dataLog.childNodes.length > 50) {
        this.dataLog.removeChild(this.dataLog.firstChild);
      }
      this.dataLog.scrollTop = this.dataLog.scrollHeight;
    }

    // 잠시 대기하여 애니메이션 감상
    await new Promise(r => setTimeout(r, 100));
  }
};
