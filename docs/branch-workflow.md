# 바통 이슈·브랜치·PR 작업 방식

팀원은 GitHub 이슈로 작업을 정의하고, 이슈별 브랜치에서 개발한 뒤 `devlop`에 PR로 병합한다.
개발 기준 브랜치 이름은 현재 저장소의 `devlop`을 유지한다. 코드·문서·환경 설정에 같은 절차를 적용한다.
실제 `.env`·인증 정보는 로컬에 두고 공유할 환경 설정은 `.env.example`에 반영한다.

| 브랜치 | 역할 |
|---|---|
| 이슈별 작업 브랜치 | 한 이슈의 개발·검증·커밋 |
| `devlop` | 팀원의 작업 PR을 모으는 통합 브랜치 |
| `main` | 검증한 `devlop` 변경을 PR로 반영하는 기준 브랜치 |

## 팀원의 작업 순서

1. 이슈에 해결할 문제·범위·완료 조건·관련 작업 ID를 적는다. 프론트 이슈에는 화면·API·시드 기준을 연결한다.
2. 최신 `origin/devlop`에서 이슈별 작업 브랜치를 만든다. 이름은 `feat/<이슈번호>-<짧은설명>`처럼 작업 종류와 이슈 번호를 포함한다. 수정은 `fix/…`, 문서는 `docs/…`를 사용한다.
3. 한 이슈의 변경을 개발하고 해당 범위의 검사를 실행한다.
4. [커밋 컨벤션](commit-convention.md)에 따라 커밋한다.
5. **작업 브랜치 자체를 원격에 push**하고 base=`devlop`·compare=작업 브랜치로 PR을 만든다.
6. PR에 변경 내용·실제 검증 결과·남은 한계를 적고 `Closes #<이슈번호>`로 연결한다.
7. 리뷰와 검사 결과를 확인하고 `devlop`에 병합한다. PR 생성만으로 완료를 기록하지 않는다.
8. 통합된 변경을 검증한 뒤 `devlop → main` PR로 반영한다.

```bash
# 2는 실제 이슈 번호로 바꾼다.
git fetch origin
git switch -c feat/2-frontend-foundation origin/devlop
git push -u origin feat/2-frontend-foundation
```

작업 브랜치를 push해도 devlop에 바로 반영되지는 않는다. devlop 반영은 PR 병합으로 한다.
관련 없는 변경은 별도 이슈·브랜치·PR로 나누고, 공통 계약·DB·루트 package.json·lockfile은 변경을 순서대로 통합한다.
코드는 AGENTS.md의 해당 검사 기준, 문서는 변경 내용·링크를 확인한다. 미실행·실패한 검사와 개발용 응답/실제 API의 차이는 PR에 명시한다.
브랜치 분리는 기능 범위·Tier·권한·가상 자료 규칙을 변경하지 않는다.

현재 사용자는 FE 리드다. FE 리드는 프론트 우선순위·공통 UI·접근성·API 연결 기준과 프론트 PR을 검토한다.

GitHub의 새 이슈에서 `개발 작업` 양식을 사용하고 PR 기본 본문을 채운다. 양식은 `.github/ISSUE_TEMPLATE/task.yml`과 `.github/pull_request_template.md`에 있다.
