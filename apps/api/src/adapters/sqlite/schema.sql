CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, passwordHash TEXT NOT NULL,
 testOnly INTEGER NOT NULL CHECK(testOnly IN (0,1))
);
CREATE TABLE IF NOT EXISTS patients (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, userId TEXT NOT NULL UNIQUE REFERENCES users(id),
 leadUserId TEXT NOT NULL REFERENCES users(id), delegated INTEGER NOT NULL CHECK(delegated IN (0,1)),
 recordingAllowed INTEGER NOT NULL CHECK(recordingAllowed IN (0,1))
);
CREATE TABLE IF NOT EXISTS members (
 patientId TEXT NOT NULL REFERENCES patients(id), userId TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('patient','lead','guardian')), scope TEXT NOT NULL CHECK(scope IN ('schedule','companion','full')),
 active INTEGER NOT NULL CHECK(active IN (0,1)), relation TEXT NOT NULL,
 PRIMARY KEY(patientId,userId), CHECK(role <> 'patient' OR scope = 'full')
);
CREATE TABLE IF NOT EXISTS hospitals (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL,
 mapImage TEXT NOT NULL, floorImage TEXT NOT NULL, guideSteps TEXT NOT NULL CHECK(json_valid(guideSteps)),
 experiences TEXT NOT NULL CHECK(json_valid(experiences)), notice TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS visits (
 id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), dept TEXT NOT NULL CHECK(length(trim(dept))>0),
 hospitalId TEXT NOT NULL REFERENCES hospitals(id), date TEXT NOT NULL, time TEXT, companionUserId TEXT REFERENCES users(id),
 status TEXT NOT NULL CHECK(status IN ('upcoming','done')), recordInputVersion INTEGER NOT NULL DEFAULT 0 CHECK(recordInputVersion>=0),
 recordDraftVersion INTEGER CHECK(recordDraftVersion>0), recordPublishedVersion INTEGER CHECK(recordPublishedVersion>0),
 questionsInputVersion INTEGER NOT NULL DEFAULT 0 CHECK(questionsInputVersion>=0), questionsVersion INTEGER CHECK(questionsVersion>0),
 briefingVersion INTEGER CHECK(briefingVersion>0), UNIQUE(id,patientId)
);
CREATE TABLE IF NOT EXISTS block_sets (
 id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), visitId TEXT NOT NULL, section TEXT NOT NULL CHECK(section IN ('questions','briefing','record')),
 version INTEGER NOT NULL CHECK(version>0), inputVersion INTEGER NOT NULL CHECK(inputVersion>=0),
 state TEXT NOT NULL CHECK(state IN ('generating','ready','blocked','failed')), mode TEXT NOT NULL CHECK(mode IN ('live','fixture')),
 createdBy TEXT NOT NULL REFERENCES users(id), createdAt TEXT NOT NULL, issues TEXT NOT NULL CHECK(json_valid(issues)),
 UNIQUE(visitId,section,version), FOREIGN KEY(visitId,patientId) REFERENCES visits(id,patientId)
);
CREATE TABLE IF NOT EXISTS visit_blocks (
 blockSetId TEXT NOT NULL REFERENCES block_sets(id), kind TEXT NOT NULL CHECK(kind IN ('schedule','companion','full')),
 payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(blockSetId,kind)
);
CREATE TABLE IF NOT EXISTS questions (
 id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), visitId TEXT NOT NULL, authorId TEXT NOT NULL REFERENCES users(id),
 text TEXT NOT NULL, visibility TEXT NOT NULL CHECK(visibility IN ('companion','full')), createdAt TEXT NOT NULL,
 FOREIGN KEY(visitId,patientId) REFERENCES visits(id,patientId)
);
CREATE TABLE IF NOT EXISTS notes (
 id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), visitId TEXT NOT NULL, authorId TEXT NOT NULL REFERENCES users(id),
 text TEXT NOT NULL, createdAt TEXT NOT NULL, FOREIGN KEY(visitId,patientId) REFERENCES visits(id,patientId)
);
CREATE TABLE IF NOT EXISTS uploads (
 id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), visitId TEXT NOT NULL, uploaderId TEXT NOT NULL REFERENCES users(id),
 storagePath TEXT NOT NULL, mediaType TEXT NOT NULL, size INTEGER NOT NULL CHECK(size>=0), createdAt TEXT NOT NULL,
 UNIQUE(id,visitId,patientId), FOREIGN KEY(visitId,patientId) REFERENCES visits(id,patientId)
);
CREATE TABLE IF NOT EXISTS transcripts (
 id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), visitId TEXT NOT NULL, uploadId TEXT,
 mode TEXT NOT NULL CHECK(mode IN ('live','fixture')), segments TEXT NOT NULL CHECK(json_valid(segments)), createdAt TEXT NOT NULL,
 FOREIGN KEY(visitId,patientId) REFERENCES visits(id,patientId), FOREIGN KEY(uploadId,visitId,patientId) REFERENCES uploads(id,visitId,patientId)
);
CREATE TABLE IF NOT EXISTS prescriptions (
 id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), visitId TEXT NOT NULL, uploadId TEXT, source TEXT NOT NULL,
 items TEXT NOT NULL CHECK(json_valid(items)), text TEXT NOT NULL, FOREIGN KEY(visitId,patientId) REFERENCES visits(id,patientId),
 FOREIGN KEY(uploadId,visitId,patientId) REFERENCES uploads(id,visitId,patientId)
);
CREATE TABLE IF NOT EXISTS observations (
 id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), dept TEXT NOT NULL CHECK(length(trim(dept))>0), authorId TEXT NOT NULL REFERENCES users(id),
 text TEXT NOT NULL, fact TEXT CHECK(fact IS NULL OR json_valid(fact)), date TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0), supersedesId TEXT REFERENCES observations(id)
);
CREATE TABLE IF NOT EXISTS alerts (
 id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), visitId TEXT NOT NULL, dept TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('observation_vs_prescription','record_vs_prescription')), "references" TEXT NOT NULL CHECK(json_valid("references")),
 differences TEXT NOT NULL CHECK(json_valid(differences)), summary TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('open','awaiting_confirmation','resolved')), history TEXT NOT NULL CHECK(json_valid(history)),
 FOREIGN KEY(visitId,patientId) REFERENCES visits(id,patientId)
);
CREATE TABLE IF NOT EXISTS jobs (
 id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), visitId TEXT NOT NULL, requestedBy TEXT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('transcribe','merge_questions','briefing','structure')), inputVersion INTEGER NOT NULL CHECK(inputVersion>=0),
 status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed')), attempt INTEGER NOT NULL CHECK(attempt>0),
 mode TEXT CHECK(mode IN ('live','fixture')), resultVersion INTEGER CHECK(resultVersion>0), resultState TEXT CHECK(resultState IN ('ready','blocked')),
 errorCode TEXT CHECK(errorCode IN ('ai_unavailable','stt_unavailable','validation_failed','stale_input','internal')), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
 UNIQUE(visitId,kind,inputVersion,attempt), FOREIGN KEY(visitId,patientId) REFERENCES visits(id,patientId)
);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_deduplicate ON jobs(visitId,kind,inputVersion) WHERE status IN ('queued','running','succeeded');
CREATE TABLE IF NOT EXISTS share_logs (
 id TEXT PRIMARY KEY, patientId TEXT NOT NULL REFERENCES patients(id), targetUserId TEXT REFERENCES users(id), actorId TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL CHECK(action IN ('start','scope_change','stop','publish')), oldScope TEXT CHECK(oldScope IN ('schedule','companion','full')),
 newScope TEXT CHECK(newScope IN ('schedule','companion','full')), visitId TEXT, version INTEGER CHECK(version>0), at TEXT NOT NULL,
 FOREIGN KEY(visitId,patientId) REFERENCES visits(id,patientId)
);
CREATE INDEX IF NOT EXISTS visits_context ON visits(patientId,dept,date);
