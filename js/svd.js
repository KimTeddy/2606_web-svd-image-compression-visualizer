// ml-matrix SVD 라이브러리 객체.
let Matrix;
let SVDClass;
// 라이브러리 로드 상태.
let libraryReady = false;

// SVD library 로딩 함수.
async function loadSVDLibrary() {
  try {
    const ML = await import("https://cdn.jsdelivr.net/npm/ml-matrix@6.12.2/+esm");
    const MLDefault = ML.default || {};
    Matrix = ML.Matrix || MLDefault.Matrix;
    SVDClass = ML.SingularValueDecomposition || ML.SVD || MLDefault.SingularValueDecomposition || MLDefault.SVD;

    if (!Matrix || !SVDClass) {
      throw new Error("ml-matrix module에서 Matrix 또는 SVD class를 찾지 못했습니다.");
    }
    libraryReady = true;
    if (typeof updateRunButton === "function") updateRunButton();
    const statusDiv = document.getElementById("status");
    if (statusDiv) statusDiv.textContent = "SVD library 로딩 완료. 이미지를 선택하세요.";
  } catch (error) {
    libraryReady = false;
    if (typeof updateRunButton === "function") updateRunButton();
    console.error(error);
    const statusDiv = document.getElementById("status");
    if (statusDiv) statusDiv.textContent = "오류 발생: SVD library를 불러오지 못했습니다.\n인터넷 연결을 확인하세요.";
  }
}

// k 입력값 파싱 함수.
function parseKValues(text, maxRank) {
  const values = text.split(",").map(v => Number(v.trim())).filter(v => Number.isInteger(v) && v > 0).map(v => Math.min(v, maxRank));
  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.length === 0) throw new Error("k 값을 1개 이상 입력해야 합니다. 예: 5,10,20");
  return unique;
}

// retained energy 계산 함수.
function calcRetainedEnergy(singularValues, k, totalEnergy) {
  let partial = 0;
  for (let i = 0; i < k; i++) partial += singularValues[i] * singularValues[i];
  return partial / totalEnergy;
}

// Frobenius norm 기반 relative error 계산.
function calcRelativeError(original, reconstructed) {
  let numerator = 0;
  let denominator = 0;
  for (let y = 0; y < original.length; y++) {
    for (let x = 0; x < original[0].length; x++) {
      const diff = original[y][x] - reconstructed[y][x];
      numerator += diff * diff;
      denominator += original[y][x] * original[y][x];
    }
  }
  return Math.sqrt(numerator / denominator);
}

// Truncated SVD 비동기 복원 함수 (한 줄씩 콜백 호출)
async function reconstructByTruncatedSVDAsync(U, singularValues, V, k, rows, cols, onRowCalculated) {
  const output = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let value = 0;
      for (let r = 0; r < k; r++) {
        value += U[y][r] * singularValues[r] * V[x][r];
      }
      // 반올림하여 실제 픽셀 숫자(0~255)로 정제
      output[y][x] = Math.max(0, Math.min(255, Math.round(value)));
    }

    // 계산된 현재 행(Row)의 실제 숫자 데이터와 y좌표를 콜백으로 전달
    if (onRowCalculated) {
      await onRowCalculated(y, output[y]);
    }
  }

  return output;
}

// 거듭제곱법(Power Iteration)을 이용한 지배적 특이벡터 탐색 (시각화 전용)
// 무작위 벡터에서 출발하여 가장 중요한 뼈대 이미지로 수렴하는 진짜 수학적 과정을 보여줍니다.
async function simulatePowerIteration(matrix, rows, cols, iterations, onIteration) {
  // v 벡터 랜덤 초기화 (크기: cols)
  let v = new Array(cols);
  let vNormSq = 0;
  for (let i = 0; i < cols; i++) {
    v[i] = Math.random();
    vNormSq += v[i] * v[i];
  }
  const vNorm = Math.sqrt(vNormSq);
  for (let i = 0; i < cols; i++) v[i] /= vNorm;

  let u = new Array(rows);

  for (let iter = 1; iter <= iterations; iter++) {
    // 1. u = A * v 계산
    let uNormSq = 0;
    for (let y = 0; y < rows; y++) {
      let sum = 0;
      for (let x = 0; x < cols; x++) {
        sum += matrix[y][x] * v[x];
      }
      u[y] = sum;
      uNormSq += sum * sum;
    }

    // sigma_1 (가장 큰 특이값) 추정
    const sigma = Math.sqrt(uNormSq);

    // u 정규화
    for (let y = 0; y < rows; y++) {
      u[y] /= sigma;
    }

    // 2. v = A^T * u 계산
    let vNormSqNext = 0;
    for (let x = 0; x < cols; x++) {
      let sum = 0;
      for (let y = 0; y < rows; y++) {
        sum += matrix[y][x] * u[y];
      }
      v[x] = sum;
      vNormSqNext += sum * sum;
    }

    // v 정규화
    const vNormNext = Math.sqrt(vNormSqNext);
    for (let x = 0; x < cols; x++) {
      v[x] /= vNormNext;
    }

    // 3. 콜백 호출 (현재 수렴 중인 Rank-1 뼈대 이미지 생성: sigma * u * v^T)
    if (onIteration) {
      const rank1Matrix = Array.from({ length: rows }, () => new Array(cols));
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          rank1Matrix[y][x] = Math.max(0, Math.min(255, sigma * u[y] * v[x]));
        }
      }
      await onIteration(iter, v, sigma, rank1Matrix);
    }
  }
}
