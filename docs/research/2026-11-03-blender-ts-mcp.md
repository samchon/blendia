# Blendia: Blender 내부 TypeScript 실행과 에이전트 연동 조사

조사 기준일: **2026-11-03 (Asia/Seoul)**. 이 문서는 공개 프로젝트 원문·소스·이슈·실사용 기록·연구를 여러 에이전트가 나누어 조사한 결과를 합친 것이다. 제품 코드를 구현하거나 Blender를 직접 실행한 자체 벤치마크 결과는 아니다. 공개 원문은 변경될 수 있으므로 도구 수와 지원 버전은 조사 시점의 상태로 읽어야 한다.

지속 관리의 원본은 **[종합 조사·결정 추적 #1](https://github.com/samchon/blendia/issues/1)**이다. 해당 issue에는 이 보고서 전문을 보관했다. 새로운 근거·결정·상태는 관련 issue와 이 문서를 함께 갱신하며, 문서만으로 issue 관리를 대체하지 않는다.

| 관리 항목 | GitHub issue |
|---|---|
| 종합 조사·요구사항·의사결정 | [#1](https://github.com/samchon/blendia/issues/1) |
| typed SDK·bridge protocol·API/codegen 범위 | [#2](https://github.com/samchon/blendia/issues/2) |
| session·job·객체 수명·undo·취소 계약 | [#3](https://github.com/samchon/blendia/issues/3) |
| Blender 내부 TS macro UI·프로젝트 실행 | [#4](https://github.com/samchon/blendia/issues/4) |
| 공통 CLI·얇은 MCP·native image·관찰 | [#5](https://github.com/samchon/blendia/issues/5) |
| 호환성·실구동 검증·증거·효율 평가 | [#6](https://github.com/samchon/blendia/issues/6) |
| AutoMovie 참고 컨벤션·`@wrtnlabs/evidence`·agent skills | [#7](https://github.com/samchon/blendia/issues/7) |

## 1. 원래 요구와 이번 조사에서 보정한 전제

Blendia의 목표는 **Blender 안에서 사용자가 TypeScript 스크립트·매크로를 작성하고 실행하며, Claude Code·Codex도 같은 TypeScript 프로젝트와 SDK를 사용하게 하는 것**이다. 터미널 에이전트용 Python 실행기의 TypeScript 래퍼만 만드는 것으로 이 요구가 끝나지 않는다.

- 저장소는 pnpm TypeScript monorepo로 구성한다.
- TypeScript 실행은 사용자가 지정한 **Node.js + `ttsc`의 `ttsx`**를 사용한다. QuickJS를 내장하거나 별도의 TS 엔진을 개발하는 것을 전제하지 않는다.
- Blender 확장은 TS 파일·매크로 실행 UI, 실행 연결, Blender API 처리와 상태 전달을 담당한다. TS는 별도 Node 프로세스에서 실행하되 사용자는 Blender UI에서 실행할 수 있다.
- Claude Code·Codex가 TS 파일을 작성하고 CLI로 실행하는 경로가 기본이다. MCP도 같은 실행·조회 서비스를 사용하게 한다.
- **Three.js 연동은 범위에서 제외한다.** 에셋 생성 SaaS·Sketchfab·Poly Haven도 비교 대상의 기능일 뿐 Blendia의 필수 기능으로 채택하지 않는다.
- 사용자 확정 요구에 따라 검증 증거 관리에는 **`@wrtnlabs/evidence`**를 사용한다. AutoMovie를 참고한 workspace·개발·테스트·skill 운영 규약은 [#7](https://github.com/samchon/blendia/issues/7)에서 관리하며, 다른 evidence 패키지로 대체하지 않는다.

`ttsx`가 해결하는 것은 TypeScript 실행이다. Blender의 객체 수명, UI 문맥, 메인 스레드 실행, undo, 장시간 job, 프로세스 간 상태와 결과를 대신 설계해 주지는 않는다. [ttsx 공식 문서](https://ttsc.dev/docs/ttsc/execute/)

**조사에 따른 제안:** TS SDK·CLI·Blender 내부 실행을 제품의 공통 기반으로 만들고, MCP는 그 위의 얇은 인터페이스로 제공한다. MCP 자체를 어려운 독립 프레임워크 개발로 취급할 이유는 적다. 남는 어려움은 Blender 실행 의미와 관찰 가능성에 있다.

### 범위와 규모: Blender를 재구현하지 않는다

**Blender의 웹 버전을 TypeScript로 다시 만드는 프로젝트가 아니다.** geometry·scene graph·viewport·렌더러·파일 입출력은 기존 Blender를 그대로 사용한다. TypeScript 실행도 `ttsx`를 재사용한다. 처음 연결할 것은 작은 Python 확장과 TS API·실행 진입점이다.

첫 수직 기능은 **Blender의 Run TypeScript → 프로젝트의 TS 실행 → 객체 생성/수정·재질 적용 → 기존 Blender 렌더 → 로그·오류와 결과 확인**으로 한정할 수 있다. Claude Code·Codex는 같은 TS 파일을 수정하고 CLI로 실행한다. MCP는 동일 서비스에 typia controller를 붙인다. 뒤에서 다루는 session·undo·job 등은 이 작은 흐름에서 정해야 할 동작 계약이며, 각각 거대한 독립 시스템을 처음부터 만들자는 제안이 아니다.

규모가 커지는 조건은 별도로 구분해야 한다: **모든 `bpy` 기능의 완전한 동일 호환, Python 애드온의 동기 callback까지 전부 TS로 대체, Blender 기본 편집기에 완전한 TS IDE를 내장**하는 경우다. 이것들을 현재 요구에서 자동으로 확장해 필수 조건으로 넣지 않는다.

## 2. `typia`를 쓰면 MCP는 얼마나 남는가

사용자가 지적한 **`typia.llm.application` 계열 + `@typia/mcp`**는 MCP 구현량을 크게 줄인다. 현재 공식 예제의 진입점은 다음과 같다. 제품 API 설계 예시가 아니라 확인한 라이브러리 사용 형태이다.

```ts
const server = createMcpServer(
  typia.llm.controller<BlendiaController>("blendia", controller),
);
await server.connect(new StdioServerTransport());
```

현재 문서는 TS 메서드·타입·JSDoc에서 도구 입력/출력 schema, 인자 검증, 도구 설명, 서버 handshake instructions를 생성한다고 설명한다. 따라서 JSON Schema나 Zod shape를 수동으로 중복 작성하는 일을 Blendia의 핵심 과제로 잡으면 안 된다. `application`은 반영된 API 정의이고, 실행 인스턴스와 결합한 `controller`를 MCP 생성기에 전달하는 것이 현재 문서의 형태이다. [typia MCP 공식 문서](https://typia.io/docs/utilization/mcp/)

소스에서 확인한 작은 추가 작업은 **미디어 응답 연결**이다. 현재 `McpControllerRegistrar`는 controller 반환값을 검증한 뒤 `structuredContent`에 넣으며, 기본 `content`는 빈 배열이다. `textFallback`을 켜면 JSON 텍스트가 추가된다. 반환 JSON에 이미지처럼 생긴 필드를 넣는 것만으로 MCP의 native image content가 되지는 않는다. image content를 반환하는 전용 handler 또는 작은 adapter를 SDK `McpServer`에 붙이는 방법을 검토하면 된다. MCP 서버를 처음부터 다시 만들 이유는 없다. [Registrar 소스](https://raw.githubusercontent.com/samchon/typia/master/packages/mcp/src/internal/McpControllerRegistrar.ts), [생성 함수 소스](https://raw.githubusercontent.com/samchon/typia/master/packages/mcp/src/index.ts), [MCP 도구 결과 사양](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

**MCP는 시각 디버깅 전용 프로토콜이 아니다.** 도구 실행, 구조화된 결과, 이미지, 리소스를 전달하는 일반 인터페이스이다. Blendia에서는 이미지뿐 아니라 세션 발견·API 탐색·장면 조회·TS 실행·job 제어를 제공할 수 있다. 시각 관찰은 여기에 실질적인 가치를 더하는 부분이며, 같은 관찰 기능을 SDK와 CLI에서도 사용할 수 있어야 한다.

## 3. 유사 구현 비교: 무엇을 제공하고 어디까지 검증되었는가

아래의 기능은 프로젝트 문서·소스에서 확인한 범위이다. 기능이 존재한다는 사실과 실제 사용자 생산성이 높다는 사실을 구분했다. 작은 저장소는 설계 아이디어의 사례로 다루며, 널리 검증된 제품으로 간주하지 않았다.

| 구현 | 차별화된 기능·접근 | Blendia에 참고할 점·제한 | 근거 |
|---|---|---|---|
| **MCP for Blender / ahujasid** | Python 서버+TCP 애드온. 현재 README는 9개 도구: Python 실행, `look`, 선택 필드 장면 요약, 외부 모델 생성·에셋 검색/가져오기, 버전 상태·telemetry 제어 등. Codex 플러그인은 라이브 viewport와 객체 선택·멘션 UI도 제공 | 가장 널리 알려진 community 구현. 과거 `blender-mcp`에서 이름이 바뀌었다. **TS 스크립팅 환경은 아님.** 옛 25/28개 도구 측정과 현재 9개 도구를 혼동하면 안 됨 | [저장소](https://github.com/ahujasid/mcp-for-blender), [현재 server.py](https://raw.githubusercontent.com/ahujasid/mcp-for-blender/main/src/blender_mcp/server.py) |
| **Blender Lab 공식 MCP** | 별도 확장+Python MCP 서버. Blender 5.1+. 현재 26개 도구: live/headless Python, 파일·객체 요약, 이미지·창 layout, viewport 이동, render/thumbnail, API·manual 검색 | Blender 내장 기능과 구분. 작은 도구 집합+코드 실행+문서 조회. 공식 제공도 TS 편집·매크로 실행을 대체하지 않음 | [공식 안내](https://www.blender.org/lab/mcp-server/), [소스](https://projects.blender.org/lab/blender_mcp/src/branch/main), [도구 목록](https://projects.blender.org/lab/blender_mcp/raw/branch/main/readme_tools.rst) |
| **bpy.dev / bpy-dev** | Blender Lab 기반 community preview. live와 headless subprocess, 실행 중 API의 signature·enum·default 조회, output cap, framing, timeout, overwrite 확인, benchmark tooling | 적은 도구로 코드·시각 피드백을 결합. subprocess 분리는 OS sandbox가 아니라고 명시. 공개 실험 결과는 공식 leaderboard가 아님 | [사이트](https://bpy.dev/), [저장소](https://github.com/bpy-dev/blender-mcp) |
| **dcc-mcp-blender** | Blender 내부 Streamable HTTP, 200+ typed tools와 progressive skills, DCC 공통 gateway·CLI. shell agent에는 `search → describe → call` CLI 사용 권장 | 광범위한 기능을 한꺼번에 model context에 넣지 않고 발견·선택. RNA 탐색·값 readback·응답 예산 참고. [2026-09-23 경쟁 비교 문서](https://raw.githubusercontent.com/dcc-mcp/dcc-mcp-blender/main/docs/blender-mcp-comparison.md)의 “공식 MCP 없음” 주장은 현재 현황과 모순이며, 최신 RNA 문서는 Blender Lab을 인정 | [저장소](https://github.com/dcc-mcp/dcc-mcp-blender), [RNA 설계](https://raw.githubusercontent.com/dcc-mcp/dcc-mcp-blender/main/docs/capability-enhancement.md) |
| **Blender MCP Pro / youichi-uda** | 120+ tools/17 범주. 초기 core 15개와 category enable. 모델링·리깅 진단·turntable·batch render | 동적 tool loading의 client 호환성이 문제: README는 일부 client의 `tools/list_changed` 미지원 fallback을 설명. 서버 proprietary, addon MIT로 배포 조건도 다름 | [저장소](https://github.com/youichi-uda/blender-mcp-pro) |
| **djeada/blender-mcp-server** | 27도구/7 namespace, Python 실행, async job/history, headless, token 인증. Claude Code 정물·Codex 도시·live animation→headless render 녹화 | 실행 이력·job 모델과 작성자 end-to-end 데모 참고. 독립적인 향상률 증거는 아님 | [저장소](https://github.com/djeada/blender-mcp-server) |
| **levigross/blender-mcp** | `scheme_eval` 하나로 persistent Scheme 세션, scene diff/checkpoint, batch 최대 100, background task/render/cancel. Rust+Python | 작은 실행 도구+표현력 있는 코드 API라는 점에서 TS SDK 제안과 유사. Linux/Nix 중심이며 배포 성숙도 근거가 약함 | [저장소](https://github.com/levigross/blender-mcp) |
| **cavi-ai/blender-mcp** | arbitrary Python 대신 14개 bounded tools. 메인 스레드 bridge, session token, writer lease, UV/bake/LOD/game export | 동시 수정 충돌 방지와 게임용 asset prep 집중 사례. 작은 community 프로젝트로 실제 현업 검증과 구분 | [저장소](https://github.com/cavi-ai/blender-mcp) |
| **sandraschi/blender-mcp** | headless 중심+선택 live bridge. mesh/VSE/Grease Pencil/VRM/splats, dashboard/metrics | 운영·관찰 기능 범위 참고. README 안에서 도구 수 표기가 달라 정확한 개수는 확정하지 않음 | [저장소](https://github.com/sandraschi/blender-mcp) |
| **Fir3st/blender-mcp** | 118 dedicated tools, batch의 이전 결과 참조, checkpoints, 공식 endpoint 호환 | 문서가 batch와 transaction을 명시적으로 구분. 원인별 묶음 작업을 지원하되 자동 rollback을 약속하지 않는 접근 | [저장소](https://github.com/Fir3st/blender-mcp) |
| **owenpkent/blendmcp** | 구조화된 객체 편집, dimensions/bounding box readback, 연산별 batch 결과, 실행+스크린샷, traceback/reconnect/handshake | 모델이 사용한 수치와 실제 결과를 함께 받는 설계. 신뢰성 개선은 작성자 주장으로 독립 벤치마크 미발견 | [저장소](https://github.com/owenpkent/blendmcp) |
| **soozs1/Blender-MCP** | token 인증, length-prefix framing, telemetry 제거 | 에이전트 도구 수보다 연결 규약·권한 경계를 다듬는 fork. 작은 초기 프로젝트 | [저장소](https://github.com/soozs1/Blender-MCP) |
| **renezander030/blender-cli** | headless JSON CLI, doctor, run/exec, scene/node 조회, mesh 검증, 다중시점 snapshot, detached job/status/cancel, schema·agent skill | MCP 없이도 coding agent용 구조화 인터페이스가 가능. snapshot의 coverage·밝기·blank 판정과 async job 참고 | [저장소](https://github.com/renezander030/blender-cli) |
| **digitable-lol/blender-mcp** | virtual display 기반 headless-style GUI, offscreen viewport 캡처로 화면 compositing 없는 환경 지원 | PNG가 생성되고 success여도 검은 이미지일 수 있다는 실패 사례. 전용 `blender -b` 경로와 virtual-display GUI 경로를 구분해야 함 | [저장소](https://github.com/digitable-lol/blender-mcp) |
| **thanhdoancong127/blender-mcp** | lifecycle, screenshot·turntable, Python, rig/pose metrics·ROM, silhouette 비교. Windows 실구동 확인 내용을 공개 | 관찰·측정·실행·수명 관리가 함께 필요하다는 사례. 1.3M triangles turntable<2초 등 수치는 작성자 환경의 자기 보고 | [저장소](https://github.com/thanhdoancong127/blender-mcp) |
| **WangYan-Good/blender-mcp** | 제한된 local iteration loop, handshake/version 확인, viewport fallback, timeout, workspace 경로와 결과물 관리 | timed-out mutation을 자동 replay하지 않는 원칙. 실제 GPU·save/open smoke test를 별도 요구하여 unit test와 실사용을 구분 | [저장소](https://github.com/WangYan-Good/blender-mcp) |
| **BlkDem/blender-mcp** | stdio MCP+Blender websocket 연결, Blender bundled Python에 없는 의존성을 고려한 작은 protocol mirror·websocket 구현 | 외부 Python dependency를 무조건 설치시키지 않는 배포 전략. main-thread timer 기반 scene work와 실제 demo script 포함 | [저장소](https://github.com/BlkDem/blender-mcp) |
| **newo-ether/blender-mcp** | Geometry/Shader/Compositor 노드의 구조화된 export·validation·revision-safe patch, 버전별 문서·live node schema, installer | 노드 그래프를 코드 실행 외의 구조화된 대상으로 다루는 특화 사례. transactional patch 주장은 해당 지원 범위에 국한하며 전체 Blender transaction과 혼동하지 않음 | [저장소](https://github.com/newo-ether/blender-mcp) |
| **bakaroart/blender-chatgpt-mcp** | TypeScript MCP+Python stdlib bridge, 인증된 localhost·고정 연산 | **서버가 TS인 것과 Blender 사용자가 TS로 script를 쓰는 것은 다름.** architecture는 검증되지 않은 batch rollback을 제외했다고 명시 | [설계 문서](https://github.com/bakaroart/blender-chatgpt-mcp/blob/main/docs/ARCHITECTURE.md) |
| **PoBruno/mcp-blender-agent** | TS MCP와 typed operations·구조화된 장면 상태·composite workflow 접근 | Python 생성 일변도와 다른 대안. TS MCP는 TS 스크립팅 환경을 뜻하지 않음. 현재 README216과 오래된 CLAUDE140 등 도구 수 표기가 달라 규모 지표로 사용하지 않음 | [저장소](https://github.com/PoBruno/mcp-blender-agent) |

현재 널리 쓰이는 ahujasid 구현도 이미 `look`의 다각도 sheet·animation strip, 장면 필드 선택·건강 지표를 제공한다. 따라서 Blendia가 단순히 “MCP screenshot 추가”만으로 차별화된다고 판단해서는 안 된다. **동일한 TS 프로젝트가 Blender 내부 매크로·CLI·MCP에서 실행되고, typed API와 job·결과물이 공유되는 경험**을 중심으로 잡는 것이 이 조사에서 도출한 방향이다.

## 4. 실사용·후기: 성공한 과제와 실패한 과제

### 4.1 실제 결과물이 있거나 작업 과정이 구체적인 사례

| 사례 | 확인한 작업·결과 | 근거 수준과 적용 범위 |
|---|---|---|
| **Wavesworn 게임 에셋 제작** | Claude Code+Blender Lab MCP 1.0.2/Blender 5.2.2로 첫 배를 약 20분에 만들고 이후 headless Python으로 17 GLB/183 root objects 제작. live에서는 143 MCP 호출 중 code 101회, screenshot 30회 | 2026-10-18 개인 개발자의 클라이언트 데모 프로젝트 기록. working examples 공개. 라이브 탐색과 재현 가능한 배치 생산의 차이를 잘 보여주지만 보편적 성능 비교는 아님. [원문](https://www.sumguy.com/blender-mcp-vs-headless-bpy/) |
| **기존 scene 진단과 일괄 편집** | 지하에 숨긴 cube를 scene 좌표로 발견, z좌표 수정. 5개 cube 재질 일괄 변경, random rotation add-on 생성·검증 | 2026-04-30 DevelopersIO hands-on. 기업은 Anthropic reseller이므로 상업적 관계도 공개된 글. 모델링 예술 품질보다 자동화·조회 성공 증거. [원문](https://dev.classmethod.jp/en/articles/claude-blender-connector-desktop-and-code/) |
| **Blender 초보의 카메라 previz** | humanoid·기타·작은 공연 공간과 camera move를 회색 box로 구성, 약 1시간에 reference video 생성. 영상 모델에 전달해 카메라 의도 통제 | Reddit 자기 보고, 원문에 당시 약 4개월 전으로 표기. 관련 endpoint 링크가 있어 간접 홍보 가능. 최종 정밀 모델 제작이 아닌 저세부 공간·카메라 작업. [원문](https://www.reddit.com/r/ClaudeCode/comments/1ufzorw/i_let_claude_drive_blender_through_mcp_to_build/) |
| **Codex+Blender+Godot 저폴리 에셋** | 실제 크기의 가구·전자제품·문/창·소품, procedural materials와 GLB. 작성자는 180 assets 약 20분, Pro 주간 4% 사용 주장 | 원시 로그 없는 자기 보고. 댓글에는 primitive 수준이라는 반론과 높은 사용량·blocky style 불만도 존재. 수치를 보편적인 생산성 보장으로 사용 불가. [원문](https://www.reddit.com/r/codex/comments/1wen17e/codex_with_blender_and_godot_mcp_is_amazing/) |
| **Weathered crate lookdev** | Blender geometry/UV/Cycles와 Substance Designer procedural materials 결합. .blend/SBS/SBSAR/map/validation/provenance를 공개 | dcc-mcp 제작자 showcase. 검사 가능한 산출물이 있다는 장점. 독립 고객 후기나 속도 향상 실험 아님. [원문](https://github.com/dcc-mcp/dcc-mcp-blender/blob/main/docs/showcase/crate-lookdev/README.md) |
| **bpy.dev BlenderBench 시도** | 27 task, 270 checkpoints(10 rounds), 최소 도구 4개+코드+시각 관찰 경로의 결과 공개 | 제작자 연구 preview. CLIP cosine similarity이며 accuracy가 아님. 공식 leaderboard, hidden evaluation, same-model/same-budget 비교가 아님. [설명](https://bpy.dev/), [고정 revision 결과](https://huggingface.co/datasets/michaelgold/blenderbench-direct-results/resolve/7c2c43be4517aee4d76d2b445578988de186970c/results/results-summary.json) |
| **Simon Willison의 Codex headless 작업** | macOS에서 Codex가 Blender Python script를 작성·headless 실행한 과정, `.blend`와 대화 transcript 공개. 초기 실행2분39초 기록 | 2026-09-05 실제 시도 기록. MCP 없이도 coding agent가 결과를 만들 수 있다는 사례이며 TS나 MCP와의 통제 속도 비교가 아님. [원문](https://til.simonwillison.net/llms/blender-coding-agents-macos) |
| **Mavday 3과제 spot check** | room·cleanup·clip을 headless로 수행. 반복 후32/32 조건 충족 보고. room 수치는 맞아도 시각은 거칠었고 cleanup2회·clip render4회 시도 | 2026-10-29 저자의 소규모 자체 시험. 제목에 MCP가 있어도 **실험 자체는 headless-only**라 MCP 벤치마크로 인용하면 안 됨. [원문](https://mavday.com/ai-engineering/blender-mcp-ai-agents/) |

### 4.2 비판적 후기와 사용자 간 의견 차이

- **형태가 대략 맞아도 topology는 다시 만들어야 한다:** hard-surface 모델러는 silhouette는 괜찮지만 quads를 요청한 뒤에도 edge flow가 적절하지 않아 재작업이 필요했다고 설명했다. 같은 글의 Maya 경력 사용자는 mesh 정리·collections·문제 진단·Blender 학습 보조는 매우 유용하다고 평가했다. 여기서 “80%”는 측정값이 아니라 경험적 표현이다. [Reddit 후기](https://www.reddit.com/r/OpenAI/comments/1we95z2/blender_mcp_is_impressive_but_not_that_useable_yet/)
- **반복성과 공간 배치:** 복잡한 모델링·rigging·animation 질문에서는 같은 지시를 다시 적용할 때 geometry 위치가 달라졌으며, 정확한 XYZ를 지정해야 개선됐다는 경험이 나온다. 모델의 공간 추론과 tool 구현 오류를 이 기록만으로 구분할 수는 없다. [문제 보고](https://www.reddit.com/r/ClaudeAI/comments/1ritdv6/struggling_with_claude_code_blendermcp_for/)
- **Codex 결과에 대한 혼재:** 한 사용자는 다른 모델보다 Codex 결과가 나쁘다고 보고했다. 댓글은 자유 모델링보다 복잡한 Geometry Nodes가 낫다는 과제별 차이를 지적한다. 경쟁 제품 홍보 댓글은 독립 후기에서 제외해야 한다. [Codex 질문](https://www.reddit.com/r/codex/comments/1viffah/any_tips_for_using_codex_blender_mcp/)
- **재실행 가능한 소스가 낫다는 경험:** 초기 GPT-4.1/open-webui 시계 과제의 tool 사용 실패에서 시작한 긴 thread에는, 전체 프로젝트를 만드는 Python 파일을 보존하고 수정·재실행하는 방식이 낫다는 후속 경험이 있다. 여러 시점·모델·client의 댓글을 한 모델의 점수처럼 합산할 수 없다. [원문](https://www.reddit.com/r/LocalLLaMA/comments/1k2ilye/blender_mcp_can_anyone_actually_get_good_results/)
- **“MCP가 토큰을 절약했다”는 후기의 한계:** 공식 MCP를 설정하지 않은 채 Python 실행·검증을 반복해 사용량을 소모했다는 글이 있다. “reset 두 번 대신 30%면 됐을 것”은 반사실 추정이며 절감률 실측이 아니다. [원문](https://www.reddit.com/r/codex/comments/1wceqea/if_youre_using_blender_please_use_the_mcp_server/)
- **1,200+ arena runs의 초기 관찰:** 제작자는 official MCP와 skills, 상위 10개 호출의 입출력을 축약한 wrapper를 비교했다. wrapper가 비슷한 품질로 토큰을 줄였다는 관찰과 one-shot에서 skills 비용만 늘었다는 의견을 밝혔다. 모든 조합을 통제·실행한 시험이 아니고 순위도 투표 축적 중이다. [원문](https://www.reddit.com/r/LocalLLaMA/comments/1wyklnj/i_ran_1200_blender_modeling_runs_across_llms_and/)

이 기록들은 자동화·일괄 편집·진단·저폴리·previz에서의 유용성과, 유기적 형태·생산용 topology·공간 일관성·장기 수정에서의 한계를 함께 보여준다. **도구 연결 성공, Python/TS 실행 성공, 장면 조건 충족, 사람이 받아들일 시각 품질은 서로 다른 성공 기준**으로 관리해야 한다.

## 5. 정량 효율: 실제로 입증된 범위

| 측정·자료 | 수치와 조건 | 해석 제한 |
|---|---|---|
| **MCP for Blender 72 sessions** | 2026-10-22, Windows 11/GTX 1650/Blender 5.2.2/Claude Code 2.1.295/Opus 5.5 medium. 일반 작업 API 환산 $0.16–0.23. race scene 약 93초·평균 $0.47, 렌더 시간 별도 | 출력 축약 proxy 제작자가 수행한 자기 측정. 캐시·모델 가격·기본 지침·과제에 의존. MCP와 CLI의 통제 비교가 아님 |
| **긴 stdout 병목** | 580개 객체 property dump 122,373자. client 거절 뒤 네 chunk 재실행으로 242,782 input tokens/$0.873. 축약 proxy $0.166, 약 81% 감소 | 큰 출력 방지에는 의미 있으나 일반 작업 4–8% 차이는 저자도 run noise로 판단. 작은 이미지가 항상 큰 비용 절감으로 이어지지 않음 |
| **옛 도구 정의 비용** | ahujasid #347: 2026-08-19→09-03 tools/list 5,462→6,928 tokens(+26.8%), 도구 25→28. 원문·hash·tokenizer 방법 공개 | 현재 9개 카탈로그의 비용이 아님. client의 tool search에 따라 upfront loading 비용이 달라짐 |
| **live→headless 개인 측정** | Wavesworn에서 preview 약 1초, screenshot call 1.2–2.4초. 8개 병렬 headless agent로 배치 제작 | 단일 공유 live scene 대신 프로세스 격리가 유효하다는 사례. 어떤 장면에서도 headless가 더 빠르다는 증거 아님 |
| **LL3M 문서 RAG ablation** | 17 object에서 복잡한 연산 평균 1.20→5.86, 실행 오류 3.29→2.43(약26% 감소). 33 generations에서 초기4분+개선6분, 후속 edit38초 | RAG 유무의 내부 비교이며 “MCP보다26% 개선”이 아님. 구형 모델·작은 표본. visual critic도 일부 공간 오류를 놓침 |
| **BlenderWorld 최신 대규모 평가** | 2026-10-14 공개, 223 tasks/2,651 binary rubrics/13 models. 선두 모델 overall fused score 79.9, 모든 rubric 통과율 42.2% | 두 수치는 서로 다른 지표. Linux container/Blender 4.2.10, 코드+MCP+다중시점·구조 검사 환경. MCP 대 CLI·TS 비교가 아님 |
| **Anthropic code execution 예시** | 필요한 TS 정의만 읽고 코드로 중간 결과를 처리하는 예시에서 150,000→2,000 tokens(98.7% 감소) | Blender 벤치마크가 아님. 모든 MCP 서버나 Blendia에 적용되는 보장치로 쓰면 안 됨 |

72-run 측정은 [DEV 원문](https://dev.to/jaehyun_cho_0dff271e0d2e5/how-many-tokens-does-blender-mcp-really-use-72-claude-code-runs-and-a-racing-scene-for-047-5hl3), [#347](https://github.com/ahujasid/mcp-for-blender/issues/347), [측정 방법](https://github.com/athakur3/mcp-context-cost/blob/main/docs/METHODOLOGY.md), [공개 데이터 DOI](https://doi.org/10.5281/zenodo.23562484)를 함께 참고한다. 연구 수치는 [LL3M](https://arxiv.org/html/2508.08228v1), 일반 code execution 수치는 [Anthropic 원문](https://www.anthropic.com/research/code-execution-with-mcp)이다.

[BlenderWorld 논문](https://arxiv.org/html/2610.23986v1)은 8개의 과제별 관찰 시점과 직접 scene 구조 검사를 결합한다. 그럼에도 공간 일관성·지면 접촉·시점 의존 geometry, 관찰한 오류를 실제 수정으로 연결하는 부분에서 한계를 보고한다. 향후 Blendia 평가 과제·rubric를 고를 때 참고할 수 있다. 새 평가 프레임워크를 제품에 필수로 추가하자는 뜻은 아니다. [공개 구현](https://github.com/QwenLM/BlenderWorld), [프로젝트 페이지](https://blenderworld.github.io/)

**현재 근거로 주장할 수 없는 것:** MCP 추가 자체가 일정 비율의 토큰·시간을 절약한다는 보편적 수치, TS가 Python보다 모델링 품질이 높다는 비교, 수백 도구가 소수 도구보다 우월하다는 결론, 형식 검증만으로 최종 3D 품질이 보장된다는 결론.

## 6. 실패 현상과 원인·기여 요인을 한 번에 정리

아래 표는 사용자 지시인 “원인별 한 번에 수정”에 맞춰 증상을 원인 묶음으로 정리한 것이다. 공개 issue의 추정과 확정된 사실도 구분했다. Blendia의 재현 완료 버그 목록이 아니다.

| 현상 | 원인 또는 유력 가설·기여 요인 | Blendia가 설계·검증할 내용 | 근거 |
|---|---|---|---|
| 수분간 응답 대기·연결 desync | 프레임 경계를 추정하는 TCP JSON 처리, recv 경계, 요청 혼선. 모든 hang이 같은 원인은 아님 | 명시적 framing·request ID·직렬화·transport timeout·실행 상태 구분 | [community #279](https://github.com/ahujasid/mcp-for-blender/issues/279), [현재 socket lock 구현](https://raw.githubusercontent.com/ahujasid/mcp-for-blender/main/src/blender_mcp/server.py) |
| Windows headless 도구 120초 timeout | Blender Lab v1.0.3 계열/Windows 11/stdio 보고. 자식 stdin 상속을 지목한 PR #48은 조사 시점 open. stdin 분리 후 제보 환경 0.9초, 10월 22일 Blender 5.2.2/main `dbbf836` 환경 2.8초 보고(후자는 AI 시험임을 명시) | 자식 stdin/stdout/stderr 분리와 실제 Windows 배포판별 통합 시험. 외부 제보이며 Blendia에서 재현한 결과 아님 | [공식 PR#48](https://projects.blender.org/lab/blender_mcp/pulls/48) |
| 실행됐는데 client는 결과를 받지 못함 | 2026-10-31 Windows Store Blender 5.2.3/MCP v1.0.3/Claude Code 사용자 보고: code는 실행됐지만 launcher stdout 결과가 없음. 자체 미재현 | job ID로 결과 영속화, “미실행/완료/실행 여부 불명” 구분. mutation 자동 재시도 금지 | [공식 #69](https://projects.blender.org/lab/blender_mcp/issues/69) |
| 다른 Blender 연결·포트 충돌 | 공식/community가 같은9876 기본값 사용, 다른 protocol, 여러 인스턴스 | session discovery·정확한 identity/handshake·독립 endpoint | [community #339](https://github.com/ahujasid/mcp-for-blender/issues/339), [공식 issue 목록#63](https://projects.blender.org/lab/blender_mcp/issues) |
| success PNG가 검은 화면 | compositor/front-buffer 의존 캡처, background/virtual display/GPU 상태 | offscreen/render 경로 분리, blank/coverage 검증, image provenance 반환 | [headless fork 설명](https://github.com/digitable-lol/blender-mcp) |
| context 증가·반복 비용 | 전체 객체/정점/속성·stdout, 불필요 중간 결과, 과도한 왕복 | fields/filter/limit/cursor, artifact+부분 읽기, TS 내 계산·batch, 이미지 크기 예산 | [72-run 실험](https://dev.to/jaehyun_cho_0dff271e0d2e5/how-many-tokens-does-blender-mcp-really-use-72-claude-code-runs-and-a-racing-scene-for-047-5hl3), [공식 목록#54](https://projects.blender.org/lab/blender_mcp/issues) |
| API 추측·버전 오류 | 모델 학습 버전과 실제 Blender 차이, 부족한 signature/enum/context 문서 | runtime capability 조회·버전별 타입·API docs/examples·unsupported 명시 | [LL3M](https://arxiv.org/html/2508.08228v1), [bpy.dev](https://bpy.dev/) |
| 후속 편집에서 구조·위치 붕괴 | 원본 소스·계층·공간 제약 미보존, VLM 오판, 다수 객체 관계 누락 | 모듈 TS source 보존·parenting·수치 측정·다중시점 증거·시나리오별 제약 | [3Dify](https://3dvar.com/Hayashi20253Dify.pdf), [LL3M](https://arxiv.org/html/2508.08228v1) |
| 재실행·동시 agent 수정 충돌 | 공유 live scene, 한 viewport, session state 의존 | 단일 writer 또는 revision precondition, headless session 격리, 재실행 가능한 script | [Wavesworn 사례](https://www.sumguy.com/blender-mcp-vs-headless-bpy/), [cavi-ai](https://github.com/cavi-ai/blender-mcp) |
| code 성공을 모델 완성으로 오인 | schema/type check와 topology·시각 품질·export 요구가 다름 | 코드/scene 조건/시각 품질/산출물 재수입 검증을 각각 기록 | [topology 후기](https://www.reddit.com/r/OpenAI/comments/1we95z2/blender_mcp_is_impressive_but_not_that_useable_yet/), [공개 crate 검증물](https://github.com/dcc-mcp/dcc-mcp-blender/blob/main/docs/showcase/crate-lookdev/README.md) |

특히 timeout은 **취소 성공을 뜻하지 않는다.** Node 자식 프로세스를 종료해도 Blender 안에서 이미 시작한 작업이 멈췄다고 가정할 수 없다. 수신 timeout, 실행 취소 요청, Blender 작업 중단, 강제 프로세스 종료를 다른 상태로 모델링해야 한다. 이는 위 결과 수집 실패와 긴 작업 사례에서 도출한 요구사항이다.

## 7. 권장 공통 구조와 언어별 책임

```text
Blender UI: TS 파일/프로젝트/매크로 선택 → Run / Stop / 로그 / 결과
                         │
Claude Code / Codex ── TS 파일 작성 ── CLI ──┐
                         │                 │
MCP client ── @typia/mcp controller ────────┤
                                           ▼
                       공통 runtime: session / job / artifact
                                           │
                               Node.js + ttsx → TS SDK
                                           │
                                 Blendia bridge protocol
                                           │
                      Python Blender extension → Blender API
```

그림의 서비스가 전부 별도 daemon이어야 한다는 뜻은 아니다. 단일 Node 프로세스와 라이브러리로 시작할 수 있다. 다만 Blender UI·CLI·MCP가 서로 다른 실행·로그·결과 체계를 만드는 것은 피해야 한다.

| 경계 | 제안하는 책임 | 언어 |
|---|---|---|
| `@blendia/protocol` | request/response/error/event, session/job/artifact DTO, protocol version·capabilities. Blender↔Node용 규약이며 MCP와 별개 | TS 원본+Python 대응 구현/생성물 |
| `@blendia/sdk` | 사용자가 import하는 typed API, remote handle, 조회·수정·batch, scene 관찰·결과물 조회. 가짜 동기 bpy를 약속하지 않음 | TypeScript |
| `@blendia/runtime` | `ttsx` 실행 관리, 프로젝트/cwd/env, child lifecycle, session routing, job·log·artifact 관리. 새 TS 엔진 아님 | TypeScript |
| `@blendia/cli` | init/doctor/run/inspect/capture/job 등 terminal interface. 공통 runtime/SDK 호출, JSON 출력·명확한 exit code | TypeScript |
| `@blendia/codegen` | 실제 Blender metadata 추출물에서 API types·docs 생성, 지원 버전 기록·수동 보완 | TypeScript+Python 추출 script |
| `@blendia/mcp` | 위 서비스의 controller와 `@typia/mcp` 등록, native image/result adapter. schema 수작업의 별도 subsystem을 만들지 않음 | TypeScript |
| `blender/extension` | 설치 가능한 Blender 확장. TS 실행 UI·프로젝트 연결·main-thread dispatch·Blender 문맥·객체참조·실행 결과/이벤트 | Python |
| `examples`, `skills`, `tests/integration` | Blender 내부 TS macro·CLI agent workflow·MCP 시나리오, 실구동 검증물 | TS/Python/문서 |

패키지 수는 설계 결과이지 목표가 아니다. 내부 서비스의 안정된 경계가 없으면 `protocol`·`runtime` 일부를 먼저 비공개로 둘 수 있다. codegen은 사용자 설치 package보다 개발용 workspace package로 시작할 수 있다. media adapter도 별도 npm package로 늘릴 필요 없이 MCP package 안에 둘 수 있다.

**Python은 필요하다.** Blender 내부 확장 UI, Blender API dispatch, 메타데이터 추출, context/undo integration을 담당한다. 이 구조에서 C/C++·Rust·Go를 직접 개발할 필요는 현재 발견되지 않았다. Node·Blender가 내부에서 그런 언어를 사용한다는 것과 Blendia가 그 언어를 개발해야 한다는 것은 다르다.

## 8. MCP가 담당할 일과 시각 디버깅의 실제 범위

초기 도구 카탈로그의 이름·개수는 아직 확정하지 않는다. 아래는 하나의 controller에 묶을 수 있는 **능력 범주**다.

| 능력 | 최소 결과 | 같은 능력이 CLI/SDK에도 필요한 이유 |
|---|---|---|
| 세션 발견·연결 확인 | Blender version, file/scene, endpoint/session ID, capabilities, busy 상태 | 잘못된 Blender 수정과 버전 혼용 방지 |
| API 검색·설명 | 제한된 signature/enum/example/doc/version | 에이전트가 TS 코드를 정확히 작성 |
| 장면 조회 | filter/fields/limit, stable handle, transform/bounds/material 등 요청 필드 | 큰 전체 dump 없이 필요한 사실 확보 |
| TS 실행 | project entry, job ID, accepted/rejected/finished 상태 | 같은 TS source와 npm 프로젝트 재사용 |
| job 관찰·취소 | phase/log cursor/result/artifacts, 취소 가능성·실제 취소 상태 | 긴 렌더와 disconnect 이후 결과 복구 |
| 시각 관찰 | 작은 다각도 sheet·camera render·wireframe·animation strip와 provenance | 현재 장면의 공간 오류를 원인별로 함께 검사 |
| checkpoint·변경 요약 | scene revision, touched IDs, 저장/복원 가능 범위 | 안전한 후속 수정과 원인 추적 |
| 결과물 조회 | local artifact path/URI, MIME/size, 필요 범위 읽기 | 큰 JSON·로그·이미지를 매번 context에 복제하지 않음 |

시각 디버깅을 별도 기능으로 만든다면 단순 screenshot보다 다음이 중요하다.

1. **한 번의 관찰에서 필요한 증거를 묶는다:** front/side/top/perspective와 장면 수치·warnings를 함께 제공한다. 사용자의 원인별 일괄 수정 지시에도 맞는다.
2. **무엇을 찍었는지 기록한다:** session/file/scene/frame/camera, viewport mode, resolution, scene revision, capture 시간. 이전 결과를 현재 장면으로 오인하지 않게 한다.
3. **이미지와 geometry metrics를 결합한다:** bounds·scale·triangle count·non-manifold·rig/weight 진단 등 작업에 필요한 값만 선택한다. 단일 이미지로 topology를 확정하지 않는다.
4. **관찰은 쓰기 부작용을 최소화한다:** 렌더 설정·camera·selection·UI layout을 변경하는 도구는 복원 범위를 명확히 한다. 관찰 도구가 사용자의 작업 환경을 바꾸는지 contract에 표시한다.
5. **MCP host에 실제 이미지로 전달한다:** JSON 안의 base64/path와 native MCP image content를 구분하고 client별 확인을 한다. CLI는 local PNG와 metadata JSON으로 같은 결과물을 제공할 수 있다.

## 9. 아직 결정해야 할 핵심과 놓치면 안 되는 항목

아래는 조사로 모두 해결된 사항이 아니라 **구현 전에 확정하거나 실험으로 닫아야 할 결정**이다. MCP schema 생성보다 이 항목들이 제품 성패에 더 직접적이다.

| 우선순위 | 결정할 내용 | 필요한 실험·완료 기준 |
|---|---|---|
| P0 | **Blender 내부 TS macro의 정확한 경험**: 현재 Text Editor buffer 실행/프로젝트 파일 실행, 저장되지 않은 수정, `tsconfig`·npm resolution, Run/Stop, shortcut/operator | Blender UI에서 TS를 수정·실행해 scene 변경, 오류 원본 위치 표시, 저장·재실행. agent도 같은 entry를 실행 |
| P0 | **TS macro와 Python addon 전면 대체의 경계**: scene script와 Custom Operator/Panel/modal/poll/draw/driver/handler의 차이 | 1차는 macro를 구현. 동기 callback을 remote async TS로 투명하게 대체한다고 약속하지 않음. 필요 시 Python class/trampoline·선언형 UI를 별도 설계 |
| P0 | **SDK 실행 의미**: async 원격 호출, declarative batch 또는 action graph, local computation, property access 방식 | 정점마다 RPC하지 않는 대표 mesh 생성. type error와 runtime error를 구분. 왕복 수·데이터 크기 측정 |
| P0 | **RNA 생성 범위와 수동 보완**: properties/functions/enums뿐 아니라 operators/context, bmesh/mathutils, dynamic addon API | 지원 API matrix, missing/unsupported 명시, 버전별 생성 diff. “bpy 전체 자동 노출”을 검증 전 약속하지 않음 |
| P0 | **session·handle·scene revision**: rename/delete/load/undo 후 참조 유효성, writer 소유권 | stale handle 거절, 다른 파일·세션 혼선 방지, 두 agent 충돌 시험 |
| P0 | **job 결과와 불명 상태**: ack 전/후 disconnect, timeout·retry·dedup, logs/result 보존 | 실행은 됐는데 응답 유실된 경우 job ID로 조회. mutation 중복 실행 없음 |
| P0 | **main-thread scheduling·긴 작업 취소** | bpy 실행 안전성, UI 반응, Node 종료와 Blender 취소 구분. blocking operator/render 중 지원 범위 명시 |
| P0 | **context·undo·실패 후 복구**: operator poll, object/edit mode, workspace, selection, grouped undo, partial failure | wrong context에서 설명 가능한 오류, batch 부분 실패 결과. undo/checkpoint를 transaction으로 오기재하지 않음 |
| P0 | **프로세스/배포**: Node·ttsx·extension version, Windows Store/non-Store Blender, Python 의존성, local endpoint | doctor 진단, protocol mismatch, 실제 Windows 설치/upgrade/uninstall smoke |
| P1 | **live와 headless 공존**: 단일 script가 요구하는 capabilities와 차이 | GUI-only 기능의 명시적 거절, isolated background job, 결과 이미지 확보 |
| P1 | **관찰·출력 예산**: fields/paging, artifact range read, multiview image size | 큰 scene에서 cap·truncation이 명확하고 추가 조회 가능. 빈 screenshot 탐지 |
| P1 | **권한과 재현성**: local trust boundary, workspace/file access, package/extension version pinning | Node도 일반 로컬 코드 실행 권한이라는 점을 반영. 소스·버전·seed·입력·산출물 manifest 기록 |
| P1 | **클라이언트 호환성**: Claude Code/Codex native image, structuredContent, cancellation/progress, deferred tool discovery | 두 client의 end-to-end 최소 시나리오. protocol 기능의 존재를 client 지원으로 간주하지 않음 |

SDK의 remote 속성은 특히 조심해야 한다. 일반 JS property 대입을 `await` 가능한 원격 setter와 동일하게 취급할 수 없으므로 명시적 get/set/call 또는 batch facade를 정해야 한다. Blender 데이터의 이름은 표시·검색에 쓰고 세션/epoch가 붙은 handle을 실제 참조로 쓰는 방향이 적절하다. Blender 공식 설명은 데이터 삭제·reload 등에 따른 Python wrapper 무효화와 operator context 제약을 다룬다. [객체 수명 원문](https://raw.githubusercontent.com/blender/blender/main/doc/python_api/rst/info_gotchas_internal_data_and_python_objects.rst), [operator context 원문](https://raw.githubusercontent.com/blender/blender/main/doc/python_api/rst/info_gotchas_operators.rst)

Undo도 자동 transaction이 아니다. 공식 Operator 예제는 `FINISHED`와 `CANCELLED`의 undo 의미를 구분하며, `CANCELLED`가 이미 수행한 변경을 자동으로 되돌리는 것은 아니라고 설명한다. 외부 파일 출력·npm 코드의 부작용까지 Blender undo가 복원한다고 약속하면 안 된다. [공식 undo 예제](https://raw.githubusercontent.com/blender/blender/main/doc/python_api/examples/bpy.types.Operator.1.py)

`ttsx`는 project discovery·`-P`·cwd·argv·source map을 제공하므로 Blendia는 이것을 재작성하지 않고 전달해야 한다. Blender의 저장되지 않은 text datablock은 프로젝트 문맥을 보존하는 staged/virtual entry 전략이 필요하다. 무조건 시스템 임시 디렉터리에 `.ts`를 저장하면 imports·의존성·tsconfig 탐색 기준이 바뀔 수 있다. 또한 **실행 버튼 추가와 기본 편집기의 TS syntax/LSP/자동완성은 별도 기능**이다. 확장 안의 별도 UI나 외부 editor 연동으로 시작할 수 있으며, native 편집기 자체를 깊게 변경할 때만 Blender core 수정의 필요성을 추가 검토한다. [ttsx 실행 문서](https://ttsc.dev/docs/ttsc/execute/)

Node 코드 실행은 로컬 사용자의 권한으로 동작한다. 별도 프로세스나 Python module allowlist를 완전한 sandbox로 설명해서는 안 된다. 보안 제품을 새로 만드는 것까지 MVP에 확장할 필요는 없지만, 연결·파일·실행의 권한 contract는 명확해야 한다. [Blender 공식 안내의 실행 경고](https://www.blender.org/lab/mcp-server/), [bpy.dev의 subprocess 분리 설명](https://bpy.dev/)

## 10. 효율 검증 계획: 비교할 경로와 한 번의 검사 라운드

직접 검증 전에는 기능 수·별 수·데모 화려함으로 효율을 확정하지 않는다. 동일한 Blender·model·effort·시작파일·과제·시간/토큰 예산에서 다음 경로를 비교한다.

1. TS 파일 + CLI + SDK.
2. 세부 MCP 도구 호출.
3. 작은 MCP `run_script` + 같은 TS SDK.

과제는 장면 조회·일괄 재질/이름 변경·절차적 저폴리 생성·Geometry Nodes·카메라/animation·headless render/export·기존 장면 수정·transport 장애 복구를 포함한다. 정교한 organic asset은 한계 평가 track으로 분리하고 자동화 track의 실패율과 혼합하지 않는다.

각 라운드에서 **모든 관련 증거를 먼저 수집**한다: 총 input/output/cache tokens·실제 비용·왕복 수·벽시계 시간·타입 오류·runtime 오류·장면 조건·다각도 render·빈 캡처·산출물 재수입·재실행/취소/복구·사용자 scene 오염. 현상을 root cause와 기여 요인별로 묶고 한 번에 수정한 뒤 다음 전체 라운드를 실행한다. 단일 증상 수정 후 다음 증상을 쫓는 반복은 하지 않는다.

증거 기록·추적에는 사용자 지정 `@wrtnlabs/evidence`를 적용한다. 구체적인 검증 명령·증거 태그·skill 위치는 [개발·운영 규약 #7](https://github.com/samchon/blendia/issues/7), Blender 실제 실행과 실패 복구·benchmark 완료 기준은 [검증 계획 #6](https://github.com/samchon/blendia/issues/6)과 연결한다. 이 보고서의 조사 결과를 구현 완료나 자체 검증 통과로 표시하지 않는다.

MCP 비용은 현재 client 동작을 반영해야 한다. Claude Code는 tool search/deferred loading을 지원하므로 “항상 모든 도구 schema를 처음부터 context에 넣는다”고 가정할 수 없다. [Claude Code 문서](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search) 코드로 중간 결과를 처리하는 방향은 [Cloudflare Code Mode](https://blog.cloudflare.com/code-mode/)도 설명하지만 Blender에서의 효과는 위 자체 비교로 입증해야 한다.

## 11. 출처 목록과 신뢰도 분류

### A. 사양·공식 문서·현재 소스

- [ttsx 실행](https://ttsc.dev/docs/ttsc/execute/)
- [typia MCP 사용법](https://typia.io/docs/utilization/mcp/)
- [@typia/mcp Registrar](https://raw.githubusercontent.com/samchon/typia/master/packages/mcp/src/internal/McpControllerRegistrar.ts)
- [@typia/mcp public entry](https://raw.githubusercontent.com/samchon/typia/master/packages/mcp/src/index.ts)
- [MCP tools 사양](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [Blender Lab MCP 안내](https://www.blender.org/lab/mcp-server/), [소스](https://projects.blender.org/lab/blender_mcp/src/branch/main), [도구 목록](https://projects.blender.org/lab/blender_mcp/raw/branch/main/readme_tools.rst)
- [Claude Code MCP/tool search](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search)
- [Codex MCP 공식 안내](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Anthropic code execution](https://www.anthropic.com/research/code-execution-with-mcp)
- [Cloudflare Code Mode](https://blog.cloudflare.com/code-mode/)

### B. 구현 원문

제3절 표의 20개 저장소가 구현 출처 목록이다. fork·preview·저자 주장과 독립 후기의 차이를 표에 기록했다. [dcc skill index](https://raw.githubusercontent.com/dcc-mcp/dcc-mcp-blender/main/src/dcc_mcp_blender/skills/SKILLS_INDEX.md)와 [RNA discovery 설계](https://raw.githubusercontent.com/dcc-mcp/dcc-mcp-blender/main/docs/capability-enhancement.md)는 progressive discovery와 응답 예산 설계의 추가 자료다.

### C. 계측·연구

- [72 runs DEV 원문](https://dev.to/jaehyun_cho_0dff271e0d2e5/how-many-tokens-does-blender-mcp-really-use-72-claude-code-runs-and-a-racing-scene-for-047-5hl3): proxy 저자의 자기 측정.
- [#347 도구 정의 비용·후속 실험](https://github.com/ahujasid/mcp-for-blender/issues/347), [방법](https://github.com/athakur3/mcp-context-cost/blob/main/docs/METHODOLOGY.md), [데이터](https://doi.org/10.5281/zenodo.23562484): 버전별 측정과 후속 댓글을 구분.
- [LL3M, 2025-08-11](https://arxiv.org/html/2508.08228v1): RAG·코드 보존·다중시점 critic 연구. MCP 대비 정량 개선률로 오인 금지.
- [3Dify, 2025-10-06](https://3dvar.com/Hayashi20253Dify.pdf): ahujasid 사용 실험, 당시 screenshot 없음. 현재 구현 평가로 일반화 금지.
- [BlenderWorld, 2026-10-14](https://arxiv.org/html/2610.23986v1), [구현](https://github.com/QwenLM/BlenderWorld): 223과제의 시각+구조 평가, overall score와 perfect pass 구분. MCP/CLI 또는 TS/Python 비교가 아님.
- [bpy.dev 결과 JSON](https://huggingface.co/datasets/michaelgold/blenderbench-direct-results/resolve/7c2c43be4517aee4d76d2b445578988de186970c/results/results-summary.json): inspectable 결과, 초기 author benchmark.

### D. 후기·실사례

- [Wavesworn headless 전환](https://www.sumguy.com/blender-mcp-vs-headless-bpy/), 2026-10-18.
- [DevelopersIO 체험](https://dev.classmethod.jp/en/articles/claude-blender-connector-desktop-and-code/), 2026-04-30.
- [Simon Willison Codex/Blender 기록](https://til.simonwillison.net/llms/blender-coding-agents-macos), 2026-09-05.
- [Mavday headless spot check](https://mavday.com/ai-engineering/blender-mcp-ai-agents/), 2026-10-29.
- [camera previz](https://www.reddit.com/r/ClaudeCode/comments/1ufzorw/i_let_claude_drive_blender_through_mcp_to_build/).
- [Codex+Godot 저폴리](https://www.reddit.com/r/codex/comments/1wen17e/codex_with_blender_and_godot_mcp_is_amazing/).
- [topology 비판·자동화 긍정](https://www.reddit.com/r/OpenAI/comments/1we95z2/blender_mcp_is_impressive_but_not_that_useable_yet/).
- [공간 일관성 문제](https://www.reddit.com/r/ClaudeAI/comments/1ritdv6/struggling_with_claude_code_blendermcp_for/).
- [Codex 사용 질문](https://www.reddit.com/r/codex/comments/1viffah/any_tips_for_using_codex_blender_mcp/).
- [초기 clock 과제와 후속 script 보존 경험](https://www.reddit.com/r/LocalLLaMA/comments/1k2ilye/blender_mcp_can_anyone_actually_get_good_results/).
- [MCP 절약 주장](https://www.reddit.com/r/codex/comments/1wceqea/if_youre_using_blender_please_use_the_mcp_server/): 실측 아님.
- [1,200+ arena runs](https://www.reddit.com/r/LocalLLaMA/comments/1wyklnj/i_ran_1200_blender_modeling_runs_across_llms_and/): 진행 중인 투표·harness 실험.
- [dcc crate showcase](https://github.com/dcc-mcp/dcc-mcp-blender/blob/main/docs/showcase/crate-lookdev/README.md): 제작자 데모.
- [Computer Use와 Blender Python](https://konadu.dev/computer-use-mcp-blender-python-scripting), 2026-03-30: generic GUI 조작의 장단점. Blender 전용 MCP 평가와 구분.

### E. 실제 장애 보고

- [community #279](https://github.com/ahujasid/mcp-for-blender/issues/279), [#339](https://github.com/ahujasid/mcp-for-blender/issues/339).
- [공식 PR#48 Windows stdio](https://projects.blender.org/lab/blender_mcp/pulls/48), [#69 Store launcher](https://projects.blender.org/lab/blender_mcp/issues/69).
- [공식 issue 목록](https://projects.blender.org/lab/blender_mcp/issues): 일부 개별 본문은 접근 실패했으므로 목록 제목·날짜 범위로만 인용.

기계 생성 review 사이트·별 수·마케팅 데모는 독립적인 성공률·생산성 수치로 채택하지 않았다. Reddit 날짜의 상대 표기와 과거 thread의 최신 댓글이 섞이는 경우 정확한 날짜를 추정하지 않았다. 공개 자료 전체를 빠짐없이 찾았다는 보장은 없으며, 위 목록은 이번 조사에서 근거와 구현 차이를 식별할 수 있었던 범위이다.
