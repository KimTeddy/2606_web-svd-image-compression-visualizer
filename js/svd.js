// ml-matrix 라이브러리의 Matrix 클래스를 담을 변수.
let Matrix;
// ml-matrix 라이브러리의 SVD 클래스를 담을 변수.
let SVDClass;
// 라이브러리가 성공적으로 로드되었는지 여부를 추적하는 변수.
let libraryReady = false;

// SVD 연산을 위한 외부 라이브러리(ml-matrix)를 비동기로 불러오는 함수.
async function loadSVDLibrary() {
  try {
    // CDN을 통해 ml-matrix 라이브러리를 동적으로 가져옴.
    const ML = await import("https://cdn.jsdelivr.net/npm/ml-matrix@6.12.2/+esm");
    // 라이브러리의 기본 모듈을 가져오거나 빈 객체로 안전하게 처리.
    const MLDefault = ML.default || {};
    
    // Matrix 객체를 찾아 할당 (버전별 구조 차이 대응).
    Matrix = ML.Matrix || MLDefault.Matrix;
    // SVD 객체를 찾아 할당 (SingularValueDecomposition 또는 SVD 이름 지원).
    SVDClass = ML.SingularValueDecomposition || ML.SVD || MLDefault.SingularValueDecomposition || MLDefault.SVD;

    // 객체를 정상적으로 불러오지 못했다면 강제로 에러 발생시킴.
    if (!Matrix || !SVDClass) {
      throw new Error("ml-matrix module에서 Matrix 또는 SVD class를 찾지 못했습니다.");
    }
    
    // 라이브러리 로딩 성공 상태로 변경.
    libraryReady = true;
    
    // UI의 '실행' 버튼 상태를 갱신해주는 함수가 있다면 호출.
    if (typeof updateRunButton === "function") updateRunButton();
    
    // 화면에 성공 메시지를 띄움.
    const statusDiv = document.getElementById("status");
    if (statusDiv) statusDiv.textContent = "SVD library 로딩 완료. 이미지를 선택하세요.";
  } catch (error) {
    // 로딩에 실패하면 준비 상태를 false로 설정.
    libraryReady = false;
    
    // UI 버튼 상태 갱신.
    if (typeof updateRunButton === "function") updateRunButton();
    
    // 콘솔에 에러 로그 출력.
    console.error(error);
    
    // 화면에 실패 메시지와 해결책(인터넷 연결 등)을 표시.
    const statusDiv = document.getElementById("status");
    if (statusDiv) statusDiv.textContent = "오류 발생: SVD library를 불러오지 못했습니다.\n인터넷 연결을 확인하세요.";
  }
}

// 사용자가 입력한 여러 k 값들을 숫자로 변환하고 정리하는 함수.
function parseKValues(text, maxRank) {
  // 1. 쉼표(,)를 기준으로 자름.
  // 2. 앞뒤 공백 제거 후 숫자로 변환.
  // 3. 정수이면서 0보다 큰(양수) 유효한 값만 남김.
  // 4. 행렬의 최대 Rank 범위를 넘지 않도록 최대값을 제한함.
  const values = text.split(",")
    .map(v => Number(v.trim()))
    .filter(v => Number.isInteger(v) && v > 0)
    .map(v => Math.min(v, maxRank));
    
  // 중복된 값을 없애기 위해 Set을 사용하고, 오름차순으로 정렬함.
  const unique = [...new Set(values)].sort((a, b) => a - b);
  
  // 유효한 k 값이 하나도 없다면 에러를 발생시켜 사용자에게 알림.
  if (unique.length === 0) throw new Error("k 값을 1개 이상 입력해야 합니다. 예: 5,10,20");
  
  // 정리된 k 값 배열 반환.
  return unique;
}

// 상위 k개의 특이값만 사용했을 때 원본 에너지가 얼마나 보존되는지 계산하는 함수.
function calcRetainedEnergy(singularValues, k, totalEnergy) {
  let partial = 0;
  // 선택된 k개의 특이값들의 제곱합을 구함.
  for (let i = 0; i < k; i++) partial += singularValues[i] * singularValues[i];
  
  // 전체 에너지 대비 현재 계산된 에너지의 비율을 반환 (0 ~ 1 사이 값).
  return partial / totalEnergy;
}

// 복원된 행렬이 원본 행렬과 얼마나 차이나는지(상대 오차율) 계산하는 함수 (Frobenius norm 기준).
function calcRelativeError(original, reconstructed) {
  // 오차 행렬(diff)의 제곱합.
  let numerator = 0;
  // 원본 행렬의 제곱합.
  let denominator = 0;
  
  // 이미지의 모든 픽셀 좌표(행/열)를 순회.
  for (let y = 0; y < original.length; y++) {
    for (let x = 0; x < original[0].length; x++) {
      // 원본과 복원값의 차이 계산.
      const diff = original[y][x] - reconstructed[y][x];
      // 분자(numerator)에 오차의 제곱 누적.
      numerator += diff * diff;
      // 분모(denominator)에 원본 값의 제곱 누적.
      denominator += original[y][x] * original[y][x];
    }
  }
  
  // 루트를 씌워 최종적인 상대적 에러(비율)를 반환.
  return Math.sqrt(numerator / denominator);
}

// Truncated SVD(절단된 특이값 분해) 공식을 통해 행렬(이미지)을 비동기 방식으로 복원하는 함수.
// 무거운 연산을 진행하면서 브라우저 화면(UI)이 멈추지 않도록 한 줄씩 콜백(onRowCalculated)으로 렌더링을 지원함.
async function reconstructByTruncatedSVDAsync(U, singularValues, V, k, rows, cols, onRowCalculated) {
  // 복원된 이미지 픽셀이 들어갈 2차원 배열을 0으로 꽉 채워 초기화.
  const output = Array.from({ length: rows }, () => Array(cols).fill(0));

  // 원본 이미지의 모든 줄(행, y)을 순회.
  for (let y = 0; y < rows; y++) {
    // 원본 이미지의 모든 칸(열, x)을 순회.
    for (let x = 0; x < cols; x++) {
      let value = 0;
      // 상위 k개의 주요 정보만 추출해서 곱셈 (U * Sigma * V^T 공식 적용).
      for (let r = 0; r < k; r++) {
        value += U[y][r] * singularValues[r] * V[x][r];
      }
      // 계산된 실수값을 반올림하고, 색상 값 범위인 0부터 255 사이로 안전하게 정제.
      output[y][x] = Math.max(0, Math.min(255, Math.round(value)));
    }

    // 한 줄(row)의 연산이 끝날 때마다 UI에 이 데이터를 즉시 전달해 그려주도록 콜백 함수 실행.
    if (onRowCalculated) {
      await onRowCalculated(y, output[y]);
    }
  }

  // 최종 복원된 전체 이미지 행렬 반환.
  return output;
}

// 거듭제곱법(Power Iteration)을 이용해 가장 지배적인 뼈대(Rank-1) 특이벡터를 찾아가는 과정을 시뮬레이션.
// 수학적으로 SVD가 어떻게 동작하는지 사용자가 눈으로 쉽게 이해할 수 있도록 시각화 전용으로 구현된 함수.
async function simulatePowerIteration(matrix, rows, cols, iterations, onIteration) {
  // 처음에는 아무 패턴이나 가진 무작위 벡터 v를 생성 (길이는 이미지의 가로 너비).
  let v = new Array(cols);
  let vNormSq = 0;
  for (let i = 0; i < cols; i++) {
    // 0~1 사이의 난수로 초기화.
    v[i] = Math.random();
    // 나중에 벡터 길이를 1로 만들기 위해 제곱합 누적.
    vNormSq += v[i] * v[i];
  }
  
  // v 벡터 정규화 (길이를 1로 맞춤).
  const vNorm = Math.sqrt(vNormSq);
  for (let i = 0; i < cols; i++) v[i] /= vNorm;

  // 출력 벡터 u 초기화용 배열 (길이는 이미지의 세로 높이).
  let u = new Array(rows);

  // 지정된 횟수(iterations)만큼 거듭제곱법 반복 수행.
  for (let iter = 1; iter <= iterations; iter++) {
    
    // [1단계] u = 행렬A * v 행렬 곱셈 계산 (이미지에 벡터 투영).
    let uNormSq = 0;
    for (let y = 0; y < rows; y++) {
      let sum = 0;
      for (let x = 0; x < cols; x++) {
        sum += matrix[y][x] * v[x];
      }
      u[y] = sum;
      uNormSq += sum * sum;
    }

    // 지금 찾은 이 u 벡터의 길이가 곧 가장 큰 특이값(sigma_1)으로 수렴함.
    const sigma = Math.sqrt(uNormSq);

    // 구한 길이(sigma)로 나누어 u 벡터 정규화 (길이 1).
    for (let y = 0; y < rows; y++) {
      u[y] /= sigma;
    }

    // [2단계] 다시 v = 행렬A^T(전치행렬) * u 행렬 곱셈 계산 (반대로 투영).
    let vNormSqNext = 0;
    for (let x = 0; x < cols; x++) {
      let sum = 0;
      for (let y = 0; y < rows; y++) {
        sum += matrix[y][x] * u[y];
      }
      v[x] = sum;
      vNormSqNext += sum * sum;
    }

    // 구한 v 벡터를 다시 정규화 (길이 1).
    const vNormNext = Math.sqrt(vNormSqNext);
    for (let x = 0; x < cols; x++) {
      v[x] /= vNormNext;
    }

    // [3단계] 이 회차에서 얻어낸 sigma * u * v^T (Rank-1 근사 행렬)을 시각화 UI에 콜백으로 던짐.
    if (onIteration) {
      // 그리기 좋도록 2차원 배열 구조로 새로 만듦.
      const rank1Matrix = Array.from({ length: rows }, () => new Array(cols));
      
      // 행/열 곱셈 전개.
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          // 값의 범위를 픽셀 색상값(0~255)에 맞춤.
          rank1Matrix[y][x] = Math.max(0, Math.min(255, sigma * u[y] * v[x]));
        }
      }
      
      // UI를 업데이트할 시간을 주며 다음 과정 진행.
      await onIteration(iter, v, sigma, rank1Matrix);
    }
  }
}
