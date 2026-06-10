# Web-based SVD Image Compression Visualizer

브라우저에서 이미지를 업로드하고, SVD(Singular Value Decomposition)를 이용해 이미지의 low-rank approximation 결과를 시각화하는 웹 애플리케이션입니다.

이 프로젝트는 선형시스템 과제의 **[옵션 1] SVD의 핵심 원리 구현과 시각화**를 위해 제작되었습니다.

## 프로젝트 개요

SVD는 임의의 행렬 \(A\)를 다음과 같이 분해하는 방법입니다.

\[
A = U \Sigma V^T
\]

이미지는 각 픽셀의 밝기값을 원소로 갖는 행렬로 볼 수 있습니다.  
본 프로젝트에서는 이미지를 grayscale 행렬 \(A\)로 변환한 뒤, SVD를 수행하고 상위 \(k\)개의 singular value만 사용하여 이미지를 복원합니다.

이를 통해 \(k\)값에 따라 이미지 품질, 데이터 압축률, 정보 손실률이 어떻게 달라지는지 확인할 수 있습니다.

## 주요 기능

- 이미지 파일 업로드
- Canvas API를 이용한 이미지 표시
- RGB 이미지를 grayscale 행렬로 변환
- JavaScript 기반 SVD 계산
- Truncated SVD를 이용한 rank-\(k\) 이미지 복원
- \(k\)값 변화에 따른 복원 이미지 비교
- Singular value spectrum 시각화
- Retained energy 계산
- Relative error 계산
- 압축 저장량과 원본 저장량 비교

## 사용 기술

- HTML
- CSS
- JavaScript
- Canvas API
- ml-matrix SVD library

## 실행 방법

### 1. 온라인 실행 (추천)
별도의 설치나 파일 다운로드 없이 아래 링크에서 바로 실행해 보실 수 있습니다.
👉 **[GitHub Pages에서 바로 실행하기](https://kimteddy.github.io/2606_web-svd-image-compression-visualizer/)**

### 2. 로컬에서 실행
1. 저장소를 다운로드하거나 clone합니다.
2. 로컬 웹 서버(예: Live Server, python http.server 등)를 실행하여 브라우저로 접속합니다.  
   *(주의: ES Module 스크립트(`js/app.js`)를 사용하므로 `index.html`을 단순히 더블클릭해서 열면 CORS 보안 정책으로 인해 실행되지 않을 수 있습니다.)*

## 사용 예시

기본 \(k\)값은 다음과 같이 설정할 수 있습니다.

```text
5, 10, 20, 40, 80
```

\(k\)가 작을수록 적은 수의 singular value만 사용하므로 압축률은 높지만 세부 정보가 많이 손실됩니다.  
반대로 \(k\)가 커질수록 원본 이미지와 유사하게 복원되지만 저장해야 하는 parameter 수가 증가합니다.

## 계산 방식

### 1. Grayscale 변환

업로드한 이미지는 Canvas API를 통해 픽셀 단위로 읽어옵니다.  
각 RGB 값은 다음 식을 이용해 grayscale 값으로 변환됩니다.

\[
gray = 0.299R + 0.587G + 0.114B
\]

이렇게 얻은 grayscale 값들을 이용해 이미지 행렬 \(A\)를 구성합니다.

### 2. SVD 분해

이미지 행렬 \(A\)에 대해 SVD를 수행합니다.

\[
A = U \Sigma V^T
\]

여기서 \(\Sigma\)의 대각 원소인 singular value는 이미지 정보의 중요도를 나타냅니다.  
큰 singular value일수록 이미지의 주요 구조를 더 많이 포함합니다.

### 3. Truncated SVD 복원

상위 \(k\)개의 singular value만 사용하여 다음과 같이 이미지를 복원합니다.

\[
A_k = U_k \Sigma_k V_k^T
\]

\(A_k\)는 원본 행렬 \(A\)의 rank-\(k\) approximation입니다.

### 4. Retained Energy

상위 \(k\)개의 singular value가 전체 정보 중 얼마나 많은 비율을 보존하는지 계산합니다.

\[
Retained\ Energy = \frac{\sum_{i=1}^{k}\sigma_i^2}{\sum_i \sigma_i^2}
\]

### 5. Relative Error

복원 행렬과 원본 행렬의 차이는 Frobenius norm 기준으로 계산합니다.

\[
Relative\ Error = \frac{\|A - A_k\|_F}{\|A\|_F}
\]

본 구현에서는 retained energy와의 관계를 이용하여 다음과 같이 계산합니다.

\[
Relative\ Error = \sqrt{1 - Retained\ Energy}
\]

### 6. 압축률 계산

원본 이미지는 \(m \times n\)개의 grayscale 값을 저장한다고 볼 수 있습니다.

\[
Original\ Parameters = mn
\]

Truncated SVD에서는 \(U_k\), \(\Sigma_k\), \(V_k\)를 저장한다고 보고 다음과 같이 parameter 수를 계산합니다.

\[
Compressed\ Parameters = k(m+n+1)
\]

따라서 저장 비율은 다음과 같습니다.

\[
Stored\ Ratio = \frac{k(m+n+1)}{mn}
\]

## 결과 해석

\(k\)가 작은 경우 이미지의 큰 윤곽과 밝기 구조는 유지되지만, edge와 texture 같은 세부 정보는 흐려집니다.  
\(k\)가 증가할수록 더 많은 singular value를 사용하므로 복원 품질은 향상됩니다.

하지만 \(k\)가 커질수록 저장해야 하는 parameter 수도 증가합니다.  
따라서 SVD 기반 이미지 압축에서는 **복원 품질과 압축률 사이의 trade-off**가 발생합니다.

## 주의 사항

SVD 계산은 행렬 크기가 커질수록 연산량이 빠르게 증가합니다.  
브라우저에서 실행하는 프로젝트이므로 이미지 최대 크기는 120~160 px 정도로 설정하는 것을 권장합니다.

## 과제 관련 설명

이 프로젝트는 SVD의 수학적 의미와 low-rank approximation의 효과를 직접 확인하기 위해 제작되었습니다.  
SVD 계산 자체는 JavaScript SVD library를 사용하였고, 이미지 행렬 생성, truncated SVD 복원, retained energy, relative error, 압축률 계산 및 시각화는 JavaScript로 구현하였습니다.

## 사용 도구 및 AI 활용 고지

본 프로젝트는 HTML, CSS, JavaScript와 ml-matrix library를 사용하여 구현하였습니다.  
코드 구조 설계, 주석 작성, README 작성 과정에서 ChatGPT의 도움을 받았습니다.  
최종 코드 실행 결과와 수치 분석은 작성자가 직접 브라우저에서 확인하였습니다.

## License

이 프로젝트는 학습 및 과제 제출 목적으로 작성되었습니다.
