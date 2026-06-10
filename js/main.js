// Module script 사용.
// CDN import 가능.

// 이미지 입력 DOM.
const imageInput = document.getElementById("imageInput");
// 최대 크기 입력 DOM.
const maxSizeInput = document.getElementById("maxSizeInput");
// 최대 크기 슬라이더 DOM.
const maxSizeSlider = document.getElementById("maxSizeSlider");
// k 입력 DOM.
const kInput = document.getElementById("kInput");
// 실행 버튼 DOM.
const runButton = document.getElementById("runButton");
// 상태 메시지 DOM.
const statusDiv = document.getElementById("status");

// 원본 Canvas DOM.
const originalCanvas = document.getElementById("originalCanvas");
// 흑백 Canvas DOM.
const grayCanvas = document.getElementById("grayCanvas");
// singular value 그래프 Canvas DOM.
const singularCanvas = document.getElementById("singularCanvas");
// metric 그래프 Canvas DOM.
const metricCanvas = document.getElementById("metricCanvas");

// 복원 결과 영역 DOM.
const resultGrid = document.getElementById("resultGrid");
// metric 표 영역 DOM.
const metricTable = document.getElementById("metricTable");

// 원본 이미지 객체.
let sourceImage = null;
// grayscale 행렬 A.
let grayMatrix = null;
// 처리 이미지 너비.
let imageWidth = 0;
// 처리 이미지 높이.
let imageHeight = 0;

// SVD library 로딩 시작.
await loadSVDLibrary();

// 최대 크기 입력 한계 동적 조절 함수.
function updateMaxSizeLimit() {
  if (!sourceImage) return;
  // 이미지의 가로/세로 중 긴 변의 길이.
  const imgMaxDim = Math.max(sourceImage.width, sourceImage.height);
  // 절대 최대값인 1000과 이미지 크기 중 작은 값을 최대 한계로 설정.
  const allowedMax = Math.min(1000, imgMaxDim);
  
  // HTML input/slider max 속성 업데이트.
  maxSizeInput.max = allowedMax;
  maxSizeSlider.max = allowedMax;
  
  // 현재 설정된 값이 새로운 최대값보다 크다면 자동 조절.
  let currentValue = Number(maxSizeInput.value);
  if (currentValue > allowedMax) {
    maxSizeInput.value = allowedMax;
    maxSizeSlider.value = allowedMax;
  }
}

// 기본 이미지(svd_icon.png) 자동 로드
try {
  sourceImage = await loadImageFromUrl("svd_icon.png");
  // 이미지 로드 후 최대 크기 제한 업데이트
  updateMaxSizeLimit();
  drawInputImageAndMakeMatrix();
  updateRunButton();
  if (libraryReady) {
    statusDiv.textContent = "기본 이미지를 불러왔습니다. SVD 실행 버튼을 누르세요.";
  }
} catch (error) {
  console.log("기본 이미지 로딩 실패:", error);
}

// 이미지 선택 이벤트 등록.
imageInput.addEventListener("change", async (event) => {
  // 선택된 파일 얻기.
  const file = event.target.files[0];
  // 파일 없으면 종료.
  if (!file) return;

  // 이미지 파일 로딩.
  sourceImage = await loadImageFromFile(file);
  // 이미지 로드 후 최대 크기 제한 업데이트
  updateMaxSizeLimit();
  // Canvas 출력과 행렬 생성.
  drawInputImageAndMakeMatrix();
  // 실행 버튼 상태 갱신.
  updateRunButton();

  // library 준비 확인.
  if (libraryReady) {
    // 사용자 안내 표시.
    statusDiv.textContent = "이미지를 불러왔습니다. SVD 실행 버튼을 누르세요.";
  }
});

// 최대 크기 입력값 검증 및 동기화 함수.
function validateAndSyncMaxSize(source) {
  // HTML에 지정된 최대값 읽기.
  const maxAllowed = Number(maxSizeInput.max);
  // HTML에 지정된 최소값 읽기.
  const minAllowed = Number(maxSizeInput.min);
  // 현재 입력값 읽기.
  let value = Number(maxSizeInput.value);

  // 최대값 초과 검사.
  if (value > maxAllowed) {
    // 경고 팝업 표시.
    alert(`현재 업로드된 이미지의 원본 크기 제약으로 인해 최대 크기는 ${maxAllowed}px까지만 설정할 수 있습니다. 값을 ${maxAllowed}px로 자동 조정합니다.`);
    // 최대값으로 보정.
    value = maxAllowed;
  }

  // 최소값 미만 검사.
  if (value < minAllowed) {
    // 최소값으로 보정.
    value = minAllowed;
  }

  // 보정된 값을 입력창에 반영.
  maxSizeInput.value = value;
  // 보정된 값을 슬라이더에 반영.
  maxSizeSlider.value = value;
}

// 사이즈 재적용 공통 함수
function applyMaxSizeChange() {
  if (!sourceImage) return;
  drawInputImageAndMakeMatrix();
  resultGrid.innerHTML = "";
  metricTable.innerHTML = "";
  clearCanvas(singularCanvas.getContext("2d"), singularCanvas);
  clearCanvas(metricCanvas.getContext("2d"), metricCanvas);
  statusDiv.textContent = "이미지 크기를 다시 적용했습니다. SVD 실행 버튼을 누르세요.";
}

// 숫자 입력 변경 이벤트 (엔터 키 입력 또는 포커스 아웃 시 최종 보정)
maxSizeInput.addEventListener("change", () => {
  validateAndSyncMaxSize("input");
  applyMaxSizeChange();
});

// 키보드 누를 때 실시간 적용 (input 이벤트)
maxSizeInput.addEventListener("input", () => {
  const maxAllowed = Number(maxSizeInput.max);
  const minAllowed = Number(maxSizeInput.min);
  const value = Number(maxSizeInput.value);

  // 실시간 타이핑 중에는 강제 보정(팝업 등)을 하지 않고 유효할 때만 즉시 적용
  if (value >= minAllowed && value <= maxAllowed) {
    maxSizeSlider.value = value;
    applyMaxSizeChange();
  }
});

// 슬라이더 조작 중(실시간) 이벤트 등록.
maxSizeSlider.addEventListener("input", () => {
  maxSizeInput.value = maxSizeSlider.value;
  applyMaxSizeChange();
});

// 실행 버튼 이벤트 등록.
runButton.addEventListener("click", () => {
  // 예외 처리 시작.
  try {
    // SVD 실행.
    runSVD();
  } catch (error) {
    // 오류 콘솔 출력.
    console.error(error);
    // 오류 메시지 표시.
    statusDiv.textContent = "오류 발생: " + error.message;
  }
});



// k 값 입력 이벤트 등록 (포커스 잃을 때 자동 정리).
kInput.addEventListener("blur", formatKInput);

// k 값 입력창에서 Enter 키 누를 때 자동 정리 및 포커스 해제.
kInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    formatKInput();
    kInput.blur();
  }
});

// 실시간 타이핑 시 입력창 너비 자동 조절 (입력한 글자 수에 맞춰 늘어나게)
kInput.addEventListener("input", resizeKInput);

// 입력창 너비 자동 조절 함수
function resizeKInput() {
  // 170px를 최소 너비로 유지하고, 글자 수에 비례하여 늘립니다. (여백 고려하여 +3ch)
  // CSS에 max-width: 100%가 적용되어 있으므로 섹션 밖을 벗어나지 않습니다.
  kInput.style.width = `max(170px, ${kInput.value.length + 3}ch)`;
}

// 페이지 로드 시 초기 너비 설정
resizeKInput();

// k 입력창 내용 자동 정리 함수.
function formatKInput() {
  try {
    const maxRank = (imageWidth && imageHeight) ? Math.min(imageWidth, imageHeight) : Infinity;
    const kValues = parseKValues(kInput.value, maxRank);
    kInput.value = kValues.join(", ");
    resizeKInput(); // 정리 후 너비 재조정
  } catch (error) {
    // 유효한 숫자가 하나도 없어서 발생하는 에러 등은 무시 (실행 버튼 누를 때 검증됨)
  }
}

// 실행 버튼 갱신 함수.
function updateRunButton() {
  // library와 행렬이 있어야 활성화.
  runButton.disabled = !(libraryReady && grayMatrix);
}

// 파일을 이미지로 읽는 함수.
function loadImageFromFile(file) {
  // 비동기 결과 반환.
  return new Promise((resolve, reject) => {
    // 임시 URL 생성.
    const url = URL.createObjectURL(file);
    // Image 객체 생성.
    const img = new Image();

    // 이미지 로딩 성공 처리.
    img.onload = () => {
      // 임시 URL 해제.
      URL.revokeObjectURL(url);
      // 이미지 반환.
      resolve(img);
    };

    // 이미지 로딩 실패 처리.
    img.onerror = () => {
      // 임시 URL 해제.
      URL.revokeObjectURL(url);
      // 오류 반환.
      reject(new Error("이미지를 불러오지 못했습니다."));
    };

    // 이미지 로딩 시작.
    img.src = url;
  });
}

// URL에서 이미지를 읽는 함수 (기본 이미지 로드용)
function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // CORS 문제 방지
    
    img.onload = () => {
      resolve(img);
    };
    
    img.onerror = () => {
      reject(new Error(`URL에서 이미지를 불러오지 못했습니다: ${url}`));
    };
    
    img.src = url;
  });
}

// 입력 이미지를 Canvas와 행렬로 변환.
function drawInputImageAndMakeMatrix() {
  // 최대 크기 읽기.
  const maxSize = Number(maxSizeInput.value);
  // 원본 비율 유지 scale 계산.
  const scale = Math.min(maxSize / sourceImage.width, maxSize / sourceImage.height, 1);

  // 리사이즈 너비 계산.
  imageWidth = Math.max(1, Math.round(sourceImage.width * scale));
  // 리사이즈 높이 계산.
  imageHeight = Math.max(1, Math.round(sourceImage.height * scale));

  // 원본 Canvas 너비 설정.
  originalCanvas.width = imageWidth;
  // 원본 Canvas 높이 설정.
  originalCanvas.height = imageHeight;
  // 흑백 Canvas 너비 설정.
  grayCanvas.width = imageWidth;
  // 흑백 Canvas 높이 설정.
  grayCanvas.height = imageHeight;

  // 원본 Canvas context.
  const originalCtx = originalCanvas.getContext("2d");
  // 원본 이미지 그리기.
  originalCtx.drawImage(sourceImage, 0, 0, imageWidth, imageHeight);

  // 원본 pixel data 읽기.
  const imageData = originalCtx.getImageData(0, 0, imageWidth, imageHeight);
  // RGBA 배열 참조.
  const pixels = imageData.data;

  // grayscale 행렬 초기화.
  grayMatrix = Array.from({ length: imageHeight }, () => Array(imageWidth).fill(0));

  // 흑백 이미지 data 생성.
  const grayImageData = originalCtx.createImageData(imageWidth, imageHeight);

  // 모든 행 순회.
  for (let y = 0; y < imageHeight; y++) {
    // 모든 열 순회.
    for (let x = 0; x < imageWidth; x++) {
      // RGBA 시작 index 계산.
      const idx = (y * imageWidth + x) * 4;

      // Red 값 읽기.
      const r = pixels[idx];
      // Green 값 읽기.
      const g = pixels[idx + 1];
      // Blue 값 읽기.
      const b = pixels[idx + 2];

      // grayscale 밝기 계산.
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // 행렬 A에 저장.
      grayMatrix[y][x] = gray;

      // 흑백 R 저장.
      grayImageData.data[idx] = gray;
      // 흑백 G 저장.
      grayImageData.data[idx + 1] = gray;
      // 흑백 B 저장.
      grayImageData.data[idx + 2] = gray;
      // 불투명 alpha 저장.
      grayImageData.data[idx + 3] = 255;
    }
  }

  // 흑백 이미지 출력.
  grayCanvas.getContext("2d").putImageData(grayImageData, 0, 0);
}

// SVD 전체 실행 함수.
async function runSVD() {
  // SVD 계산 시작.
  if (!grayMatrix) {
    statusDiv.textContent = "오류: 먼저 이미지를 업로드하세요.";
    return;
  }

  // 로딩 UI 초기화
  LoadingUI.init();
  LoadingUI.setupCanvases(imageWidth, imageHeight, grayMatrix);
  LoadingUI.setStatus("SVD 행렬 분해 중...");
  LoadingUI.setKText("대기 중...");

  // 계산 결과 초기화.
  resultGrid.innerHTML = "";
  metricTable.innerHTML = "";
  // 중복 실행 방지.
  runButton.disabled = true;

  // 로딩 오버레이 표시
  LoadingUI.show();

  // 브라우저가 위 UI 변경 사항을 화면에 그릴 시간을 줍니다.
  await new Promise(resolve => setTimeout(resolve, 50));

  // 계산 예외 처리.
  try {
    // SVD 계산 시작 전, 수학적 과정을 시각적으로 보여주기 위한 Power Iteration 실행 (약 15회 반복)
    LoadingUI.setStatus("행렬 분석 중 (지배적 특이벡터 탐색)...");
    await simulatePowerIteration(grayMatrix, imageHeight, imageWidth, 15, async (iter, v, sigma, rank1Matrix) => {
      await LoadingUI.onDecompIteration(iter, v, sigma, rank1Matrix);
    });

    // 진짜 연산 과정을 충분히 보여준 후, 전체 행렬 분해(Decomposition)를 백그라운드에서 한 번에 완료합니다.
    LoadingUI.setStatus("전체 특이값 분해(SVD) 완료 중...");
    
    // Web Worker를 생성하여 무거운 SVD 연산을 백그라운드로 위임 (UI 프리징 완전 해소)
    const svdResult = await new Promise((resolve, reject) => {
      const worker = new Worker("js/worker.js", { type: "module" });
      
      worker.onmessage = (e) => {
        if (e.data.type === "success") {
          resolve(e.data);
        } else {
          reject(new Error(e.data.message));
        }
        worker.terminate(); // 연산 완료 후 워커 종료
      };
      
      worker.onerror = (err) => {
        reject(new Error("Web Worker 오류: " + (err.message || "SVD 연산 실패")));
        worker.terminate();
      };
      
      // 워커 스레드에 흑백 행렬 데이터 전송
      worker.postMessage({ grayMatrix: grayMatrix });
    });

    // 워커로부터 받은 계산 결과(일반 2D 배열) 매핑
    const U = svdResult.U;
    const V = svdResult.V;
    const singularValues = svdResult.singularValues;

    // SVD 결과 확인.
    if (!U || !V || !singularValues || singularValues.length === 0) {
      throw new Error("SVD 결과가 올바르지 않습니다.");
    }

    // 상태 변경
    LoadingUI.setStatus("행렬 복원 진행 중...");

    // 가능한 최대 rank.
    const maxRank = singularValues.length;
    // 입력 k 목록 정리.
    const kValues = parseKValues(kInput.value, maxRank);
    
    // 정리된 k 값을 다시 입력 필드에 업데이트 (사용자 편의성 향상)
    kInput.value = kValues.join(", ");

    // 전체 energy 계산.
    const totalEnergy = singularValues.reduce((sum, s) => sum + s * s, 0);
    // 원본 parameter 수.
    const originalParams = imageHeight * imageWidth;
    // metric 저장 배열.
    const metrics = [];

    // 각 k 처리 (비동기 루프로 순차적 렌더링 지원)
    for (const k of kValues) {
      LoadingUI.setKText(`Processing k = ${k}`);
      
      // 로그 패널에 구분선 추가
      if (LoadingUI.dataLog) {
        const divider = document.createElement("div");
        divider.textContent = `--- [k = ${k} 계산 시작] ---`;
        divider.style.color = "#00ffbb";
        LoadingUI.dataLog.appendChild(divider);
      }

      // 비동기 단위 복원 (한 줄씩 렌더링 콜백 전달)
      const reconstructed = await reconstructByTruncatedSVDAsync(
        U, singularValues, V, k, imageHeight, imageWidth,
        (y, rowData) => LoadingUI.onRowCalculated(y, rowData)
      );

      // 보존 energy 계산.
      const retainedEnergy = calcRetainedEnergy(singularValues, k, totalEnergy);
      // 상대 error 계산.
      const relativeError = calcRelativeError(grayMatrix, reconstructed);

      // 압축 parameter 수.
      const storedParams = k * (imageHeight + imageWidth + 1);
      // 원본 대비 저장 비율.
      const storedRatio = storedParams / originalParams;
      // 절감 비율.
      const savingRatio = 1 - storedRatio;

      // metric 저장.
      metrics.push({
        k, retainedEnergy, relativeError, storedParams, storedRatio, savingRatio
      });

      // 본문 결과 그리드에 복원 이미지 카드 추가.
      addReconstructionCanvas(k, reconstructed, {
        retainedEnergy, relativeError, storedRatio, savingRatio
      });

      // 렌더링된 화면을 사용자가 볼 수 있도록 살짝 대기
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // singular value 그래프 출력.
    drawSingularValuePlot(singularValues);
    // metric 그래프 출력.
    drawMetricPlot(metrics);
    // metric 표 출력.
    renderMetricTable(metrics, originalParams);

    // 완료 메시지 표시.
    statusDiv.textContent =
      `완료: 행렬 크기 ${imageHeight} x ${imageWidth}, 최대 rank ${maxRank}, 계산한 k = ${kValues.join(", ")}`;
  } catch (error) {
    // 오류 콘솔 출력.
    console.error(error);
    // 오류 메시지 표시.
    statusDiv.textContent = "오류 발생: " + error.message;
  } finally {
    // 버튼 상태 복구.
    updateRunButton();
    // 1초 뒤 로딩 오버레이 숨김 (최종 결과 확인 시간 제공)
    setTimeout(() => {
      LoadingUI.hide();
    }, 1000);
  }
}

// 복원 결과 Canvas 카드 추가 함수.
function addReconstructionCanvas(k, matrix, metric) {
  // 카드 div 생성.
  const card = document.createElement("div");
  // 카드 class 지정.
  card.className = "result-card";

  // 제목 생성.
  const title = document.createElement("h3");
  // 제목 내용 설정.
  title.textContent = `Rank k = ${k}`;

  // Canvas 생성.
  const canvas = document.createElement("canvas");
  // Canvas 너비 설정.
  canvas.width = imageWidth;
  // Canvas 높이 설정.
  canvas.height = imageHeight;

  // 복원 행렬을 Canvas에 그림.
  drawGrayMatrixToCanvas(canvas, matrix);

  // 설명 문단 생성.
  const desc = document.createElement("p");
  // metric 설명 HTML 생성.
  desc.innerHTML =
    `Retained energy: ${(metric.retainedEnergy * 100).toFixed(2)}%<br>` +
    `Relative error: ${(metric.relativeError * 100).toFixed(2)}%<br>` +
    `Stored / Original: ${(metric.storedRatio * 100).toFixed(2)}%`;

  // 제목 추가.
  card.appendChild(title);
  // Canvas 추가.
  card.appendChild(canvas);
  // 설명 추가.
  card.appendChild(desc);
  // 결과 grid에 카드 추가.
  resultGrid.appendChild(card);
}

// grayscale 행렬을 Canvas로 출력.
function drawGrayMatrixToCanvas(canvas, matrix) {
  // Canvas context 얻기.
  const ctx = canvas.getContext("2d");
  // 이미지 data 생성.
  const imageData = ctx.createImageData(canvas.width, canvas.height);

  // 모든 행 순회.
  for (let y = 0; y < canvas.height; y++) {
    // 모든 열 순회.
    for (let x = 0; x < canvas.width; x++) {
      // RGBA 시작 index 계산.
      const idx = (y * canvas.width + x) * 4;
      // 밝기값 제한.
      const gray = clamp(matrix[y][x], 0, 255);

      // R 채널 저장.
      imageData.data[idx] = gray;
      // G 채널 저장.
      imageData.data[idx + 1] = gray;
      // B 채널 저장.
      imageData.data[idx + 2] = gray;
      // Alpha 채널 저장.
      imageData.data[idx + 3] = 255;
    }
  }

  // Canvas에 이미지 출력.
  ctx.putImageData(imageData, 0, 0);
}

// 고해상도(High DPI) 캔버스 설정 함수.
function setupHighDPICanvas(canvas, logicalWidth, logicalHeight) {
  const dpr = window.devicePixelRatio || 1;
  // CSS 논리적 크기 (화면 축소 시 찌그러짐 방지)
  canvas.style.maxWidth = logicalWidth + "px";
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  
  // 실제 픽셀 해상도
  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;
  
  const ctx = canvas.getContext("2d");
  // 스케일 조정
  ctx.scale(dpr, dpr);
  return ctx;
}

// singular value 그래프 출력.
// 마지막 데이터를 저장하여 resize 시 다시 그리기 위한 변수
let _lastSingularValues = null;
let _lastMetrics = null;

function drawSingularValuePlot(singularValues) {
  _lastSingularValues = singularValues;
  
  // 가로로 넓은 그래프 (2:1 비율)
  const w = 600;
  const h = 300;
  // 고해상도 캔버스 설정 및 context 얻기
  const ctx = setupHighDPICanvas(singularCanvas, w, h);
  
  // Canvas 초기화.
  clearCanvas(ctx, w, h);

  // 그래프 여백 설정. 텍스트가 캔버스 밖으로 나가지 않도록 우측과 상단 여백 추가.
  const margin = { left: 72, right: 48, top: 36, bottom: 50 };

  // 그래프 영역 너비.
  const plotW = w - margin.left - margin.right;
  // 그래프 영역 높이.
  const plotH = h - margin.top - margin.bottom;

  // log scale 값 생성.
  const values = singularValues.map(v => Math.log10(v + 1));
  // y축 최대값.
  const maxY = Math.max(...values, 1e-12);
  // x축 최대값 (인덱스 개수).
  const maxX = values.length - 1;

  // Nice Numbers 알고리즘으로 깔끔한 눈금 자동 생성
  const xTicks = generateNiceTicks(0, maxX, 6);
  const yTicks = generateNiceTicks(0, maxY, 5);

  // 축과 눈금 그리기.
  drawAxesWithTicks(ctx, margin, w, h, "Index [i]", "Singular Value [log10(σ + 1)]",
    { min: 0, max: maxX, ticks: xTicks },
    { min: 0, max: maxY, ticks: yTicks }
  );

  // 선 그리기 시작.
  ctx.beginPath();

  // 모든 singular value 순회.
  for (let i = 0; i < values.length; i++) {
    // x 좌표 계산.
    const x = margin.left + (i / Math.max(1, maxX)) * plotW;
    // y 좌표 계산.
    const y = margin.top + plotH - (values[i] / maxY) * plotH;

    // 첫 점 처리.
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  // 선 색상 설정.
  ctx.strokeStyle = "#00ffbb";
  // 선 두께 설정.
  ctx.lineWidth = 2;
  // 선 출력.
  ctx.stroke();
}

// metric 그래프 출력.
function drawMetricPlot(metrics) {
  _lastMetrics = metrics;
  
  // 가로로 넓은 그래프 (2:1 비율)
  const w = 600;
  const h = 300;
  // 고해상도 캔버스 설정 및 context 얻기
  const ctx = setupHighDPICanvas(metricCanvas, w, h);
  
  // Canvas 초기화.
  clearCanvas(ctx, w, h);

  // 그래프 여백 설정. 텍스트가 캔버스 밖으로 나가지 않도록 우측과 상단 여백 추가.
  const margin = { left: 72, right: 48, top: 36, bottom: 50 };

  // 그래프 영역 너비.
  const plotW = w - margin.left - margin.right;
  // 그래프 영역 높이.
  const plotH = h - margin.top - margin.bottom;

  // 최대 k 값.
  const maxK = Math.max(...metrics.map(m => m.k), 1);

  // Nice Numbers 알고리즘으로 깔끔한 눈금 자동 생성
  const xTicks = generateNiceTicks(0, maxK, 6);
  const yTicks = generateNiceTicks(0, 100, 5); // 0~100%

  // 축과 눈금 그리기.
  drawAxesWithTicks(ctx, margin, w, h, "Rank [k]", "Ratio [%]",
    { min: 0, max: maxK, ticks: xTicks },
    { min: 0, max: 100, ticks: yTicks }
  );

  // 라벨 겹침 방지를 위한 기록 배열
  const drawnLabels = [];

  // 겹침 방지 라벨 그리기 함수
  function drawAvoidCollision(text, x, y, color, shiftDir) {
    ctx.fillStyle = color;
    const wText = ctx.measureText(text).width;
    
    // 폰트 크기가 11px이므로 줄간격을 105%로 설정 (11 * 1.05 = 11.55)
    const hText = 11; 
    const shiftAmount = 11.55; 
    
    // shiftDir: 1 (아래로 회피, textBaseline="top"), -1 (위로 회피, textBaseline="bottom")
    ctx.textBaseline = shiftDir === 1 ? "top" : "bottom";
    
    let tryY = shiftDir === 1 ? y + 6 : y - 6;
    let collision = true;
    let attempts = 0;
    
    while(collision && attempts < 15) {
      collision = false;
      const box = {
        left: x - wText/2 - 2,
        right: x + wText/2 + 2,
        top: shiftDir === 1 ? tryY : tryY - hText,
        bottom: shiftDir === 1 ? tryY + hText : tryY
      };
      
      for (const other of drawnLabels) {
        if (!(box.right <= other.left || box.left >= other.right || box.bottom <= other.top || box.top >= other.bottom)) {
          collision = true;
          break;
        }
      }
      
      if (collision) {
        tryY += shiftDir * shiftAmount;
        attempts++;
      }
    }
    
    ctx.fillText(text, x, tryY);
    drawnLabels.push({
      left: x - wText/2 - 2,
      right: x + wText/2 + 2,
      top: shiftDir === 1 ? tryY : tryY - hText,
      bottom: shiftDir === 1 ? tryY + hText : tryY
    });
  }

  // retained energy 실선 그리기.
  ctx.strokeStyle = "#00ffbb";
  ctx.beginPath();
  metrics.forEach((m, idx) => {
    const x = margin.left + (m.k / maxK) * plotW;
    const y = margin.top + plotH - m.retainedEnergy * plotH;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineWidth = 2;
  ctx.stroke();

  // retained energy 점(dot) 및 값 텍스트 표시
  ctx.font = "11px Roboto, Arial";
  ctx.textAlign = "center";
  metrics.forEach(m => {
    const x = margin.left + (m.k / maxK) * plotW;
    const y = margin.top + plotH - m.retainedEnergy * plotH;
    
    // 점 그리기
    ctx.fillStyle = "#00ffbb";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // 겹침 방지 텍스트 (위쪽에 있으므로 아래로 회피: shiftDir = 1)
    drawAvoidCollision(`k=${m.k} (${(m.retainedEnergy * 100).toFixed(1)}%)`, x, y, "#00ffbb", 1);
  });

  // relative error 점선 그리기.
  ctx.strokeStyle = "#ff66b2";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  metrics.forEach((m, idx) => {
    const x = margin.left + (m.k / maxK) * plotW;
    const y = margin.top + plotH - m.relativeError * plotH;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // relative error 점(dot) 및 값 텍스트 표시
  ctx.font = "11px Roboto, Arial";
  ctx.textAlign = "center";
  metrics.forEach(m => {
    const x = margin.left + (m.k / maxK) * plotW;
    const y = margin.top + plotH - m.relativeError * plotH;
    
    // 점 그리기
    ctx.fillStyle = "#ff66b2";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // 겹침 방지 텍스트 (아래쪽에 있으므로 위로 회피: shiftDir = -1)
    drawAvoidCollision(`k=${m.k} (${(m.relativeError * 100).toFixed(1)}%)`, x, y, "#ff66b2", -1);
  });

  // 범례 배경 박스 (우측 상단에 배치하여 데이터 선과 겹침 방지)
  const legendX = w - margin.right - 170;
  const legendY = margin.top + 8;
  const legendW = 160;
  const legendH = 44;
  ctx.fillStyle = "rgba(26, 26, 26, 0.85)";
  ctx.fillRect(legendX, legendY, legendW, legendH);
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX, legendY, legendW, legendH);

  // 범례 글꼴 설정.
  ctx.font = "14px Roboto, Arial";
  
  // retained energy 범례
  ctx.fillStyle = "#00ffbb";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("── retained energy", legendX + 8, legendY + 14);
  
  // relative error 범례
  ctx.fillStyle = "#ff66b2";
  ctx.fillText("╌╌ relative error", legendX + 8, legendY + 32);
}

// 그래프 축과 숫자 눈금 출력 함수.
// xRange/yRange: { min, max, ticks: [숫자 배열] }
function drawAxesWithTicks(ctx, margin, w, h, xLabel, yLabel, xRange, yRange) {
  // 현재 drawing 상태 저장.
  ctx.save();

  // 좌표 기준점
  const x0 = margin.left;
  const y0 = h - margin.bottom;
  const x1 = w - margin.right;
  const y1 = margin.top;

  const plotW = x1 - x0;
  const plotH = y0 - y1;
  const xSpan = xRange.max - xRange.min;
  const ySpan = yRange.max - yRange.min;

  // 배경 grid 그리기 (y축 방향)
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 0.5;
  for (const val of yRange.ticks) {
    const ratio = ySpan > 0 ? (val - yRange.min) / ySpan : 0;
    const y = y0 - ratio * plotH;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }

  // 배경 grid 그리기 (x축 방향)
  for (const val of xRange.ticks) {
    const ratio = xSpan > 0 ? (val - xRange.min) / xSpan : 0;
    const x = x0 + ratio * plotW;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
  }

  // 축 선 그리기
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.stroke();

  // 눈금 숫자 설정
  ctx.fillStyle = "#aaa";
  ctx.font = "13px Roboto, Arial";

  // x축 눈금 숫자 출력
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const val of xRange.ticks) {
    const ratio = xSpan > 0 ? (val - xRange.min) / xSpan : 0;
    const x = x0 + ratio * plotW;

    // 눈금 선(tick)
    ctx.strokeStyle = "#666";
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + 4);
    ctx.stroke();

    // 숫자 (정수면 소수점 생략, 아니면 적절한 자릿수)
    ctx.fillStyle = "#aaa";
    ctx.fillText(formatTickLabel(val), x, y0 + 6);
  }

  // y축 눈금 숫자 출력
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const val of yRange.ticks) {
    const ratio = ySpan > 0 ? (val - yRange.min) / ySpan : 0;
    const y = y0 - ratio * plotH;

    // 눈금 선(tick)
    ctx.strokeStyle = "#666";
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 - 4, y);
    ctx.stroke();

    // 숫자
    ctx.fillStyle = "#aaa";
    ctx.fillText(formatTickLabel(val), x0 - 8, y);
  }

  // x축 라벨
  ctx.fillStyle = "#ccc";
  ctx.font = "15px Roboto, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(xLabel, (x0 + x1) / 2, h - 14);

  // y축 라벨
  ctx.save();
  ctx.translate(16, (y0 + y1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  // drawing 상태 복구.
  ctx.restore();
}

// Nice Numbers 알고리즘: 데이터 범위에 맞춰 깔끔한 눈금 숫자 배열을 생성.
// 예: (0, 42, 5) → [0, 10, 20, 30, 40]
function generateNiceTicks(dataMin, dataMax, targetCount) {
  if (dataMax <= dataMin) return [dataMin];
  
  // 1. 데이터 범위에서 대략적인 간격 계산
  const range = dataMax - dataMin;
  const roughStep = range / Math.max(1, targetCount - 1);
  
  // 2. 이 간격을 "깔끔한 숫자"로 올림 (1, 2, 5, 10, 20, 50, 100...)
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  
  let niceStep;
  if (normalized <= 1) niceStep = 1 * magnitude;
  else if (normalized <= 2) niceStep = 2 * magnitude;
  else if (normalized <= 5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;
  
  // 3. niceStep 간격으로 눈금 배열 생성
  const niceMin = Math.floor(dataMin / niceStep) * niceStep;
  const niceMax = Math.ceil(dataMax / niceStep) * niceStep;
  
  const ticks = [];
  for (let v = niceMin; v <= niceMax + niceStep * 0.01; v += niceStep) {
    // 데이터 범위 안의 눈금만 포함
    if (v >= dataMin - niceStep * 0.01 && v <= dataMax + niceStep * 0.01) {
      ticks.push(Math.round(v * 1e10) / 1e10); // 부동소수점 오차 정리
    }
  }
  
  return ticks;
}

// 눈금 숫자 포맷: 정수면 소수점 없이, 아니면 적절한 자릿수로 표시.
function formatTickLabel(val) {
  if (Number.isInteger(val)) return val.toString();
  // 소수점 이하 불필요한 0 제거 (최대 2자리)
  return parseFloat(val.toFixed(2)).toString();
}

// 창 크기 변경 시 그래프 다시 그리기 (resize 이벤트)
let _resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (_lastSingularValues) drawSingularValuePlot(_lastSingularValues);
    if (_lastMetrics) drawMetricPlot(_lastMetrics);
  }, 200);
});

// Canvas 초기화 함수.
function clearCanvas(ctx, w, h) {
  // 기존 그림 삭제.
  ctx.clearRect(0, 0, w, h);
  // 다크 배경색 설정.
  ctx.fillStyle = "#1a1a1a";
  // 배경 채우기.
  ctx.fillRect(0, 0, w, h);
}

// metric 표 출력 함수.
function renderMetricTable(metrics, originalParams) {
  // 표 HTML 시작.
  let html = `
    <table>
      <thead>
        <tr>
          <th>k</th>
          <th>Retained Energy</th>
          <th>Relative Error</th>
          <th>Stored Params</th>
          <th>Stored&nbsp;/ Original</th>
          <th>Saving Ratio</th>
        </tr>
      </thead>
      <tbody>
  `;

  // metric 행 생성.
  for (const m of metrics) {
    // 한 행 추가.
    html += `
      <tr>
        <td>${m.k}</td>
        <td>${(m.retainedEnergy * 100).toFixed(2)}%</td>
        <td>${(m.relativeError * 100).toFixed(2)}%</td>
        <td>${m.storedParams.toLocaleString()} / ${originalParams.toLocaleString()}</td>
        <td>${(m.storedRatio * 100).toFixed(2)}%</td>
        <td>${(m.savingRatio * 100).toFixed(2)}%</td>
      </tr>
    `;
  }

  // 표 HTML 종료.
  html += `
      </tbody>
    </table>
  `;

  // 표를 화면에 삽입.
  metricTable.innerHTML = html;
}

// 값 제한 함수.
function clamp(value, min, max) {
  // min~max 범위로 제한.
  return Math.max(min, Math.min(max, value));
}

