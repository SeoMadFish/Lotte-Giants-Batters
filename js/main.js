// 전역 데이터 저장소
window.allDataGlobal = [];   // batterAverage.json 등 타율 데이터를 저장할 배열
window.playerProfiles = {};   // playerProfiles.json에서 불러온 선수 프로필을 저장할 객체

document.addEventListener("DOMContentLoaded", () => {
  // 페이지 로드 시 두 개의 JSON 파일을 동시에 불러옴
  Promise.all([
    d3.json("data/batterAverage.json"),   // 타율 및 상황별 데이터
    d3.json("data/playerProfiles.json")   // 선수 프로필(이미지, 생년월일, stats, directions 등)
  ]).then(datasets => {
    const batterData = datasets[0];
    const playerProfilesData = datasets[1];

    // batterData를 전역 배열에 삽입
    batterData.forEach(d => allDataGlobal.push(d));
    // playerProfilesData를 전역 객체에 병합
    Object.assign(playerProfiles, playerProfilesData);

    // 드롭다운 초기화: 선수, 시나리오 유형, 시나리오 값 순서로 셋업
    initializePlayerDropdown(allDataGlobal);
    initializeScenarioCategoryDropdown();
    initializeScenarioValueDropdown(allDataGlobal, null, null);

    clearProfile();              // 프로필 패널 초기화
    createHeatmapContainer_v2(); // 히트맵 그리드 초기 생성

    // 팬 차트(부채꼴) 초기 상태: 야구장+양쪽 마스코트만 그림
    const svg = d3.select("#fan-chart");
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    drawFanChartBaseBackground(svg, width, height);

  }).catch(err => console.error("데이터 로드 중 오류:", err));

  // 선수 선택 드롭다운 변경 시 이벤트 핸들러
  d3.select("#player-select").on("change", function () {
    const player = d3.select(this).property("value");

    // 초기 상태(선수 미선택 또는 “–” 선택)일 경우
    if (!player || player === "–") {
      clearProfile();

      // 팬 차트 초기 상태로 리셋
      const svg = d3.select("#fan-chart");
      svg.selectAll("*").remove();
      const width = +svg.attr("width");
      const height = +svg.attr("height");
      drawFanChartBaseBackground(svg, width, height);

      // 히트맵 셀 제거
      d3.select("#heatmap-container svg #heatmap-group-v2").selectAll("g.cell-group").remove();
      // 시나리오 값 드롭다운 초기화
      d3.select("#scenario-category-select").property("value", "–");
      initializeScenarioValueDropdown(allDataGlobal, null, null);
      return;
    }

    showPlayerInfo(player);  // 선택된 선수 프로필 출력

    // 선수 프로필에 directions 배열이 있으면 부채꼴 차트 그리기
    if (playerProfiles[player] && Array.isArray(playerProfiles[player].directions)) {
      const directions = playerProfiles[player].directions;
      const batThrow = playerProfiles[player].batThrow;
      drawScaledBaseballFanOverlay(directions, player);
    } else {
      // directions가 없으면 팬 차트 초기 상태로 리셋
      const svg = d3.select("#fan-chart");
      svg.selectAll("*").remove();
      const width = +svg.attr("width");
      const height = +svg.attr("height");
      drawFanChartBaseBackground(svg, width, height);
    }

    // 시나리오 유형에 따라 시나리오 값 드롭다운 갱신
    const cat = d3.select("#scenario-category-select").property("value");
    if (cat && cat !== "–") {
      initializeScenarioValueDropdown(allDataGlobal, player, cat);
    } else {
      initializeScenarioValueDropdown(allDataGlobal, player, null);
    }

    // 히트맵 셀 제거 및 시나리오 드롭다운 리셋
    d3.select("#heatmap-container svg #heatmap-group-v2").selectAll("g.cell-group").remove();
    d3.select("#scenario-category-select").property("value", "–");
    initializeScenarioValueDropdown(allDataGlobal, null, null);

    // 레이더 모드일 경우 자동으로 레이더 차트 갱신
    const radar = document.getElementById("radar-container");
    const button = document.getElementById("apply-scenario-btn");
    if (button.textContent === "히트맵") {
      radar.innerHTML = "";      // 기존 레이더 차트 제거
      drawRadarChart(player);    // 새 레이더 차트 그리기
    }
  });

  // 시나리오 유형 변경 시 이벤트 핸들러
  d3.select("#scenario-category-select").on("change", function () {
    const category = d3.select(this).property("value");
    const player = d3.select("#player-select").property("value");

    if (!player || player === "–") {
      alert("⚠️ 타자를 먼저 선택해주세요. ⚠️");
      d3.select(this).property("value", "–");
      initializeScenarioValueDropdown(allDataGlobal, null, null);
      return;
    }

    // 선택된 선수와 카테고리로 시나리오 값 드롭다운 갱신
    initializeScenarioValueDropdown(allDataGlobal, player, category);

    // “전체” 선택 시, 히트맵 전체 데이터로 즉시 그림
    if (category === "전체") {
      drawHeatmap_v2(allDataGlobal, player, "전체", "전체");
    } else {
      // 그 외 카테고리 선택 시, 히트맵 셀만 제거(그리드는 유지)
      d3.select("#heatmap-container svg #heatmap-group-v2").selectAll("g.cell-group").remove();
    }
  });

  // 시나리오 값 변경 시 이벤트 핸들러
  d3.select("#scenario-value-select").on("change", function () {
    const value = d3.select(this).property("value");
    const category = d3.select("#scenario-category-select").property("value");
    const player = d3.select("#player-select").property("value");

    // 선수, 카테고리, 값이 모두 유효할 때만 히트맵 그림
    if (!player || player === "–" || !category || category === "–" || !value) {
      d3.select("#heatmap-container svg #heatmap-group-v2").selectAll("g.cell-group").remove();
      return;
    }
    drawHeatmap_v2(allDataGlobal, player, category, value);
  });
});

// 히트맵 ↔ 레이더 모드 토글 버튼 클릭 핸들러
document.getElementById("apply-scenario-btn").addEventListener("click", () => {
  const player = document.getElementById("player-select").value;
  if (!player || player === "–") {
    alert("⚠️ 타자를 먼저 선택해주세요. ⚠️");
    return;
  }

  const heatmap = document.getElementById("heatmap-container");
  const radar = document.getElementById("radar-container");
  const button = document.getElementById("apply-scenario-btn");

  if (button.textContent === "상세") {
    // 히트맵 숨기고 레이더 보이기
    heatmap.style.display = "none";
    radar.style.display = "block";
    radar.innerHTML = "";        // 기존 레이더 차트 제거
    drawRadarChart(player);           // 새 레이더 차트 그리기
    button.textContent = "히트맵";
  } else {
    // 레이더 숨기고 히트맵 보이기
    radar.style.display = "none";
    heatmap.style.display = "block";
    button.textContent = "상세";
  }
});

/* ─────────────────────────────── 왼쪽: 프로필 패널 ─────────────────────────────── */
/**
 * 함수명: clearProfile
 * 설명  : 프로필 영역을 초기화하여 “선수를 선택해주세요.” 메시지를 표시합니다.
 */
function clearProfile() {
  d3.select("#profile-panel").html(
    '<p style="font-size:24px; color:#555; text-align:center; margin-top: 320px;">선수를 선택해주세요.</p>'
  );
}

/**
 * 함수명: showPlayerInfo
 * 설명  : 왼쪽 프로필 패널에 선택된 선수의 프로필 정보를 렌더링합니다.
 * 매개변수:
 *   - playerName: 표시할 선수 이름
 */
function showPlayerInfo(playerName) {
  const panel = d3.select("#profile-panel");
  panel.html("");

  const info = playerProfiles[playerName];
  if (!info) {
    panel.append("p")
      .style("text-align", "center")
      .style("color", "#555")
      .text("해당 선수의 정보를 찾을 수 없습니다.");
    return;
  }

  // 프로필 사진 삽입
  panel.append("img")
    .attr("src", info.image)
    .attr("alt", playerName + " 프로필 사진");

  // 표시할 필드 목록과 값
  const fields = [
    { label: "생년월일", value: info.birth },
    { label: "투·타", value: info.batThrow },
    { label: "출신학교", value: info.school },
    { label: "활약년도", value: info.active },
    { label: "현재 소속", value: info.currentTeam },
    { label: "포지션", value: info.position },
    { label: "신인 지명", value: info.draftInfo },
    { label: "이전 소속", value: info.previousTeam },
    { label: "이전 포지션", value: info.previousPosition }
  ];

  // 각 필드를 한 줄씩 추가
  fields.forEach(f => {
    const row = panel.append("div").attr("class", "info-row");
    row.append("span").attr("class", "info-label").text(f.label);
    row.append("span").attr("class", "info-value").text(f.value);
  });
}

/* ─────────────────────────────── 중간: 시나리오 + 히트맵 ─────────────────────────────── */
/**
 * 함수명: initializePlayerDropdown
 * 설명  : allDataGlobal에서 선수 이름을 추출하여 선수 선택 드롭다운을 생성합니다.
 * 매개변수:
 *   - allData: 전체 타율 데이터 배열
 */
function initializePlayerDropdown(allData) {
  const players = Array.from(new Set(allData.map(d => d.player)));
  const select = d3.select("#player-select");
  select.selectAll("option.player-option").remove();
  select.selectAll("option.player-option")
    .data(players)
    .enter()
    .append("option")
    .attr("class", "player-option")
    .attr("value", d => d)
    .text(d => d);
}

/**
 * 함수명: initializeScenarioCategoryDropdown
 * 설명  : 시나리오 유형(전체, 구종, 투수, 주자상황, 카운트) 드롭다운을 생성합니다.
 */
function initializeScenarioCategoryDropdown() {
  const categories = ["전체", "구종", "투수", "주자상황", "카운트"];
  const select = d3.select("#scenario-category-select");
  select.selectAll("option.category-option").remove();
  select.selectAll("option.category-option")
    .data(categories)
    .enter()
    .append("option")
    .attr("class", "category-option")
    .attr("value", d => d)
    .text(d => d);
}

/**
 * 함수명: initializeScenarioValueDropdown
 * 설명  : 선택된 선수와 카테고리에 따라 시나리오 값을 필터링하여 시나리오 값 드롭다운을 갱신합니다.
 * 매개변수:
 *   - allData: 전체 타율 데이터 배열
 *   - playerName: 선택된 선수 이름 (또는 null)
 *   - category: 선택된 시나리오 유형 (또는 null)
 */
function initializeScenarioValueDropdown(allData, playerName, category) {
  const select = d3.select("#scenario-value-select");
  select.selectAll("option").remove();
  select.append("option").attr("value", "").text("–");

  if (!playerName || !category || category === "–") {
    return;
  }

  // 선수 필터링
  const filteredByPlayer = allData.filter(d => d.player === playerName);
  let scenarioList = [];

  // 카테고리에 따라 해당 시나리오 값 추출
  if (category === "전체") {
    scenarioList = [];  // 전체는 고정으로 옵션 없음
  } else if (category === "구종") {
    const pitchTypes = ["투심", "포심", "커터", "커브", "슬라이더", "체인지업", "포크볼", "싱커", "너클", "기타"];
    scenarioList = Array.from(new Set(
      filteredByPlayer
        .map(d => d.scenario)
        .filter(s => pitchTypes.includes(s))
    ));
  } else if (category === "투수") {
    const pitcherHands = ["우투", "좌투", "우언", "좌언"];
    scenarioList = Array.from(new Set(
      filteredByPlayer
        .map(d => d.scenario)
        .filter(s => pitcherHands.includes(s))
    ));
  } else if (category === "주자상황") {
    const baseStates = ["주자없음", "주자있음", "득점권"];
    scenarioList = Array.from(new Set(
      filteredByPlayer
        .map(d => d.scenario)
        .filter(s => baseStates.includes(s))
    ));
  } else if (category === "카운트") {
    const countStates = ["S > B", "B > S", "S = B", "초구", "2S 이후"];
    scenarioList = Array.from(new Set(
      filteredByPlayer
        .map(d => d.scenario)
        .filter(s => countStates.includes(s))
    ));
  }

  // 필터링된 시나리오 값들로 옵션 추가
  select.selectAll("option.value-option")
    .data(scenarioList)
    .enter()
    .append("option")
    .attr("class", "value-option")
    .attr("value", d => d)
    .text(d => d);
}

/**
 * 함수명: createHeatmapContainer_v2
 * 설명  : 5×5 그리드 히트맵 컨테이너를 생성하여 초기 빈 셀과 안쪽 3×3 검은 테두리를 렌더링합니다.
 */
function createHeatmapContainer_v2() {
  if (!d3.select("#heatmap-container svg").empty()) return;

  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const svgWidth = 680;
  const svgHeight = 680;
  const width = svgWidth - margin.left - margin.right;
  const height = svgHeight - margin.top - margin.bottom;

  const svg = d3.select("#heatmap-container")
    .append("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight)
    .append("g")
    .attr("id", "heatmap-group-v2")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  // 각 행/열을 균등하게 나누는 scaleBand
  window.xScale2 = d3.scaleBand()
    .domain([0, 1, 2, 3, 4])
    .range([0, width])
    .padding(0.05);

  window.yScale2 = d3.scaleBand()
    .domain([0, 1, 2, 3, 4])
    .range([0, height])
    .padding(0.05);

  // 색상 스케일: 평균값에 따라 파란↔흰↔빨강
  window.colorScale2 = d3.scaleLinear()
    .domain([0, 0.3, 1.0])
    .range(["#0066cc", "#ffffff", "#d40000"]);

  // 5×5 좌표 배열 생성
  const allCoords = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      allCoords.push({ row: r, col: c });
    }
  }

  // 빈 셀(rect) 그리기
  svg.selectAll("rect.empty-cell")
    .data(allCoords)
    .enter()
    .append("rect")
    .attr("class", "empty-cell")
    .attr("x", d => xScale2(d.col))
    .attr("y", d => yScale2(d.row))
    .attr("width", xScale2.bandwidth())
    .attr("height", yScale2.bandwidth())
    .attr("fill", "#f8f8f8")
    .attr("stroke", "#555")
    .attr("stroke-width", 1);

  // 안쪽 3×3 영역(행·열 인덱스 1~3)에 두꺼운 검은 테두리를 추가
  const xStart = xScale2(1);
  const yStart = yScale2(1);
  const xEnd = xScale2(3) + xScale2.bandwidth();
  const yEnd = yScale2(3) + yScale2.bandwidth();
  const borderWidth = xEnd - xStart;
  const borderHeight = yEnd - yStart;

  svg.append("rect")
    .attr("class", "inner-border")
    .attr("x", xStart)
    .attr("y", yStart)
    .attr("width", borderWidth)
    .attr("height", borderHeight)
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-width", 8);
}

/**
 * 함수명: drawHeatmap_v2
 * 설명  : 선택된 선수 및 시나리오 조건에 해당하는 데이터를 기반으로 5×5 히트맵을 그립니다.
 * 매개변수:
 *   - allData: 전체 타율 데이터 배열
 *   - playerName: 선택된 선수 이름
 *   - category: 시나리오 유형 ("전체" 또는 기타)
 *   - scenarioValue: 선택된 시나리오 값
 */
function drawHeatmap_v2(allData, playerName, category, scenarioValue) {
  // 카테고리가 “전체”일 때는 선수별 모든 데이터, 그렇지 않으면 선택된 시나리오로 필터
  const subset = (category === "전체")
    ? allData.filter(d => d.player === playerName)
    : allData.filter(d => d.player === playerName && d.scenario === scenarioValue);

  createHeatmapContainer_v2();  // 그리드가 없다면 생성
  const group = d3.select("#heatmap-container svg #heatmap-group-v2");
  group.selectAll("g.cell-group").remove();  // 기존 셀 제거

  // 필터링된 데이터를 행(row), 열(col) 좌표로 매핑
  const enterGroups = group.selectAll("g.cell-group")
    .data(subset, d => `${d.row},${d.col}`)
    .enter()
    .append("g")
    .attr("class", "cell-group")
    .attr("transform", d => `translate(${xScale2(d.col)}, ${yScale2(d.row)})`);

  // 각 셀에 직사각형과 텍스트(AVG, PA) 추가
  enterGroups.append("rect")
    .attr("width", xScale2.bandwidth())
    .attr("height", yScale2.bandwidth())
    .attr("fill", d => d.avg == null ? "#f0f0f0" : colorScale2(d.avg))
    .attr("stroke", "#000")
    .attr("stroke-width", 1);

  enterGroups.append("text")
    .attr("x", xScale2.bandwidth() / 2)
    .attr("y", yScale2.bandwidth() / 2 - 5)
    .attr("text-anchor", "middle")
    .attr("font-size", "24px")
    .attr("fill", d => {
      if (d.avg == null) return "#666";
      // 배경 밝기에 따라 텍스트 색상을 흰/검으로 조정
      const bg = d3.color(colorScale2(d.avg));
      const lum = bg.r * 0.2126 + bg.g * 0.7152 + bg.b * 0.0722;
      return lum < 128 ? "#fff" : "#000";
    })
    .text(d => (d.avg != null ? d.avg.toFixed(3) : ""));

  enterGroups.append("text")
    .attr("x", xScale2.bandwidth() / 2)
    .attr("y", yScale2.bandwidth() / 2 + 20)
    .attr("text-anchor", "middle")
    .attr("font-size", "16px")
    .attr("fill", d => {
      if (d.avg == null) return "#333";
      const bg = d3.color(colorScale2(d.avg));
      const lum = bg.r * 0.2126 + bg.g * 0.7152 + bg.b * 0.0722;
      return lum < 128 ? "#fff" : "#333";
    })
    .text(d => `PA:${d.pa}`);

  // 내부 검은 테두리를 최상위로 올려서 가려지지 않게 함
  d3.select("#heatmap-container svg #heatmap-group-v2")
    .select("rect.inner-border")
    .raise();
}

/* ─────────────────────────────── 중간: 레이더 그래프 ─────────────────────────────── */
/**
 * 함수명: drawRadarChart
 * 설명  : 선택된 선수의 2024년 및 2025년 스탯을 기준으로 레이더 차트를 그립니다.
 * 매개변수:
 *   - playerName: 레이더 차트를 그릴 선수 이름
 */
function drawRadarChart(playerName) {
  const player = playerProfiles[playerName];
  // stats가 없으면 차트 처리 중단
  if (!player || !player.stats || !player.stats["2024"] || !player.stats["2025"]) return;

  const stats2024 = player.stats["2024"];
  const stats2025 = player.stats["2025"];

  const width = 580;
  const height = 580;
  const radius = Math.min(width, height) / 2 - 60;

  const labels = Object.keys(stats2024);              // 예: ["타율", "출루율", ...]
  const values2024 = labels.map(k => stats2024[k]);       // 2024년 수치 배열
  const values2025 = labels.map(k => stats2025[k]);       // 2025년 수치 배열

  const angleSlice = (2 * Math.PI) / labels.length;       // 각 축 사이 각도
  const rScale = d3.scaleLinear().domain([0, 1]).range([0, radius]);

  // 기존 레이더 SVG 제거
  d3.select("#radar-container").selectAll("svg").remove();

  // 새로운 SVG 생성 및 중앙으로 그룹 이동
  const svg = d3.select("#radar-container")
    .append("svg")
    .attr("width", 680)
    .attr("height", 680);

  const g = svg.append("g")
    .attr("transform", `translate(${680 / 2}, ${680 / 2})`);

  // 1) 원형 그리드 (레이어별로 5단계)
  const levels = 5;
  for (let lvl = 1; lvl <= levels; lvl++) {
    const r = radius * (lvl / levels);
    g.append("circle")
      .attr("r", r)
      .attr("fill", "none")
      .attr("stroke", "#aaa")
      .attr("stroke-dasharray", "2,2");
  }

  // 2) 축과 라벨
  labels.forEach((label, i) => {
    const angle = i * angleSlice - Math.PI / 2;
    const x = rScale(1.15) * Math.cos(angle);
    const y = rScale(1.15) * Math.sin(angle);

    // 축선 그리기
    g.append("line")
      .attr("x1", 0).attr("y1", 0)
      .attr("x2", rScale(1) * Math.cos(angle))
      .attr("y2", rScale(1) * Math.sin(angle))
      .attr("stroke", "#999");

    // 라벨 텍스트
    g.append("text")
      .attr("x", x)
      .attr("y", y)
      .attr("text-anchor", "middle")
      .attr("font-size", "20px")
      .attr("fill", "#333")
      .text(label);
  });

  // 3) 2024년 데이터 폴리곤
  const points2024 = values2024.map((val, i) => {
    const angle = i * angleSlice - Math.PI / 2;
    return [
      rScale(val) * Math.cos(angle),
      rScale(val) * Math.sin(angle)
    ];
  });

  g.append("polygon")
    .attr("points", points2024.map(p => `${p[0]},${p[1]}`).join(" "))
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 5);

  // 4) 2025년 데이터 폴리곤
  const points2025 = values2025.map((val, i) => {
    const angle = i * angleSlice - Math.PI / 2;
    return [
      rScale(val) * Math.cos(angle),
      rScale(val) * Math.sin(angle)
    ];
  });

  g.append("polygon")
    .attr("points", points2025.map(p => `${p[0]},${p[1]}`).join(" "))
    .attr("fill", "none")
    .attr("stroke", "#d62828")
    .attr("stroke-width", 5);

  const tooltipDiv = d3.select(".tooltip");

  // 5) 각 꼭짓점에 원(circle)찍고 툴팁 이벤트 바인딩 (2024)
  points2024.forEach((p, i) => {
    g.append("circle")
      .attr("cx", p[0])
      .attr("cy", p[1])
      .attr("r", 5)
      .attr("fill", "steelblue")
      .attr("opacity", 0.8)
      .on("mouseover", event => {
        const label = labels[i];
        const value = values2024[i];
        tooltipDiv
          .style("opacity", 1)
          .html(`2024 ${label}: ${(value * 100).toFixed(1)}%`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
      })
      .on("mousemove", event => {
        tooltipDiv
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
      })
      .on("mouseout", () => {
        tooltipDiv.style("opacity", 0);
      });
  });

  // 6) 각 꼭짓점에 원(circle)찍고 툴팁 이벤트 바인딩 (2025)
  points2025.forEach((p, i) => {
    g.append("circle")
      .attr("cx", p[0])
      .attr("cy", p[1])
      .attr("r", 5)
      .attr("fill", "#d62828")
      .attr("opacity", 0.8)
      .on("mouseover", event => {
        const label = labels[i];
        const value = values2025[i];
        tooltipDiv
          .style("opacity", 1)
          .html(`2025 ${label}: ${(value * 100).toFixed(1)}%`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
      })
      .on("mousemove", event => {
        tooltipDiv
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
      })
      .on("mouseout", () => {
        tooltipDiv.style("opacity", 0);
      });
  });

  // 7) 범례(레이블+색상)
  const legend = svg.append("g")
    .attr("transform", `translate(${width - 40}, 60)`);

  legend.append("rect")
    .attr("x", 0).attr("y", 0).attr("width", 16).attr("height", 16)
    .attr("fill", "steelblue");
  legend.append("text")
    .attr("x", 20).attr("y", 13)
    .text("2024년")
    .attr("font-size", "16px");

  legend.append("rect")
    .attr("x", 0).attr("y", 25).attr("width", 16).attr("height", 16)
    .attr("fill", "#d62828");
  legend.append("text")
    .attr("x", 20).attr("y", 38)
    .text("2025년")
    .attr("font-size", "16px");
}

/* ─────────────────────────────── 오른쪽: 팬 차트(부채꼴) ─────────────────────────────── */
/**
 * 함수명: computeDirectionRatios
 * 설명  : 주어진 선수의 가장 최신 연도 타구 방향 분포를 계산해 백분율로 반환합니다.
 * 매개변수:
 *   - allData: 전체 타율 데이터 배열
 *   - playerName: 선택된 선수 이름
 * 반환값:
 *   - [좌, 좌중, 중, 우중, 우] 순서의 백분율 배열 (길이 5)
 */
function computeDirectionRatios(allData, playerName) {
  const playerData = allData.filter(d => d.player === playerName);
  if (playerData.length === 0) return [0, 0, 0, 0, 0];

  const years = Array.from(new Set(playerData.map(d => d.year))).sort();
  const latestYear = years[years.length - 1];
  const latestData = playerData.filter(d => d.year === latestYear);

  const counts = { 좌: 0, 좌중: 0, 중: 0, 우중: 0, 우: 0 };
  latestData.forEach(d => {
    if (counts.hasOwnProperty(d.hitDirection)) counts[d.hitDirection]++;
  });

  const totalPA = latestData.length || 1;
  return ["좌", "좌중", "중", "우중", "우"].map(dir => (counts[dir] / totalPA) * 100);
}

/**
 * 함수명: drawScaledBaseballFanOverlay
 * 설명  : 입력된 타구 방향 비율 데이터를 기반으로 부채꼴 팬 차트를 그리고, 투·타 정보에 따라 마스코트를 제어합니다.
 * 매개변수:
 *   - data: [좌, 좌중, 중, 우중, 우] 순서의 타구 방향 백분율 배열
 *   - playerName: 부채꼴과 마스코트에 사용할 선수 이름
 */
function drawScaledBaseballFanOverlay(data, playerName) {
  if (!Array.isArray(data) || data.length !== 5) return;

  const svg = d3.select("#fan-chart");
  svg.selectAll("*").remove();

  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const centerX = width / 2;
  const centerY = height * 0.8;

  // (1) 야구장 이미지
  svg.append("image")
    .attr("href", "images/baseball.png")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height);

  // (2) 마스코트 표시: 투·타 정보(예: "우투우타")로 양쪽 마스코트 제어
  const batThrow = playerProfiles[playerName]?.batThrow || "";
  const isRightHit = /우타|양타/.test(batThrow);
  const isLeftHit = /좌타|양타/.test(batThrow);

  if (isRightHit) {
    svg.append("image")
      .attr("href", "images/lotte_mascot1.png")
      .attr("x", 10)
      .attr("y", height - 240)
      .attr("width", 240)
      .attr("height", 240);
  }
  if (isLeftHit) {
    svg.append("image")
      .attr("href", "images/lotte_mascot2.png")
      .attr("x", width - 220)
      .attr("y", height - 215)
      .attr("width", 200)
      .attr("height", 200);
  }

  // (3) 백분율→비율로 변환
  const ratios = data.map(d => d / 100);

  // (4) 색상 결정 헬퍼 함수: 비율에 따라 빨강/주황/노랑
  function colorByRatio(r) {
    if (r > 0.20) return "red";
    if (r > 0.10) return "orange";
    return "yellow";
  }

  // (5) 부채꼴 시작각과 전체각, 세그먼트 각도
  const startAngleFull = Math.PI / 4;     // 왼쪽 파울라인 시작각
  const totalAngle = Math.PI / 2;     // 180°
  const segmentAngle = totalAngle / 5;  // 36° (π/5)

  // (6) 최대 반지름 (SVG 크기에 기반)
  const radiusMax = Math.min(width / 2, height) * 3.6;

  // (7) D3 arc 생성기 정의: innerRadius 0부터, outerRadius = 비율 * 최대반지름
  const arcGenerator = d3.arc()
    .innerRadius(0)
    .outerRadius(d => d.ratio * radiusMax)
    .startAngle(d => startAngleFull - d.index * segmentAngle)
    .endAngle(d => startAngleFull - (d.index + 1) * segmentAngle);

  // (8) arc 데이터 형식: [{ index:0, ratio:... }, ...]
  const fanData = ratios.map((r, i) => ({ index: i, ratio: r }));

  // (9) SVG 그룹 생성 및 부채꼴(Path) 그리기
  const fanGroup = svg.append("g")
    .attr("transform", `translate(${centerX}, ${centerY})`);

  fanGroup.selectAll("path")
    .data(fanData)
    .enter()
    .append("path")
    .attr("d", arcGenerator)
    .attr("fill", d => colorByRatio(d.ratio))
    .attr("fill-opacity", 0.6)
    .attr("stroke", "#333")
    .attr("stroke-width", 1);

  // (10) 부채꼴 중심에 퍼센트 텍스트 추가
  fanGroup.selectAll("text.fan-label")
    .data(fanData)
    .enter()
    .append("text")
    .attr("class", "fan-label")
    .attr("x", d => arcGenerator.centroid(d)[0])
    .attr("y", d => arcGenerator.centroid(d)[1])
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("fill", "#fff")
    .text(d => (d.ratio * 100).toFixed(1) + "%");

}

/**
 * 함수명: drawFanChartBaseBackground
 * 설명  : 부채꼴 차트 초기 상태에서 야구장 이미지와 양쪽 마스코트를 모두 표시합니다.
 * 매개변수:
 *   - svg: d3로 선택된 SVG 요소
 *   - width: SVG 너비
 *   - height: SVG 높이
 */
function drawFanChartBaseBackground(svg, width, height) {
  // 야구장 배경 이미지
  svg.append("image")
    .attr("href", "images/baseball.png")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height);

  // 왼쪽 마스코트 (항상 표시)
  svg.append("image")
    .attr("href", "images/lotte_mascot1.png")
    .attr("x", 10)
    .attr("y", height - 240)
    .attr("width", 240)
    .attr("height", 240);

  // 오른쪽 마스코트 (항상 표시)
  svg.append("image")
    .attr("href", "images/lotte_mascot2.png")
    .attr("x", width - 220)
    .attr("y", height - 215)
    .attr("width", 200)
    .attr("height", 200);
}
