// js/worker.js
// SVD 연산을 메인 스레드에서 분리하여 프리징을 막는 Web Worker

self.onmessage = async function(e) {
  const { grayMatrix } = e.data;
  
  try {
    // ml-matrix ESM 모듈 동적 로드
    const ML = await import("https://cdn.jsdelivr.net/npm/ml-matrix@6.12.2/+esm");
    const MLDefault = ML.default || {};
    const Matrix = ML.Matrix || MLDefault.Matrix;
    const SVDClass = ML.SingularValueDecomposition || ML.SVD || MLDefault.SingularValueDecomposition || MLDefault.SVD;

    if (!Matrix || !SVDClass) {
      throw new Error("ml-matrix module에서 Matrix 또는 SVD class를 찾지 못했습니다.");
    }

    // 2D 배열을 기반으로 행렬 객체 생성
    const A = new Matrix(grayMatrix);
    
    // 무거운 SVD 계산 시작 (이 작업은 워커 스레드를 블로킹하지만, 메인 UI는 전혀 멈추지 않습니다)
    const svd = new SVDClass(A, { autoTranspose: true });

    // 결과 행렬 객체를 메인 스레드로 넘기기 위해 일반 순수 2D 배열로 변환
    const U = svd.leftSingularVectors.to2DArray();
    const V = svd.rightSingularVectors.to2DArray();
    const singularValues = Array.from(svd.diagonal);

    // 계산 완료 후 결과 전송
    self.postMessage({
      type: "success",
      U: U,
      V: V,
      singularValues: singularValues
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error.message
    });
  }
};
