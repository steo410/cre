# Crestie Lineage v3

크레스티드 게코의 **개체 정보, 성장 기록, 유전 정보, 교배 예상, 교배 관계, 자동 가계도, 사진**을 관리하는 웹앱입니다.

## v3 주요 기능
- 개체: 이름, 모프/품종, 성별, 부화일, 입양일, 브리더, 메모, 부모 1/2
- 개체 대표 사진 업로드: 휴대폰 카메라/갤러리와 노트북 파일 선택 지원
- 사진은 업로드 전에 최대 1400px WebP로 자동 압축
- 성장: 날짜별 체중(g), 전장(cm), 상태, 메모
- 성장 그래프
- 자동 가계도
- 교배 관계: 형제·자매 / 부모·자식 / 조상·후손 관계도 기록 가능
- 유전 정보: 릴리화이트, 아잔틱, 카푸치노, 솔리드백
- 아잔틱: 비주얼 / 100% 헷 / 66% 헷 / 50% 헷 / 유전자 없음 구분
- 부모 유전 정보에서 자식의 가능한 유전 상태 자동 추론
- 통용 표기: 릴리아잔틱/릴잔틱, 솔리드릴리, 프라푸치노 등
- 분양 표기 분석: `웨코x노멀 (북이/설기)`처럼 괄호 안 부모 이름이 등록되어 있으면 자동 연결
- 교배 예상: 사용자가 선택한 두 개체만 계산
- 성별 미확인 개체는 수컷/암컷 어느 쪽과도 교배 후보로 사용 가능
- 릴리×릴리도 계산을 막지 않고 슈퍼 릴리 가능성을 포함해 표시
- JSON 백업/복원

## GitHub Cloud 구조
프로그램 코드는 `main` 브랜치에, 실제 개체 데이터와 사진은 `crestie-data` 브랜치에 저장합니다.

```text
main
├─ index.html
├─ app.js
├─ cloud.js
├─ style.css
├─ cloud.css
└─ api/
   ├─ data.js
   └─ photo.js

crestie-data
└─ data/
   ├─ cresties.json
   └─ photos/<개체 ID>/profile.webp
```

노트북에서 수정하면 Vercel API가 GitHub의 `crestie-data` 브랜치를 갱신하고, 휴대폰에서 같은 사이트를 열면 최신 데이터를 다시 가져옵니다.

## Vercel에서 최초 1회 설정
Vercel 프로젝트 → **Settings → Environment Variables**에서 아래 두 값을 등록합니다.

### `CRESTIE_GITHUB_TOKEN`
GitHub Fine-grained Personal Access Token을 사용하세요. 저장소 `steo410/cre`에 대해서만 접근하도록 제한하고 **Contents: Read and write** 권한을 주세요.

> 토큰은 절대로 `app.js`, `cloud.js`, GitHub 저장소에 직접 적지 마세요. Vercel Environment Variable에만 저장합니다.

### `CRESTIE_SYNC_KEY`
사이트에서 데이터를 수정할 때 사용하는 개인 비밀번호입니다. 원하는 긴 문자열을 직접 정해서 넣으면 됩니다.

예:
```text
my-crestie-sync-2026-very-long-secret
```

환경변수를 저장한 뒤 Vercel에서 한 번 **Redeploy**합니다.

## 첫 연결
1. 배포된 Crestie Lineage 사이트를 엽니다.
2. 상단의 `동기화 비밀번호 필요` 또는 `GitHub Cloud` 영역을 누릅니다.
3. Vercel의 `CRESTIE_SYNC_KEY`와 같은 값을 입력합니다.
4. 기존 브라우저에 v2 데이터가 있고 GitHub 데이터가 비어 있으면 기존 데이터를 GitHub로 자동 이전합니다.
5. 이후 수정 사항은 GitHub에 자동 저장됩니다.

휴대폰에서도 같은 사이트에 접속하여 같은 동기화 비밀번호를 한 번 입력하면 동일한 데이터를 확인할 수 있습니다.

## 데이터 브랜치
`crestie-data` 브랜치는 이미 생성되어 있으며 `data/cresties.json` 초기 파일이 들어 있습니다. 사진도 이 브랜치에 저장됩니다.

## 기존 v1/v2 데이터
기존 LocalStorage 저장 키를 유지합니다. GitHub Cloud 첫 연결 시 원격 데이터가 비어 있고 현재 브라우저에 기존 데이터가 있으면 **로컬 데이터를 지우지 않고 GitHub 쪽으로 먼저 업로드**하도록 구성되어 있습니다.

## 주의
현재 저장소가 Public이므로 `crestie-data` 브랜치의 JSON과 사진 역시 GitHub에서 공개적으로 조회할 수 있습니다. 프로그램 수정 권한은 `CRESTIE_SYNC_KEY`와 서버 측 GitHub 토큰으로 보호됩니다. 사진과 기록 자체까지 비공개로 만들고 싶다면 이후 데이터 전용 Private 저장소로 분리할 수 있습니다.
