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

// 기본 이미지(svd_icon.png) 자동 로드
try {
  sourceImage = await loadImageFromUrl("svd_icon.png");
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
    alert(`최대 크기는 ${maxAllowed}px까지 설정할 수 있습니다. ${maxAllowed}px로 조정합니다.`);
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

// 숫자 입력 변경 이벤트 등록.
maxSizeInput.addEventListener("change", () => {
  // 입력값 검증 및 슬라이더 동기화.
  validateAndSyncMaxSize("input");
  // 이미지 없으면 종료.
  if (!sourceImage) return;
  // 새 크기로 행렬 재생성.
  drawInputImageAndMakeMatrix();
  // 복원 결과 삭제.
  resultGrid.innerHTML = "";
  // 표 삭제.
  metricTable.innerHTML = "";
  // singular 그래프 삭제.
  clearCanvas(singularCanvas.getContext("2d"), singularCanvas);
  // metric 그래프 삭제.
  clearCanvas(metricCanvas.getContext("2d"), metricCanvas);
  // 사용자 안내 표시.
  statusDiv.textContent = "이미지 크기를 다시 적용했습니다. SVD 실행 버튼을 누르세요.";
});

// 슬라이더 조작 중(실시간) 이벤트 등록.
maxSizeSlider.addEventListener("input", () => {
  // 슬라이더 값을 숫자 입력에 동기화.
  maxSizeInput.value = maxSizeSlider.value;
  // 이미지 없으면 종료.
  if (!sourceImage) return;
  
  // 실시간으로 새 크기로 행렬 재생성 및 화면 갱신.
  drawInputImageAndMakeMatrix();
  // 복원 결과 삭제.
  resultGrid.innerHTML = "";
  // 표 삭제.
  metricTable.innerHTML = "";
  // singular 그래프 삭제.
  clearCanvas(singularCanvas.getContext("2d"), singularCanvas);
  // metric 그래프 삭제.
  clearCanvas(metricCanvas.getContext("2d"), metricCanvas);
  // 사용자 안내 표시.
  statusDiv.textContent = "이미지 크기를 다시 적용했습니다. SVD 실행 버튼을 누르세요.";
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
    // JS 배열을 Matrix로 변환.
    const A = new Matrix(grayMatrix);
    
    // SVD 계산 시작 전, 수학적 과정을 시각적으로 보여주기 위한 Power Iteration 실행 (약 15회 반복)
    LoadingUI.setStatus("행렬 분석 중 (지배적 특이벡터 탐색)...");
    await simulatePowerIteration(grayMatrix, imageHeight, imageWidth, 15, async (iter, v, sigma, rank1Matrix) => {
      await LoadingUI.onDecompIteration(iter, v, sigma, rank1Matrix);
    });

    // 진짜 연산 과정을 충분히 보여준 후, 전체 행렬 분해(Decomposition)를 백그라운드에서 한 번에 완료합니다.
    LoadingUI.setStatus("전체 특이값 분해(SVD) 완료 중...");
    await new Promise(resolve => setTimeout(resolve, 50)); // 렌더링 갱신 양보
    // SVD 계산. (여기서 무거운 연산 발생)
    const svd = new SVDClass(A, { autoTranspose: true });

    // ① U = svd.leftSingularVectors
    const U = svd.leftSingularVectors;
    const V = svd.rightSingularVectors;
    const singularValues = svd.diagonal;

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
function drawSingularValuePlot(singularValues) {
  let w = 520;
  let h = 280;
  // 원본 이미지 비율에 맞춰 그래프 비율 조정
  if (typeof sourceImage !== 'undefined' && sourceImage && sourceImage.width > 0) {
    const ratio = sourceImage.width / sourceImage.height;
    if (ratio >= 1) {
      w = 520;
      h = Math.round(520 / ratio);
    } else {
      h = 520;
      w = Math.round(520 * ratio);
    }
    // 너무 찌그러지지 않도록 최소 크기 제한
    w = Math.max(300, w);
    h = Math.max(200, h);
  }
  // 고해상도 캔버스 설정 및 context 얻기
  const ctx = setupHighDPICanvas(singularCanvas, w, h);
  
  // Canvas 초기화.
  clearCanvas(ctx, w, h);

  // 그래프 여백 설정. 좌측 여백을 64로 늘려서 긴 텍스트 잘림 방지.
  const margin = { left: 64, right: 20, top: 20, bottom: 42 };

  // 그래프 영역 너비.
  const plotW = w - margin.left - margin.right;
  // 그래프 영역 높이.
  const plotH = h - margin.top - margin.bottom;

  // log scale 값 생성.
  const values = singularValues.map(v => Math.log10(v + 1));
  // y축 최대값.
  const maxY = Math.max(...values, 1e-12);

  // 축 그리기.
  drawAxes(ctx, margin, w, h, "Index [i]", "Singular Value [log10(σ + 1)]", "#1a1a1a");

  // 선 그리기 시작.
  ctx.beginPath();

  // 모든 singular value 순회.
  for (let i = 0; i < values.length; i++) {
    // x 좌표 계산.
    const x = margin.left + (i / Math.max(1, values.length - 1)) * plotW;
    // y 좌표 계산.
    const y = margin.top + plotH - (values[i] / maxY) * plotH;

    // 첫 점 처리.
    if (i === 0) {
      // 시작점 이동.
      ctx.moveTo(x, y);
    } else {
      // 다음 점 연결.
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
  let w = 520;
  let h = 280;
  // 원본 이미지 비율에 맞춰 그래프 비율 조정
  if (typeof sourceImage !== 'undefined' && sourceImage && sourceImage.width > 0) {
    const ratio = sourceImage.width / sourceImage.height;
    if (ratio >= 1) {
      w = 520;
      h = Math.round(520 / ratio);
    } else {
      h = 520;
      w = Math.round(520 * ratio);
    }
    // 너무 찌그러지지 않도록 최소 크기 제한
    w = Math.max(300, w);
    h = Math.max(200, h);
  }
  // 고해상도 캔버스 설정 및 context 얻기
  const ctx = setupHighDPICanvas(metricCanvas, w, h);
  
  // Canvas 초기화.
  clearCanvas(ctx, w, h);

  // 그래프 여백 설정. 좌측 여백 64.
  const margin = { left: 64, right: 20, top: 20, bottom: 42 };

  // 그래프 영역 너비.
  const plotW = w - margin.left - margin.right;
  // 그래프 영역 높이.
  const plotH = h - margin.top - margin.bottom;

  // 최대 k 값.
  const maxK = Math.max(...metrics.map(m => m.k), 1);

  // 축 그리기.
  drawAxes(ctx, margin, w, h, "Rank [k]", "Ratio [%]", "#1a1a1a");

  // 실선 색상 설정.
  ctx.strokeStyle = "#00ffbb";
  // 실선 시작.
  ctx.beginPath();
  // retained energy 점 순회.
  metrics.forEach((m, idx) => {
    // x 좌표 계산.
    const x = margin.left + (m.k / maxK) * plotW;
    // y 좌표 계산.
    const y = margin.top + plotH - m.retainedEnergy * plotH;

    // 첫 점 처리.
    if (idx === 0) ctx.moveTo(x, y);
    // 나머지 점 연결.
    else ctx.lineTo(x, y);
  });
  // 선 두께 설정.
  ctx.lineWidth = 2;
  // retained energy 선 출력.
  ctx.stroke();

  // 점선 색상 설정.
  ctx.strokeStyle = "#60ffc2";
  // 점선 패턴 설정.
  ctx.setLineDash([5, 5]);
  // 점선 시작.
  ctx.beginPath();
  // relative error 점 순회.
  metrics.forEach((m, idx) => {
    // x 좌표 계산.
    const x = margin.left + (m.k / maxK) * plotW;
    // y 좌표 계산.
    const y = margin.top + plotH - m.relativeError * plotH;

    // 첫 점 처리.
    if (idx === 0) ctx.moveTo(x, y);
    // 나머지 점 연결.
    else ctx.lineTo(x, y);
  });
  // relative error 선 출력.
  ctx.stroke();
  // 점선 해제.
  ctx.setLineDash([]);

  // 범례 글꼴 설정.
  ctx.font = "13px Roboto, Arial";
  
  // retained energy 범례 색상 설정 (그래프 실선 색상과 동일)
  ctx.fillStyle = "#00ffbb";
  ctx.fillText("── retained energy", margin.left + 12, margin.top + 18);
  
  // relative error 범례 색상 설정 (그래프 점선 색상과 동일)
  ctx.fillStyle = "#60ffc2";
  ctx.fillText("╌╌ relative error", margin.left + 12, margin.top + 36);
}

// 그래프 축 출력 함수.
function drawAxes(ctx, margin, w, h, xLabel, yLabel, bgColor) {
  // 배경색이 지정되면 배경 채우기.
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
  }

  // 현재 drawing 상태 저장.
  ctx.save();

  // 축 선 색상.
  ctx.strokeStyle = "#555";
  // 글자 색상.
  ctx.fillStyle = "#ccc";
  // 축 선 두께.
  ctx.lineWidth = 1;

  // x축 시작 x.
  const x0 = margin.left;
  // x축 y 위치.
  const y0 = h - margin.bottom;
  // x축 끝 x.
  const x1 = w - margin.right;
  // y축 끝 y.
  const y1 = margin.top;

  // 축 path 시작.
  ctx.beginPath();
  // x축 시작점.
  ctx.moveTo(x0, y0);
  // x축 끝점.
  ctx.lineTo(x1, y0);
  // y축 시작점.
  ctx.moveTo(x0, y0);
  // y축 끝점.
  ctx.lineTo(x0, y1);
  // 축 출력.
  ctx.stroke();

  // 텍스트 정렬 설정 (가운데 정렬)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 라벨 글꼴.
  ctx.font = "13px Roboto, Arial";
  // x축 라벨 출력.
  ctx.fillText(xLabel, (x0 + x1) / 2, h - 16);

  // 회전 상태 저장.
  ctx.save();
  // y축 라벨 위치 이동 (마진 정중앙)
  ctx.translate(margin.left / 2 - 4, (y0 + y1) / 2);
  // y축 라벨 회전.
  ctx.rotate(-Math.PI / 2);
  // y축 라벨 출력.
  ctx.fillText(yLabel, 0, 0);
  // 회전 상태 복구.
  ctx.restore();

  // grid 선 색상.
  ctx.strokeStyle = "#333";
  // grid 4개 출력.
  for (let i = 1; i <= 4; i++) {
    // grid y 좌표.
    const y = y0 - ((y0 - y1) * i) / 4;
    // grid path 시작.
    ctx.beginPath();
    // grid 시작점.
    ctx.moveTo(x0, y);
    // grid 끝점.
    ctx.lineTo(x1, y);
    // grid 출력.
    ctx.stroke();
  }

  // drawing 상태 복구.
  ctx.restore();
}

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
          <th>Stored / Original</th>
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

