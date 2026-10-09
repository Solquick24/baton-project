# 팀원 Codex 로그 제출자료 (2026-10-09)

[통합 ZIP 다운로드](https://github.com/Solquick24/baton-project/releases/download/codex-logs-2026-10-09/baton-team-codex-logs-2026-10-09.zip) · [제출자료 Release](https://github.com/Solquick24/baton-project/releases/tag/codex-logs-2026-10-09) · [이슈 #50](https://github.com/Solquick24/baton-project/issues/50)

사용자가 전달한 `팀원 코덱스로그파일.zip`의 내부 ZIP 4개를 게시용으로 검증·마스킹한 사본이다. 입력 파일은 변경하지 않았다. 파일 크기는 124,947,978 bytes (119.2 MiB)이며, [일반 Git 파일의 100MiB 제한](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) 때문에 Release 첨부파일로 보관한다.

## 구성

| 내부 ZIP | 포함 자료 |
|---|---|
| baton-codex-submission-20261009-164610.zip | 실행 로그, 세션 JSONL, 채팅 JSON, 루트·앱별 AGENTS.md |
| 김기원.zip | SQLite 실행 로그, history.jsonl, AGENTS.md |
| 박종현.zip | SQLite 실행 로그, history.jsonl, 세션 JSONL, AGENTS.md |
| baton-codex-한상균.zip | 세션 JSONL 8개 |

제공된 구성과 팀원별 구분을 유지했으며, 제공되지 않은 채팅 기록·지침 파일은 추가로 만들지 않았다.

## 게시 사본 처리와 검증

- 일반적인 키·토큰 패턴을 점검하고 AWS access key 형식 3건, JWT 81건, Bearer 형식 1건, URL 인증 정보 형식 2건, 비밀 값 할당 형식 264건을 마스킹했다. 건수는 패턴 일치 수이며 실제 유효 자격 증명의 개수가 아니다.
- SQLite 2개는 WAL 내용을 반영한 일관된 backup을 만들고 저장된 텍스트를 마스킹한 뒤 VACUUM했다. 불필요해진 WAL·SHM 및 macOS 메타데이터는 제외했다. macOS ZIP의 깨진 한글 폴더명은 UTF-8로 복원했다.
- 외부 ZIP 1개·내부 ZIP 4개의 CRC, JSON 2개·JSONL 51개의 파싱, SQLite 2개의 integrity_check가 통과했다. JSONL 레코드 32,358개를 파싱했고 SQLite 테이블 행 24,789개를 점검했다.
- 게시 사본의 파일 62개를 다시 읽어 같은 키·토큰 패턴의 추가 변경 대상 0개를 확인했다. 패턴 검사는 모든 형태의 민감 정보 부재를 보증하지 않는다.
- ZIP의 `PUBLICATION-REPORT.json`에 팀원별 처리 결과가 있다. Release의 `SHA256SUMS.txt`로 파일 무결성을 확인할 수 있다.

```text
SHA-256: 9e0802e3c92639a74dca0a2396976329201bdd6c1ed594576702038b805ebdca
```

## 구현 범위

제출자료 보관 작업이며 앱 코드·API 계약·MVP task 완료 상태는 바꾸지 않는다. live/fixture 모드는 해당하지 않는다. 앱 테스트는 실행하지 않았으며 파일 검증만 수행했다. 다운로드 안내의 devlop 반영은 관련 PR의 상태를 따른다.
