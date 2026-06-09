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
      
      // 행렬이 작아서 보일만 할 때 (최대 40px 이하) - 캔버스 픽셀 위에 실제 밝기 숫자 렌더링!
      if (width <= 40 && height <= 40) {
        // 이미지가 작으면 캔버스 자체를 화면에 꽉 채워서 확대 표시하게 되므로 글자를 그려도 잘 보입니다.
        // 현재 CSS에서 canvas는 width 100% 등으로 늘어나므로 픽셀 1개가 크게 보임.
        // 우리는 픽셀 1단위에 글자를 적어야 함 (픽셀 좌표 0,0, 1,1 단위)
        this.ctxIn.font = "0.5px Arial";
        this.ctxIn.fillStyle = "#00ffbb";
        this.ctxIn.textAlign = "center";
        this.ctxIn.textBaseline = "middle";
        for (let i = 0; i < height; i++) {
          for (let j = 0; j < width; j++) {
            this.ctxIn.fillText(Math.round(grayMatrix[i][j]), j + 0.5, i + 0.5);
          }
        }
      }
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
      
      // 작은 행렬일 경우 결과 캔버스에도 진짜 숫자 그리기!
      if (this.imageWidth <= 40 && this.imageHeight <= 40) {
        this.ctxOut.font = "0.5px Arial";
        this.ctxOut.fillStyle = "#ff3366"; // 연산 결과는 다른 색상으로
        this.ctxOut.textAlign = "center";
        this.ctxOut.textBaseline = "middle";
        for (let x = 0; x < this.imageWidth; x++) {
          this.ctxOut.fillText(Math.round(rowData[x]), x + 0.5, y + 0.5);
        }
      }
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
