// ===== Footer 동적 로딩 =====
// 포트폴리오 사이트 기본 URL.
const PORTFOLIO_BASE = "https://kimteddy.github.io";

// footer.html을 포트폴리오에서 가져와 삽입.
fetch(`${PORTFOLIO_BASE}/footer.html`)
  .then(res => {
    // 응답 성공 확인.
    if (!res.ok) throw new Error("footer 로딩 실패");
    // HTML 텍스트 반환.
    return res.text();
  })
  .then(html => {
    // 상대 경로를 절대 경로로 변환.
    const fixedHtml = html.replace(
      /(?:src|href)="(?!https?:\/\/|mailto:)([^"]+)"/g,
      (match, path) => match.replace(path, `${PORTFOLIO_BASE}/${path}`)
    );

    // DOMParser를 사용하여 HTML 구조로 변환
    const parser = new DOMParser();
    const doc = parser.parseFromString(fixedHtml, "text/html");

    // 소셜 링크 컨테이너 내부의 a 태그만 검색하여 화이트리스트 적용
    const links = doc.querySelectorAll(".footer__socials a");
    links.forEach(link => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      // 깃허브, 인스타, 메일(mailto:)만 허용하고 나머지는 모두 제거
      if (
        !href.includes("github.com") && 
        !href.includes("instagram.com") && 
        !href.includes("mailto:")
      ) {
        link.remove();
      }
    });

    // footer 영역에 삽입.
    document.getElementById("footer").innerHTML = doc.body.innerHTML;
  })
  .catch(err => {
    // footer 로딩 실패 시 콘솔 출력.
    console.warn("Footer를 불러오지 못했습니다:", err);
  });
